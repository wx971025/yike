"""忆刻 Windows 桌面版启动器（PyInstaller + PyWebview）

单进程内启动 FastAPI 后端，并用 WebView2 原生窗口展示前端。
若原生窗口不可用，自动降级为浏览器窗口，保证"点开即用"。
"""
from __future__ import annotations

import logging
import os
import socket
import sys
import threading
import time
import traceback
import urllib.error
import urllib.request
from pathlib import Path

logger = logging.getLogger("yike.launcher")


class _NullStream:
    """windowed 模式下 sys.stdout/stderr 为 None 的兜底，避免第三方库调用崩溃。"""

    def write(self, *_args, **_kwargs) -> int:
        return 0

    def flush(self) -> None:
        pass

    def isatty(self) -> bool:
        return False

    def fileno(self) -> int:
        raise OSError("no fileno")


def _ensure_std_streams() -> None:
    if sys.stdout is None:
        sys.stdout = _NullStream()  # type: ignore[assignment]
    if sys.stderr is None:
        sys.stderr = _NullStream()  # type: ignore[assignment]


def _crash_dir() -> Path:
    local_app = os.environ.get("LOCALAPPDATA")
    base = Path(local_app) if local_app else Path.home() / "AppData" / "Local"
    root = base / "YiKe" / "logs"
    try:
        root.mkdir(parents=True, exist_ok=True)
    except Exception:
        return Path.home()
    return root


def _show_error_box(title: str, message: str) -> None:
    if os.name != "nt":
        return
    try:
        import ctypes

        ctypes.windll.user32.MessageBoxW(0, message, title, 0x10)
    except Exception:
        pass


def _runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent / "workspace"


def _data_root() -> Path:
    local_app = os.environ.get("LOCALAPPDATA")
    base = Path(local_app) if local_app else Path.home() / "AppData" / "Local"
    root = base / "YiKe"
    (root / "data").mkdir(parents=True, exist_ok=True)
    (root / "logs").mkdir(parents=True, exist_ok=True)
    return root


def _pick_port() -> int:
    preferred = int(os.environ.get("YIKE_PORT", "17890"))
    for port in range(preferred, preferred + 20):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise RuntimeError("无法找到可用端口")


def _configure_logging(log_dir: Path) -> None:
    log_file = log_dir / "yike.log"
    handlers: list[logging.Handler] = [logging.FileHandler(log_file, encoding="utf-8")]
    if sys.stdout is not None:
        handlers.append(logging.StreamHandler(sys.stdout))
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
    )


def _configure_environment(runtime: Path, data_root: Path) -> int:
    db_path = data_root / "data" / "ebbinghaus.db"
    dict_path = data_root / "data" / "ecdict.db"
    ip_log = data_root / "data" / "ip.log"

    os.environ["YIKE_DESKTOP"] = "1"
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    os.environ.setdefault("DICT_DB_PATH", str(dict_path))
    os.environ.setdefault("IP_LOG_PATH", str(ip_log))
    os.environ.setdefault("JWT_SECRET", "yike-desktop-local-secret")

    if getattr(sys, "frozen", False):
        os.environ.setdefault("YIKE_STATIC_DIR", str(runtime / "frontend_dist"))
        os.environ.setdefault("TZPATH", str(runtime / "tzdata"))
        if str(runtime) not in sys.path:
            sys.path.insert(0, str(runtime))
    else:
        os.environ.setdefault("YIKE_STATIC_DIR", str(runtime / "frontend" / "dist"))
        backend_dir = runtime / "backend"
        if backend_dir.is_dir() and str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

    return _pick_port()


def _wait_for_health(url: str, timeout_sec: float = 180.0) -> None:
    deadline = time.time() + timeout_sec
    last_error = "unknown"
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2) as resp:
                if resp.status == 200:
                    return
        except urllib.error.HTTPError as exc:
            if exc.code == 200:
                return
            last_error = str(exc)
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
        time.sleep(0.4)
    raise TimeoutError(f"后端启动超时: {last_error}")


def _start_server(app_import: str, host: str, port: int) -> None:
    import uvicorn

    # console=False 时 sys.stdout 为 None，uvicorn 默认彩色日志会调用
    # sys.stdout.isatty() 崩溃，因此禁用 uvicorn 自带日志配置。
    uvicorn.run(app_import, host=host, port=port, log_config=None)


