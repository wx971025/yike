# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 配置：YiKeBackend.exe — 仅 API + ECDICT，不含前端静态页。"""

from pathlib import Path

import tzdata

block_cipher = None

ROOT = Path(SPECPATH)
PKG = ROOT.parent
WORKSPACE = PKG / "workspace"
ASSETS = PKG.parent / "assets"

backend_app = WORKSPACE / "backend" / "app"
bundled_dict = ASSETS / "ecdict.db"
tzdata_zoneinfo = Path(tzdata.__file__).resolve().parent / "zoneinfo"

if not backend_app.is_dir():
    raise SystemExit(f"缺少 backend，请先 sync-source: {backend_app}")
if not bundled_dict.is_file():
    raise SystemExit(
        f"缺少内置词典 {bundled_dict}\n"
        "请先运行 scripts/download-ecdict.ps1（构建机联网一次即可）"
    )
if not tzdata_zoneinfo.is_dir():
    raise SystemExit("缺少 tzdata 时区数据，请 pip install tzdata")

datas = [
    (str(backend_app), "app"),
    (str(bundled_dict), "bundled_data"),
    (str(tzdata_zoneinfo), "tzdata"),
]

a = Analysis(
    [str(ROOT / "entry.py")],
    pathex=[str(WORKSPACE / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=[
        "app.main",
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
        "app.routers.reminders",
        "app.routers.calendar",
        "app.routers.confusable_pairs",
        "app.routers.dictionary",
        "app.routers.skills",
        "app.services.dict_setup",
        "app.services.dictionary",
        "app.services.ai_chat",
        "app.services.ai_tools",
        "app.services.ai_config_store",
        "app.services.memory_schedule",
        "app.services.reminder_schedule",
        "app.services.reminder_mode",
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
        "sqlalchemy.ext.baked",
        "tzdata",
        "zoneinfo",
    ],
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
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="YiKeBackend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
