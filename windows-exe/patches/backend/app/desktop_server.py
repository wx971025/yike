"""桌面版入口：在既有 API 之上挂载前端静态资源（仅 Windows exe 构建使用）。"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse
from starlette.staticfiles import StaticFiles

from app.main import app

STATIC_DIR = Path(os.environ.get("YIKE_STATIC_DIR", "")).resolve()

if STATIC_DIR.is_dir():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def spa_root() -> FileResponse:
        return FileResponse(STATIC_DIR / "index.html")

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str) -> FileResponse:
        if full_path.startswith("api") or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = STATIC_DIR / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(STATIC_DIR / "index.html")
