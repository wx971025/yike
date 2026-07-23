#!/usr/bin/env bash
set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PKG_DIR"

chmod +x sync-source.sh

echo "==> 忆刻 macOS 桌面版 — Linux 构建准备（不含 .app / .dmg）"
./sync-source.sh

if ! command -v npm >/dev/null 2>&1; then
  echo "错误: 未找到 npm，请先安装 Node.js 20+" >&2
  exit 1
fi

FRONTEND_DIR="$PKG_DIR/workspace/frontend"
echo "==> 构建前端..."
pushd "$FRONTEND_DIR" >/dev/null
npm ci
npm run build
popd >/dev/null

echo ""
echo "==> 准备完成。请在 macOS 上执行 ./build.sh 生成 忆刻 YiKe.app / YiKe-mac-arm64.dmg"
