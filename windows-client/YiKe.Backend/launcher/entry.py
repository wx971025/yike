"""忆刻 Windows 桌面版后端启动器（PyInstaller 入口）

仅打包 FastAPI API，不含浏览器与静态前端页面。
WinUI 原生客户端通过 HttpClient 调用 127.0.0.1:17890/api。
"""
from __future__ import annotations

import os
import sys
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
        os.environ.setdefault("TZPATH", str(runtime / "tzdata"))
        bundled_dict = runtime / "bundled_data" / "ecdict.db"
        if bundled_dict.is_file():
            os.environ.setdefault("YIKE_BUNDLED_DICT", str(bundled_dict))
        if str(runtime) not in sys.path:
            sys.path.insert(0, str(runtime))
    else:
        assets_dict = runtime.parent.parent / "assets" / "ecdict.db"
        if assets_dict.is_file():
            os.environ.setdefault("YIKE_BUNDLED_DICT", str(assets_dict))
        backend_dir = runtime / "backend"
        if backend_dir.is_dir() and str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))


def main() -> None:
    runtime = _runtime_root()
    data_root = _data_root()
    _configure_environment(runtime, data_root)

    from app.services.dict_setup import ensure_dictionary

    if not ensure_dictionary():
        print("警告: 内置词典未就绪，批量添加单词的自动查词可能不可用。", file=sys.stderr)

    import uvicorn
    from app.main import app

    host = "127.0.0.1"
    port = int(os.environ.get("YIKE_PORT", "17890"))

    print("忆刻 YiKe 后端（桌面版 API）")
    print(f"数据目录: {data_root / 'data'}")
    print(f"API 地址: http://{host}:{port}/api")
    print("关闭本进程即可停止 API 服务。")

    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
