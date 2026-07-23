"""从 frontend/public/logo.png 生成 mac-desktop/assets/icon.icns。

优先使用 macOS 自带的 iconutil（质量最佳），无 iconutil 时回退 Pillow 的 ICNS 编码。
"""

from __future__ import annotations

import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

try:
    from PIL import Image
except ImportError as exc:  # pragma: no cover
    raise SystemExit("缺少 Pillow，请先 pip install Pillow") from exc


def remove_flat_black_background(img: "Image.Image") -> "Image.Image":
    """将 PNG 纯黑背景转为透明（保留圆角图标内的渐变）。"""
    rgba = img.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = pixels[x, y]
            if red == 0 and green == 0 and blue == 0:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def _generate_with_iconutil(base: "Image.Image", icns_path: Path) -> bool:
    if shutil.which("iconutil") is None:
        return False
    sizes = [16, 32, 64, 128, 256, 512]
    with tempfile.TemporaryDirectory() as tmp:
        iconset = Path(tmp) / "icon.iconset"
        iconset.mkdir(parents=True, exist_ok=True)
        for size in sizes:
            base.resize((size, size), Image.LANCZOS).save(
                iconset / f"icon_{size}x{size}.png"
            )
            base.resize((size * 2, size * 2), Image.LANCZOS).save(
                iconset / f"icon_{size}x{size}@2x.png"
            )
        try:
            subprocess.run(
                ["iconutil", "-c", "icns", str(iconset), "-o", str(icns_path)],
                check=True,
            )
            return True
        except subprocess.CalledProcessError:
            return False


def _generate_with_pillow(base: "Image.Image", icns_path: Path) -> None:
    canvas = base.resize((1024, 1024), Image.LANCZOS)
    canvas.save(
        icns_path,
        format="ICNS",
        sizes=[(16, 16), (32, 32), (64, 64), (128, 128), (256, 256), (512, 512), (1024, 1024)],
    )


def generate_icns(png_path: Path, icns_path: Path) -> None:
    if not png_path.is_file():
        raise FileNotFoundError(f"未找到 logo: {png_path}")

    icns_path.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(png_path) as img:
        base = remove_flat_black_background(img)
        width, height = base.size
        side = max(width, height)
        square = Image.new("RGBA", (side, side), (0, 0, 0, 0))
        square.paste(base, ((side - width) // 2, (side - height) // 2))

        if not _generate_with_iconutil(square, icns_path):
            _generate_with_pillow(square, icns_path)

    print(f"==> 已生成: {icns_path} ({icns_path.stat().st_size} bytes)")


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("用法: python generate_icns.py <logo.png> <icon.icns>")

    generate_icns(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    main()
