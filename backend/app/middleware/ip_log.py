import threading
from pathlib import Path

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from ..config import IP_LOG_PATH

_lock = threading.Lock()


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    real_ip = request.headers.get("x-real-ip")
    if real_ip:
        return real_ip.strip()
    if request.client:
        return request.client.host
    return "unknown"


def append_ip(ip: str) -> None:
    path = Path(IP_LOG_PATH)
    path.parent.mkdir(parents=True, exist_ok=True)
    with _lock:
        with path.open("a", encoding="utf-8") as file:
            file.write(f"{ip}\n")


class IpLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        if request.url.path != "/api/health":
            append_ip(get_client_ip(request))
        return await call_next(request)
