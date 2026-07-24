# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 配置：onedir 内含前端 dist + 后端 app + tzdata + pywebview 依赖。"""

import os
from pathlib import Path

import tzdata
from PyInstaller.utils.hooks import collect_all

block_cipher = None

ROOT = Path(SPECPATH)
PKG = ROOT.parent
WORKSPACE = PKG / "workspace"

_WIN10_SYSTEM_DLLS = frozenset(
    {
        "ucrtbase.dll",
        "ucrtbase_enclave.dll",
    }
)


def _should_skip_win10_system_dll(path: str) -> bool:
    """Windows 10+ 强制使用系统 UCRT，无需（也不应）打进 _internal。"""
    name = os.path.basename(path).lower()
    if name in _WIN10_SYSTEM_DLLS:
        return True
    return name.startswith("api-ms-win-crt") or name.startswith("api-ms-win-core")


def _filter_binaries(items):
    return [item for item in items if not _should_skip_win10_system_dll(item[0])]

backend_app = WORKSPACE / "backend" / "app"
frontend_dist = WORKSPACE / "frontend" / "dist"
tzdata_zoneinfo = Path(tzdata.__file__).resolve().parent / "zoneinfo"

if not backend_app.is_dir():
    raise SystemExit(f"缺少 backend，请先 sync-source: {backend_app}")
if not frontend_dist.is_dir():
    raise SystemExit(f"缺少 frontend/dist，请先 npm run build: {frontend_dist}")
if not tzdata_zoneinfo.is_dir():
    raise SystemExit("缺少 tzdata 时区数据，请 pip install tzdata")

version_json = ROOT / "version.json"
if not version_json.is_file():
    raise SystemExit(f"缺少 version.json，请先运行 build.ps1: {version_json}")

datas = [
    (str(frontend_dist), "frontend_dist"),
    (str(backend_app), "app"),
    (str(tzdata_zoneinfo), "tzdata"),
    (str(version_json), "."),
]
binaries = []
hiddenimports = [
    "app.main",
    "app.desktop_server",
    "app.database",
    "app.config",
    "app.models",
    "app.migrations",
    "app.middleware.ip_log",
    "app.routers.auth",
    "app.routers.ai",
    "app.routers.ai_configs",
    "app.routers.groups",
    "app.routers.items",
    "app.routers.words",
    "app.routers.calendar",
    "app.routers.confusable_pairs",
    "app.routers.dictionary",
    "app.routers.desktop",
    "app.routers.data_transfer",
    "app.routers.skills",
    "app.services.dict_setup",
    "app.services.dictionary",
    "app.services.ai_chat",
    "app.services.ai_tools",
    "app.services.ai_config_store",
    "app.services.memory_schedule",
    "app.services.group_category",
    "app.services.group_color",
    "app.services.review",
    "app.services.word_review_track",
    "app.services.word_daily_batch",
    "passlib.handlers.bcrypt",
    "bcrypt",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "multipart",
    "jose.jwt",
    "httpx",
    "sqlalchemy.ext.baked",
    "tzdata",
    "zoneinfo",
]

# 完整收集 pywebview 及其原生依赖（WebView2 / pythonnet / clr_loader）
for pkg in ("webview", "clr_loader", "pythonnet", "pystray"):
    try:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_binaries
        hiddenimports += pkg_hidden
    except Exception as exc:  # noqa: BLE001
        print(f"[yike.spec] collect_all({pkg!r}) 跳过: {exc}")

a = Analysis(
    [str(ROOT / "entry.py")],
    pathex=[str(WORKSPACE / "backend")],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

a.binaries = _filter_binaries(a.binaries)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="YiKe",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=str(PKG / "assets" / "icon.ico") if (PKG / "assets" / "icon.ico").is_file() else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=False,
    upx_exclude=[],
    name="YiKe",
)
