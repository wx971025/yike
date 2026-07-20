"""忆刻 Windows 桌面版启动器（PyInstaller 入口）

前后端均打包进单个 exe，运行时无需网络：
- 前端：Vite 构建产物由本地 FastAPI 静态托管
- 后端：FastAPI + SQLite 内嵌运行
- 词典：ECDICT 内置，首次运行释放到用户目录
"""
from __future__ import annotations

import os
import sys
import threading
import webbrowser
from pathlib import Path


def _runtime_root() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS)  # type: ignore[attr-defined]
    return Path(__file__).resolve().parent.parent / "workspace"


def _data_root() -> Path:
    local_app = os.environ.get("LOCALAPPDATA")
    base = Path(local_app) if local_app else Path.home() / "AppData" / "Local"
    root = base / "YiKe"
    (root / "data").mkdir(parents=True, exist_ok=True)
    return root


def _configure_environment(runtime: Path, data_root: Path) -> None:
    db_path = data_root / "data" / "ebbinghaus.db"
    dict_path = data_root / "data" / "ecdict.db"
    ip_log = data_root / "data" / "ip.log"

    os.environ["YIKE_OFFLINE"] = "1"
    os.environ.setdefault("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    os.environ.setdefault("DICT_DB_PATH", str(dict_path))
    os.environ.setdefault("IP_LOG_PATH", str(ip_log))
    os.environ.setdefault("JWT_SECRET", "yike-desktop-local-secret")

    if getattr(sys, "frozen", False):
        os.environ.setdefault("YIKE_STATIC_DIR", str(runtime / "frontend_dist"))
        os.environ.setdefault("TZPATH", str(runtime / "tzdata"))
        bundled_dict = runtime / "bundled_data" / "ecdict.db"
        if bundled_dict.is_file():
            os.environ.setdefault("YIKE_BUNDLED_DICT", str(bundled_dict))
        if str(runtime) not in sys.path:
            sys.path.insert(0, str(runtime))
    else:
        os.environ.setdefault(
            "YIKE_STATIC_DIR", str(runtime / "frontend" / "dist")
        )
        assets_dict = runtime.parent / "assets" / "ecdict.db"
        if assets_dict.is_file():
            os.environ.setdefault("YIKE_BUNDLED_DICT", str(assets_dict))
        backend_dir = runtime / "backend"
        if backend_dir.is_dir() and str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))


def main() -> None:
    runtime = _runtime_root()
    data_root = _data_root()
    _configure_environment(runtime, data_root)

    static_dir = Path(os.environ["YIKE_STATIC_DIR"])
    if not static_dir.is_dir():
        print(f"错误: 未找到前端静态资源 {static_dir}", file=sys.stderr)
        print("请先执行 build.ps1 完成前端构建与打包。", file=sys.stderr)
        sys.exit(1)

    # 启动前释放内置词典（离线查词）
    from app.services.dict_setup import ensure_dictionary

    if not ensure_dictionary():
        print("警告: 内置词典未就绪，批量添加单词的自动查词可能不可用。", file=sys.stderr)

    import uvicorn
    from app.desktop_server import app

    host = "127.0.0.1"
    port = int(os.environ.get("YIKE_PORT", "17890"))
    url = f"http://{host}:{port}"

    print("忆刻 YiKe 桌面版（完全离线）")
    print(f"数据目录: {data_root / 'data'}")
    print(f"访问地址: {url}")
    print("关闭本窗口即可退出。单词读音与 Web 版相同（有道外链，无网时不播放）。AI 助手需配置 API 后联网使用。")

    threading.Timer(1.2, lambda: webbrowser.open(url)).start()
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
