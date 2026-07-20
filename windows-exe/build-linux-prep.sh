#!/usr/bin/env bash
# Linux 上可执行的打包准备（同步源码、下载词典、构建前端）
# PyInstaller 无法交叉编译，最终 YiKe.exe 须在 Windows 上生成。
set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PKG_DIR"

echo "==> [1/3] 同步项目到 workspace/"
"$PKG_DIR/sync-source.sh"

echo ""
echo "==> [2/3] 下载 ECDICT 词典到 assets/"
"$PKG_DIR/scripts/download-ecdict.sh"

echo ""
echo "==> [3/3] 构建前端 static 文件"
if ! command -v npm >/dev/null 2>&1; then
  echo "错误: 未找到 npm，请先安装 Node.js 20+" >&2
  exit 1
fi

cd "$PKG_DIR/workspace/frontend"
npm ci
npm run build

echo ""
echo "==> Linux 侧准备完成"
echo ""
echo "接下来任选一种方式生成 YiKe.exe："
echo ""
echo "  方式 A — 找一台 Windows 电脑（推荐）"
echo "    1. 把整个 windows-exe/ 目录拷过去（含 workspace/ 与 assets/ecdict.db）"
echo "    2. 安装 Python 3.11 + Node.js（Node 仅 build.ps1 会再用一次，可跳过若已构建 frontend）"
echo "    3. 在 windows-exe 目录执行:  .\\build.ps1"
echo "    或仅打 exe（前端已构建时）:"
echo "       python -m venv .venv && .venv\\Scripts\\pip install -r requirements-build.txt"
echo "       .venv\\Scripts\\pyinstaller launcher\\yike.spec --distpath output --workpath build -y"
echo ""
echo "  方式 B — GitHub Actions（本机是 Linux 也可用）"
echo "    推送代码后 Actions 页手动运行「Build Windows EXE」，下载产物"
echo "    见 README.md「在 Linux 服务器上打包」章节"
echo ""
