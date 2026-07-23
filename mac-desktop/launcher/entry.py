"""忆刻 macOS 桌面版启动器（PyInstaller + PyWebview）。

单进程内启动 FastAPI 后端，并用 WKWebView（cocoa）原生窗口展示前端。
若原生窗口不可用，自动降级为默认浏览器，保证"点开即用"。
"""
from __future__ import annotations

import json
import logging
import os
import socket
import subprocess
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


def _logs_dir() -> Path:
    root = Path.home() / "Library" / "Logs" / "YiKe"
    try:
        root.mkdir(parents=True, exist_ok=True)
    except Exception:
        return Path.home()
    return root


def _crash_dir() -> Path:
    return _logs_dir()


def _show_error_box(title: str, message: str) -> None:
    """用 osascript 弹出原生对话框（无 GUI 环境时静默失败）。"""
    try:
        script = (
            'display dialog {msg} with title {title} buttons {{"好"}} '
            "default button 1 with icon stop"
        ).format(msg=_as_applescript_string(message), title=_as_applescript_string(title))
        subprocess.run(
            ["osascript", "-e", script],
            check=False,
            timeout=30,
        )
    except Exception:
        pass


def _as_applescript_string(text: str) -> str:
    escaped = text.replace("\\", "\\\\").replace('"', '\\"')
    return f'"{escaped}"'


def _runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent / "workspace"


def _read_app_version(runtime: Path | None = None) -> str:
    root = runtime or _runtime_root()
    candidates = [
        root / "version.json",
        Path(__file__).resolve().parent / "version.json",
    ]
    if getattr(sys, "frozen", False):
        candidates.insert(0, Path(sys.executable).resolve().parent / "version.json")
    for candidate in candidates:
        if not candidate.is_file():
            continue
        try:
            data = json.loads(candidate.read_text(encoding="utf-8"))
            if isinstance(data, dict) and isinstance(data.get("version"), str):
                version = data["version"].strip().lstrip("vV")
                if version:
                    return version
        except Exception:
            logger.exception("读取 version.json 失败: %s", candidate)
    return "0.0.0"


_shutdown_handlers: dict[str, object | None] = {
    "window": None,
    "shutting_down": False,
}


def _shutdown_desktop_app(*, delay_sec: float = 0.3) -> None:
    _shutdown_handlers["shutting_down"] = True

    window = _shutdown_handlers.get("window")
    if window is not None:
        try:
            window.destroy()  # type: ignore[attr-defined]
        except Exception:
            logger.exception("关闭窗口失败")

    def _exit_later() -> None:
        time.sleep(delay_sec)
        os._exit(0)

    threading.Thread(target=_exit_later, daemon=True).start()


def _data_root() -> Path:
    root = Path.home() / "Library" / "Application Support" / "YiKe"
    (root / "data").mkdir(parents=True, exist_ok=True)
    _logs_dir()
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
    app_version = _read_app_version(runtime)
    os.environ["YIKE_APP_VERSION"] = app_version
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


