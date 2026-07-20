# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller 配置：单 exe 内含前端 dist + 后端 + ECDICT 词典。"""

from pathlib import Path

block_cipher = None

ROOT = Path(SPECPATH)
PKG = ROOT.parent
WORKSPACE = PKG / "workspace"
ASSETS = PKG / "assets"

backend_app = WORKSPACE / "backend" / "app"
frontend_dist = WORKSPACE / "frontend" / "dist"
bundled_dict = ASSETS / "ecdict.db"

if not backend_app.is_dir():
    raise SystemExit(f"缺少 backend，请先 sync-source: {backend_app}")
if not frontend_dist.is_dir():
    raise SystemExit(f"缺少 frontend/dist，请先 npm run build: {frontend_dist}")
if not bundled_dict.is_file():
    raise SystemExit(
        f"缺少内置词典 {bundled_dict}\n"
        "请先运行 scripts/download-ecdict.ps1（构建机联网一次即可）"
    )

datas = [
    (str(frontend_dist), "frontend_dist"),
    (str(backend_app), "app"),
    (str(bundled_dict), "bundled_data"),
]

a = Analysis(
    [str(ROOT / "entry.py")],
    pathex=[str(WORKSPACE / "backend")],
    binaries=[],
    datas=datas,
    hiddenimports=[
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
    name="YiKe",
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