def _tray_icon_path() -> Path:
    if getattr(sys, "frozen", False):
        exe_icon = Path(sys.executable).resolve().parent / "icon.ico"
        if exe_icon.is_file():
            return exe_icon
    pkg_root = Path(__file__).resolve().parent.parent
    for candidate in (
        pkg_root / "assets" / "icon.ico",
        _runtime_root() / "frontend" / "public" / "logo.png",
    ):
        if candidate.is_file():
            return candidate
    raise FileNotFoundError("未找到托盘图标 icon.ico / logo.png")


class _DesktopBridge:
    """供前端通过 window.pywebview.api 调用的桌面能力。"""

    def save_export(self, content: str, filename: str) -> dict:
        try:
            import webview
        except Exception as exc:
            logger.exception("导出时无法加载 pywebview")
            return {"ok": False, "error": str(exc)}

        if not webview.windows:
            return {"ok": False, "error": "窗口未就绪"}

        safe_name = Path(filename).name or "yike-backup.json"
        if not safe_name.lower().endswith(".json"):
            safe_name = f"{safe_name}.json"

        try:
            result = webview.windows[0].create_file_dialog(
                webview.FileDialog.SAVE,
                save_filename=safe_name,
                file_types=("备份文件 (*.json)", "All files (*.*)"),
            )
        except Exception as exc:
            logger.exception("打开保存对话框失败")
            return {"ok": False, "error": str(exc)}

        if not result:
            return {"ok": False, "cancelled": True}

        target = result[0] if isinstance(result, (tuple, list)) else result
        target_path = Path(str(target))
        if target_path.suffix.lower() != ".json":
            target_path = target_path.with_suffix(".json")

        try:
            target_path.write_text(content, encoding="utf-8")
        except Exception as exc:
            logger.exception("写入导出文件失败: %s", target_path)
            return {"ok": False, "error": str(exc)}

        logger.info("数据已导出: %s", target_path)
        return {"ok": True, "path": str(target_path)}


def _start_tray_icon(
    *,
    on_open,
    on_exit,
) -> tuple[threading.Thread, object] | None:
    """在后台线程启动系统托盘图标，返回 (线程, icon)。"""
    try:
        from PIL import Image
        from pystray import Icon, Menu, MenuItem
    except Exception:
        logger.exception("导入 pystray 失败，托盘驻留不可用")
        return None

    try:
        tray_image = Image.open(_tray_icon_path())
    except Exception:
        logger.exception("加载托盘图标失败，使用占位图标")
        tray_image = Image.new("RGBA", (64, 64), (0, 120, 215, 255))

    menu = Menu(
        MenuItem("打开忆刻", on_open, default=True),
        MenuItem("退出", on_exit),
    )
    icon = Icon("忆刻 YiKe", tray_image, menu=menu, title="忆刻 YiKe")

    def _run_tray() -> None:
        try:
            icon.run()
        except Exception:
            logger.exception("系统托盘线程异常退出")

    thread = threading.Thread(target=_run_tray, daemon=True, name="yike-tray")
    thread.start()
    return thread, icon


def _open_native_window(url: str, storage_path: Path) -> bool:
    """尝试用 pywebview 打开原生窗口，成功返回 True。"""
    try:
        import webview
    except Exception:
        logger.exception("导入 pywebview 失败，降级为浏览器窗口")
        return False

    shutting_down = False
    window_ref: dict[str, object | None] = {"window": None}
    tray_ref: dict[str, object | None] = {"icon": None}

    def _show_window() -> None:
        win = window_ref["window"]
        if win is not None:
            win.show()

    def _hide_window() -> None:
        win = window_ref["window"]
        if win is not None:
            win.hide()

    def _on_tray_open(_icon, _item) -> None:
        threading.Thread(target=_show_window, daemon=True).start()

    def _on_tray_exit(_icon, _item) -> None:
        nonlocal shutting_down
        shutting_down = True
        tray_icon = tray_ref["icon"]
        if tray_icon is not None:
            try:
                tray_icon.stop()
            except Exception:
                logger.exception("停止托盘图标失败")
        win = window_ref["window"]
        if win is not None:
            win.destroy()

    def _on_window_closing() -> bool:
        nonlocal shutting_down
        if shutting_down:
            return True
        threading.Thread(target=_hide_window, daemon=True).start()
        logger.info("窗口已隐藏到系统托盘，程序继续在后台运行")
        return False

    tray_thread = None
    tray_icon = None
    tray_started = _start_tray_icon(on_open=_on_tray_open, on_exit=_on_tray_exit)
    if tray_started is not None:
        tray_thread, tray_icon = tray_started
        tray_ref["icon"] = tray_icon
    else:
        logger.warning("未启用系统托盘，关闭窗口将直接退出程序")

    try:
        window = webview.create_window(
            "忆刻 YiKe",
            url,
            width=1280,
            height=860,
            min_size=(960, 640),
            js_api=_DesktopBridge(),
        )
        window_ref["window"] = window
        if tray_thread is not None:
            window.events.closing += _on_window_closing
    except Exception:
        logger.exception("创建原生窗口失败，降级为浏览器窗口")
        return False

    storage_path.mkdir(parents=True, exist_ok=True)
    webview_storage = str(storage_path)
    logger.info("WebView 持久化目录: %s", webview_storage)

    # 依次尝试可用的 GUI 后端，任一成功即认为原生窗口生效
    for gui in ("edgechromium", "cef", "mshtml", None):
        try:
            start_kwargs = {
                "storage_path": webview_storage,
                "private_mode": False,
            }
            if gui is None:
                webview.start(**start_kwargs)
            else:
                webview.start(gui=gui, **start_kwargs)
            return True
        except TypeError:
            # 旧版 pywebview 可能不支持 storage_path，降级尝试
            try:
                if gui is None:
                    webview.start()
                else:
                    webview.start(gui=gui)
                return True
            except Exception:
                logger.exception("pywebview 后端启动失败: gui=%s", gui)
                continue
        except Exception:
            logger.exception("pywebview 后端启动失败: gui=%s", gui)
            continue
    return False