class _DesktopBridge:
    """供前端通过 window.pywebview.api 调用的桌面能力。"""

    def _api_json(self, path: str, *, method: str = "GET", payload: dict | None = None) -> dict:
        port = int(os.environ.get("YIKE_PORT", "17890"))
        url = f"http://127.0.0.1:{port}{path}"
        data = None
        headers = {"Content-Type": "application/json"}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        with urllib.request.urlopen(req, timeout=120) as resp:
            body = resp.read().decode("utf-8")
            return json.loads(body) if body else {}

    def _fetch_export_payload(self) -> tuple[dict, str]:
        payload = self._api_json("/api/desktop/data/export")
        filename = f"yike-backup-{time.strftime('%Y%m%d-%H%M%S')}.json"
        return payload, filename

    def _get_export_dir(self) -> Path | None:
        data = self._api_json("/api/desktop/preferences/export-dir")
        dir_str = data.get("dir")
        if isinstance(dir_str, str) and dir_str.strip():
            path = Path(dir_str)
            if path.is_dir():
                return path
        return None

    def _unique_path(self, directory: Path, filename: str) -> Path:
        directory.mkdir(parents=True, exist_ok=True)
        target = directory / filename
        if not target.exists():
            return target
        stem = Path(filename).stem
        suffix = Path(filename).suffix or ".json"
        index = 1
        while True:
            candidate = directory / f"{stem} ({index}){suffix}"
            if not candidate.exists():
                return candidate
            index += 1

    def get_export_dir(self) -> dict:
        export_dir = self._get_export_dir()
        return {"ok": True, "dir": str(export_dir) if export_dir else None}

    def choose_export_dir(self) -> dict:
        try:
            import webview
        except Exception as exc:
            logger.exception("选择导出目录时无法加载 pywebview")
            return {"ok": False, "error": str(exc)}

        if not webview.windows:
            return {"ok": False, "error": "窗口未就绪"}

        current = self._get_export_dir()
        initial = str(current) if current else ""

        try:
            result = webview.windows[0].create_file_dialog(
                _dialog_type(webview, "folder"),
                directory=initial,
            )
        except Exception as exc:
            logger.exception("打开文件夹选择对话框失败")
            return {"ok": False, "error": str(exc)}

        if not result:
            return {"ok": False, "cancelled": True}

        folder = result[0] if isinstance(result, (tuple, list)) else result
        folder_path = Path(str(folder))
        if not folder_path.is_dir():
            return {"ok": False, "error": "所选路径不是有效文件夹"}

        try:
            saved = self._api_json(
                "/api/desktop/preferences/export-dir",
                method="POST",
                payload={"dir": str(folder_path)},
            )
        except Exception as exc:
            logger.exception("保存导出目录失败")
            return {"ok": False, "error": str(exc)}

        logger.info("导出目录已设置: %s", folder_path)
        return {"ok": True, "dir": saved.get("dir", str(folder_path))}

    def save_export(self, export_dir: str = "") -> dict:
        folder_text = (export_dir or "").strip()
        if not folder_text:
            return {"ok": False, "error": "请先选择保存文件夹"}

        folder_path = Path(folder_text)
        if not folder_path.is_dir():
            return {"ok": False, "error": "保存路径不是有效文件夹"}

        try:
            self._api_json(
                "/api/desktop/preferences/export-dir",
                method="POST",
                payload={"dir": str(folder_path)},
            )
        except Exception as exc:
            logger.exception("保存导出目录偏好失败")
            return {"ok": False, "error": str(exc)}

        try:
            payload, default_name = self._fetch_export_payload()
        except Exception as exc:
            logger.exception("读取导出数据失败")
            return {"ok": False, "error": f"读取数据失败: {exc}"}

        safe_name = Path(default_name).name or default_name
        if not safe_name.lower().endswith(".json"):
            safe_name = f"{safe_name}.json"

        content = json.dumps(payload, ensure_ascii=False, indent=2)

        try:
            target_path = self._unique_path(folder_path, safe_name)
            target_path.write_text(content, encoding="utf-8")
        except Exception as exc:
            logger.exception("写入导出文件失败: %s", folder_path)
            return {"ok": False, "error": str(exc)}

        logger.info("数据已导出: %s", target_path)
        return {"ok": True, "path": str(target_path), "dir": str(folder_path)}

    def get_app_version(self) -> dict:
        return {"ok": True, "version": os.environ.get("YIKE_APP_VERSION") or _read_app_version()}

    def quit_for_update(self) -> dict:
        _shutdown_desktop_app()
        return {"ok": True}

    def run_update_installer(self, installer_path: str) -> dict:
        """在 Finder 中挂载下载好的 .dmg，用户手动拖入 Applications。"""
        path = Path(str(installer_path or "").strip())
        if not path.is_file():
            return {"ok": False, "error": f"安装包不存在: {path}"}
        try:
            subprocess.Popen(["open", str(path)])
        except Exception as exc:
            logger.exception("打开安装镜像失败")
            return {"ok": False, "error": str(exc)}
        logger.info("已打开安装镜像: %s", path)
        return {"ok": True}


def _dialog_type(webview, kind: str) -> int:
    file_dialog = getattr(webview, "FileDialog", None)
    if file_dialog is not None:
        mapping = {
            "open": file_dialog.OPEN,
            "folder": file_dialog.FOLDER,
            "save": file_dialog.SAVE,
        }
        return mapping[kind]
    legacy = {
        "open": webview.OPEN_DIALOG,
        "folder": webview.FOLDER_DIALOG,
        "save": webview.SAVE_DIALOG,
    }
    return legacy[kind]


def _open_native_window(url: str, storage_path: Path) -> bool:
    """尝试用 pywebview 打开原生窗口（cocoa / WKWebView），成功返回 True。"""
    try:
        import webview
    except Exception:
        logger.exception("导入 pywebview 失败，降级为浏览器窗口")
        return False

    _shutdown_handlers["window"] = None
    _shutdown_handlers["shutting_down"] = False

    try:
        window = webview.create_window(
            "忆刻 YiKe",
            url,
            width=1280,
            height=860,
            min_size=(960, 640),
            js_api=_DesktopBridge(),
        )
        _shutdown_handlers["window"] = window
    except Exception:
        logger.exception("创建原生窗口失败，降级为浏览器窗口")
        return False

    storage_path.mkdir(parents=True, exist_ok=True)
    webview_storage = str(storage_path)
    logger.info("WebView 持久化目录: %s", webview_storage)

    # macOS 默认后端为 cocoa（WKWebView）
    for gui in ("cocoa", None):
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
    """降级方案：用默认浏览器打开，随后阻塞保活。"""
    logger.info("使用浏览器窗口打开: %s", url)
    try:
        subprocess.Popen(["open", url])
    except Exception:
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
    _configure_logging(_logs_dir())
    logger.info("启动忆刻桌面版(macOS); frozen=%s", getattr(sys, "frozen", False))
    port = _configure_environment(runtime, data_root)
    os.environ["YIKE_PORT"] = str(port)

    static_dir = Path(os.environ["YIKE_STATIC_DIR"])
    if not static_dir.is_dir():
        raise RuntimeError(
            f"未找到前端静态资源: {static_dir}\n请重新构建（build.sh）。"
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
