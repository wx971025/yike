#!/usr/bin/env bash
set -euo pipefail

# 忆刻 macOS 桌面版构建
# 用法:
#   ./build.sh
#   ./build.sh --version 1.2.0
#   ./build.sh --skip-sync
#   YIKE_SOURCE_ROOT=/path/to/repo ./build.sh

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PKG_DIR"

APP_VERSION=""
SKIP_SYNC=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)
      APP_VERSION="${2:-}"
      shift 2
      ;;
    --skip-sync)
      SKIP_SYNC=1
      shift
      ;;
    *)
      echo "未知参数: $1" >&2
      exit 1
      ;;
  esac
done

echo "==> 忆刻 macOS 桌面版构建"
echo "==> 工作目录: $PKG_DIR"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "错误: build.sh 必须在 macOS 上运行（需要 hdiutil / codesign / iconutil）。" >&2
  echo "      Linux 上请改用 ./build-linux-prep.sh 做源同步与前端构建。" >&2
  exit 1
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "错误: 未找到命令 $1，请先安装并加入 PATH。" >&2
    exit 1
  fi
}

require_cmd python3
require_cmd npm

VERSION_JSON="$PKG_DIR/launcher/version.json"

# 版本号：优先命令行参数，其次 launcher/version.json
if [[ -z "$APP_VERSION" && -f "$VERSION_JSON" ]]; then
  APP_VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("version",""))' "$VERSION_JSON" 2>/dev/null || true)"
fi
APP_VERSION="${APP_VERSION#v}"
APP_VERSION="${APP_VERSION#V}"
if [[ -z "$APP_VERSION" ]]; then
  APP_VERSION="1.0.0"
fi
echo "==> 版本号: $APP_VERSION"

printf '{"version": "%s"}\n' "$APP_VERSION" > "$VERSION_JSON"
echo "==> 已写入 $VERSION_JSON"

# 1) 同步源码 + 套 patches
if [[ "$SKIP_SYNC" -eq 0 ]]; then
  chmod +x sync-source.sh
  ./sync-source.sh
else
  echo "==> 跳过 sync-source"
fi

WORKSPACE="$PKG_DIR/workspace"
FRONTEND_DIR="$WORKSPACE/frontend"
LOGO_PNG="$FRONTEND_DIR/public/logo.png"

if [[ ! -f "$LOGO_PNG" ]]; then
  echo "错误: 未找到 $LOGO_PNG，无法生成应用图标。" >&2
  exit 1
fi

# 2) 构建前端
echo "==> 构建前端..."
pushd "$FRONTEND_DIR" >/dev/null
npm ci
npm run build
popd >/dev/null

# 3) Python 虚拟环境 + 构建依赖
VENV="$PKG_DIR/.venv"
if [[ ! -d "$VENV" ]]; then
  echo "==> 创建 Python 虚拟环境..."
  python3 -m venv "$VENV"
fi
PY="$VENV/bin/python"
PIP="$VENV/bin/pip"

echo "==> 安装构建依赖..."
"$PIP" install --upgrade pip
"$PIP" install -r "$PKG_DIR/requirements-build.txt"

# 4) 生成 icns
echo "==> 从 logo.png 生成 icon.icns ..."
ICON_ICNS="$PKG_DIR/assets/icon.icns"
"$PY" "$PKG_DIR/scripts/generate_icns.py" "$LOGO_PNG" "$ICON_ICNS"

# 5) PyInstaller 打包 .app
STAGE_DIR="$PKG_DIR/output/stage"
BUILD_DIR="$PKG_DIR/build"
rm -rf "$STAGE_DIR" "$BUILD_DIR"
mkdir -p "$STAGE_DIR"

echo "==> PyInstaller 打包 .app ..."
"$VENV/bin/pyinstaller" "$PKG_DIR/packaging/yike-mac.spec" \
  --distpath "$STAGE_DIR" \
  --workpath "$BUILD_DIR" \
  --clean \
  --noconfirm

APP_PATH="$STAGE_DIR/忆刻 YiKe.app"
if [[ ! -d "$APP_PATH" ]]; then
  echo "错误: 打包失败，未找到 $APP_PATH" >&2
  exit 1
fi

# 6) Ad-hoc 签名（规避 arm64 未签名"已损坏"提示）
echo "==> Ad-hoc 代码签名 ..."
codesign --force --deep --sign - "$APP_PATH" || \
  echo "警告: ad-hoc 签名失败，应用仍可用，但首次打开可能需要右键 → 打开。"

# 7) 拷贝 .app 到 output，并生成 dmg
OUTPUT_DIR="$PKG_DIR/output"
FINAL_APP="$OUTPUT_DIR/忆刻 YiKe.app"
rm -rf "$FINAL_APP"
cp -R "$APP_PATH" "$FINAL_APP"

DMG_OUT="$OUTPUT_DIR/YiKe-mac-arm64.dmg"
chmod +x "$PKG_DIR/packaging/make_dmg.sh"
"$PKG_DIR/packaging/make_dmg.sh" "$FINAL_APP" "$DMG_OUT" "忆刻 YiKe"

echo ""
echo "==> 完成"
echo "    App: $FINAL_APP"
echo "    DMG: $DMG_OUT"
