#!/usr/bin/env bash
set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="${YIKE_SOURCE_ROOT:-$(cd "$PKG_DIR/.." && pwd)}"
WS="$PKG_DIR/workspace"

echo "==> 源项目: $ROOT_DIR"
echo "==> 工作区: $WS"

if [[ ! -d "$ROOT_DIR/backend" || ! -d "$ROOT_DIR/frontend" ]]; then
  echo "错误: 在 $ROOT_DIR 下未找到 backend/ 与 frontend/。" >&2
  echo "      请确保 mac-desktop 与 backend/frontend 同级，或设置 YIKE_SOURCE_ROOT。" >&2
  exit 1
fi

rm -rf "$WS/backend" "$WS/frontend"
mkdir -p "$WS"

rsync -a --delete \
  --exclude '__pycache__' \
  --exclude '.pytest_cache' \
  --exclude '*.pyc' \
  "$ROOT_DIR/backend/" "$WS/backend/"

rsync -a --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude '.vite' \
  --exclude '*.tsbuildinfo' \
  "$ROOT_DIR/frontend/" "$WS/frontend/"

if [[ -d "$PKG_DIR/patches/backend" ]]; then
  rsync -a "$PKG_DIR/patches/backend/" "$WS/backend/"
fi

echo "==> 同步完成"