def _open_browser_fallback(url: str) -> None:
    """降级方案：优先用 Edge 应用模式，其次默认浏览器；随后阻塞保活。"""
    logger.info("使用浏览器窗口打开: %s", url)
    opened = False
    if os.name == "nt":
        import subprocess

        edge_candidates = [
            Path(os.environ.get("ProgramFiles(x86)", "")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
            Path(os.environ.get("ProgramFiles", "")) / "Microsoft" / "Edge" / "Application" / "msedge.exe",
        ]
        for edge in edge_candidates:
            if edge.is_file():
                try:
                    subprocess.Popen([str(edge), f"--app={url}"])
                    opened = True
                    break
                except Exception:
                    logger.exception("启动 Edge 应用模式失败: %s", edge)

    if not opened:
        import webbrowser

        webbrowser.open(url)

    # 保活：后端在守护线程中，主线程需阻塞，否则进程会立即退出
    try:
        while True:
            time.sleep(3600)
    except KeyboardInterrupt:
        pass


def main() -> None:
    runtime = _runtime_root()
    data_root = _data_root()
    _configure_logging(data_root / "logs")
    logger.info("启动忆刻桌面版; frozen=%s", getattr(sys, "frozen", False))
    port = _configure_environment(runtime, data_root)

    static_dir = Path(os.environ["YIKE_STATIC_DIR"])
    if not static_dir.is_dir():
        raise RuntimeError(
            f"未找到前端静态资源: {static_dir}\n请重新构建（build.ps1）。"
        )

    host = "127.0.0.1"
    url = f"http://{host}:{port}"
    health_url = f"{url}/api/health"

    server_error: list[BaseException] = []

    def _run_server() -> None:
        try:
            _start_server("app.desktop_server:app", host, port)
        except BaseException as exc:  # noqa: BLE001
            server_error.append(exc)
            logger.exception("后端线程异常退出")

    threading.Thread(target=_run_server, daemon=True).start()

    try:
        _wait_for_health(health_url)
    except Exception as exc:
        detail = str(server_error[0]) if server_error else str(exc)
        raise RuntimeError(f"后端启动失败: {detail}") from exc

    logger.info("后端已就绪: %s", url)

    webview_dir = data_root / "webview"
    if not _open_native_window(url, webview_dir):
        _open_browser_fallback(url)


def _entry() -> None:
    _ensure_std_streams()
    try:
        main()
    except SystemExit:
        raise
    except BaseException:  # noqa: BLE001
        tb = traceback.format_exc()
        try:
            logging.getLogger("yike.launcher").critical("启动失败:\n%s", tb)
        except Exception:
            pass
        crash_file = _crash_dir() / "crash.log"
        try:
            crash_file.write_text(tb, encoding="utf-8")
        except Exception:
            pass
        _show_error_box(
            "忆刻 YiKe 启动失败",
            "程序启动时发生错误：\n\n"
            + tb.strip()[-1500:]
            + f"\n\n完整日志: {crash_file}",
        )
        sys.exit(1)


if __name__ == "__main__":
    _entry()
