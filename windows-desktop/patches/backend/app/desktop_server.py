"""桌面版入口：在既有 API 之上挂载前端静态资源，并注入桌面层脚本。"""
from __future__ import annotations

import os
from pathlib import Path

from fastapi import HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from starlette.staticfiles import StaticFiles

from app.main import app
from app.routers import desktop

app.include_router(desktop.router)

STATIC_DIR = Path(os.environ.get("YIKE_STATIC_DIR", "")).resolve()
WEB_DIR = Path(__file__).resolve().parent / "web"
DESKTOP_INJECT = """
<script id="yike-desktop-inject">
window.__YIKE_DESKTOP__ = true;
(function () {
  var TOKEN_KEY = "ebbinghaus_token";
  var BANNER_ID = "yike-dict-banner";

  function ensureToken() {
    if (localStorage.getItem(TOKEN_KEY)) return;
    try {
      var xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/desktop/bootstrap", false);
      xhr.setRequestHeader("Content-Type", "application/json");
      xhr.send("{}");
      if (xhr.status >= 200 && xhr.status < 300) {
        var data = JSON.parse(xhr.responseText || "{}");
        if (data.access_token) {
          localStorage.setItem(TOKEN_KEY, data.access_token);
        }
      }
    } catch (e) {}
  }

  function ensureBanner() {
    if (document.getElementById(BANNER_ID)) return;
    var bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.style.cssText = [
      "display:none",
      "position:fixed",
      "top:0",
      "left:0",
      "right:0",
      "z-index:99999",
      "background:#92400e",
      "color:#fff",
      "padding:10px 16px",
      "font:14px/1.4 Segoe UI,system-ui,sans-serif",
      "text-align:center",
      "cursor:pointer",
      "box-shadow:0 2px 8px rgba(0,0,0,.2)"
    ].join(";");
    bar.textContent = "英文词典尚未下载，点此前往下载管理";
    bar.addEventListener("click", function () {
      window.location.href = "/desktop/dictionary";
    });
    document.body.appendChild(bar);
    return bar;
  }

  function refreshDictionaryBanner() {
    fetch("/api/desktop/dictionary/status")
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) {
        if (!data || data.ready) {
          var existing = document.getElementById(BANNER_ID);
          if (existing) existing.style.display = "none";
          return;
        }
        var bar = ensureBanner();
        if (bar) bar.style.display = "block";
      })
      .catch(function () {});
  }

  ensureToken();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", refreshDictionaryBanner);
  } else {
    refreshDictionaryBanner();
  }
  setInterval(refreshDictionaryBanner, 15000);
})();
</script>
"""


def _inject_desktop_script(html: str) -> str:
    if "yike-desktop-inject" in html:
        return html
    marker = "</head>"
    if marker in html:
        return html.replace(marker, DESKTOP_INJECT + marker, 1)
    return DESKTOP_INJECT + html


def _serve_index() -> HTMLResponse:
    index_path = STATIC_DIR / "index.html"
    if not index_path.is_file():
        raise HTTPException(status_code=404, detail="index.html not found")
    html = index_path.read_text(encoding="utf-8")
    return HTMLResponse(_inject_desktop_script(html))


if STATIC_DIR.is_dir():
    assets_dir = STATIC_DIR / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def spa_root() -> HTMLResponse:
        return _serve_index()

    @app.get("/desktop/dictionary")
    async def dictionary_page() -> FileResponse:
        page = WEB_DIR / "dictionary.html"
        if not page.is_file():
            raise HTTPException(status_code=404, detail="dictionary page not found")
        return FileResponse(page)

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        if full_path.startswith("api") or full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        if full_path.startswith("desktop/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = STATIC_DIR / full_path
        if candidate.is_file():
            return FileResponse(candidate)
        return _serve_index()
