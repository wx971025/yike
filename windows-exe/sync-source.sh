#!/usr/bin/env bash
# 从上级项目同步源码到 windows-exe/workspace，并打入桌面版补丁。
set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$PKG_DIR/.." && pwd)"
WS="$PKG_DIR/workspace"

echo "==> 源项目: $ROOT_DIR"
echo "==> 工作区: $WS"

rm -rf "$WS/backend" "$WS/frontend"
mkdir -p "$WS"

rsync -a \
  --exclude __pycache__ \
  --exclude .pytest_cache \
  --exclude '*.pyc' \
  "$ROOT_DIR/backend/" "$WS/backend/"

rsync -a \
  --exclude node_modules \
  --exclude dist \
  --exclude .vite \
  --exclude '*.tsbuildinfo' \
  "$ROOT_DIR/frontend/" "$WS/frontend/"

if [[ -d "$PKG_DIR/patches/backend" ]]; then
  rsync -a "$PKG_DIR/patches/backend/" "$WS/backend/"
fi

if [[ -d "$PKG_DIR/patches/frontend" ]]; then
  rsync -a "$PKG_DIR/patches/frontend/" "$WS/frontend/"
fi

echo "==> 同步完成"
echo "    backend: $WS/backend"
echo "    frontend: $WS/frontend"
