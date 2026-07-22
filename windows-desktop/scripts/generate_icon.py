"""从 frontend/public/logo.png 生成 windows-desktop/assets/icon.ico。"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("缺少 Pillow，请先 pip install Pillow") from exc


def generate_icon(png_path: Path, ico_path: Path) -> None:
    if not png_path.is_file():
        raise FileNotFoundError(f"未找到 logo: {png_path}")

    with Image.open(png_path) as img:
        rgba = img.convert("RGBA")
        sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
        ico_path.parent.mkdir(parents=True, exist_ok=True)
        rgba.save(ico_path, format="ICO", sizes=sizes)
    print(f"==> 已生成: {ico_path} ({ico_path.stat().st_size} bytes)")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("用法: python generate_icon.py <logo.png> <icon.ico>")

    generate_icon(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
