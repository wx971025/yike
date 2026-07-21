#!/usr/bin/env bash
# Linux：同步 backend 到 YiKe.Backend/workspace 并应用补丁
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PKG="$(cd "$(dirname "$0")" && pwd)"
WS="$PKG/YiKe.Backend/workspace"
PATCH="$PKG/YiKe.Backend/patches/backend"

echo "==> 源项目: $ROOT"
echo "==> 工作区: $WS"

rm -rf "$WS/backend"
mkdir -p "$WS"
rsync -a --delete \
  --exclude '__pycache__' --exclude '.pytest_cache' --exclude '.venv' --exclude '*.pyc' \
  "$ROOT/backend/" "$WS/backend/"

if [[ -d "$PATCH" ]]; then
  rsync -a "$PATCH/" "$WS/backend/"
fi

echo "==> 同步完成"
