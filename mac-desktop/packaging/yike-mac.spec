# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 配置（macOS）：onedir + BUNDLE(.app)，内含前端 dist + 后端 app + tzdata + pywebview(cocoa) 依赖。"""

import json
from pathlib import Path

import tzdata
from PyInstaller.utils.hooks import collect_all

block_cipher = None

ROOT = Path(SPECPATH)              # mac-desktop/packaging
PKG = ROOT.parent                 # mac-desktop
WORKSPACE = PKG / "workspace"

backend_app = WORKSPACE / "backend" / "app"
frontend_dist = WORKSPACE / "frontend" / "dist"
tzdata_zoneinfo = Path(tzdata.__file__).resolve().parent / "zoneinfo"
version_json = PKG / "launcher" / "version.json"
icon_icns = PKG / "assets" / "icon.icns"

if not backend_app.is_dir():
    raise SystemExit(f"缺少 backend，请先 sync-source: {backend_app}")
if not frontend_dist.is_dir():
    raise SystemExit(f"缺少 frontend/dist，请先 npm run build: {frontend_dist}")
if not tzdata_zoneinfo.is_dir():
    raise SystemExit("缺少 tzdata 时区数据，请 pip install tzdata")
if not version_json.is_file():
    raise SystemExit(f"缺少 version.json，请先运行 build.sh: {version_json}")

try:
    _version_data = json.loads(version_json.read_text(encoding="utf-8"))
    APP_VERSION = str(_version_data.get("version") or "0.0.0").lstrip("vV") or "0.0.0"
except Exception:
    APP_VERSION = "0.0.0"

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
    "certifi",
    "sqlalchemy.ext.baked",
    "tzdata",
    "zoneinfo",
    # pywebview cocoa 后端依赖（pyobjc）
    "objc",
    "Foundation",
    "AppKit",
    "WebKit",
    "Quartz",
    "CoreFoundation",
    "Security",
    "PyObjCTools",
]

# 完整收集 pywebview 及其 cocoa/pyobjc 原生依赖，以及 certifi 的 CA 证书包
for pkg in ("webview", "objc", "WebKit", "AppKit", "Foundation", "Quartz", "Security", "certifi"):
    try:
        pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
        datas += pkg_datas
        binaries += pkg_binaries
        hiddenimports += pkg_hidden
    except Exception as exc:  # noqa: BLE001
        print(f"[yike-mac.spec] collect_all({pkg!r}) 跳过: {exc}")

a = Analysis(
    [str(PKG / "launcher" / "entry.py")],
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

app = BUNDLE(
    coll,
    name="忆刻 YiKe.app",
    icon=str(icon_icns) if icon_icns.is_file() else None,
    bundle_identifier="online.my-yike.desktop",
    version=APP_VERSION,
    info_plist={
        "CFBundleName": "忆刻 YiKe",
        "CFBundleDisplayName": "忆刻 YiKe",
        "CFBundleShortVersionString": APP_VERSION,
        "CFBundleVersion": APP_VERSION,
        "NSHighResolutionCapable": True,
        "LSMinimumSystemVersion": "12.0",
        "NSRequiresAquaSystemAppearance": False,
    },
)
