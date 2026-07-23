#!/usr/bin/env bash
# 从 GitHub Release 拉取指定版本安装包到 releases/desktop/（供服务器镜像更新）
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  cat <<'EOF'
用法: ./get_releases.sh <版本号>

  下载指定版本的 YiKeSetup.exe 到 releases/desktop/，并更新 latest.json。

  参数:
    版本号  必填，例如 v1.1.8 或 1.1.8

  示例:
    ./get_releases.sh v1.1.8
    ./get_releases.sh 1.1.8

  退出码:
    0  成功
    1  参数错误
    2  网络问题（无法连接 GitHub）
    3  版本不存在（Release 或安装包缺失）
    4  其他错误（文件损坏等）
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${1:-}" ]]; then
  echo "错误: 请传入版本号" >&2
  echo >&2
  usage >&2
  exit 1
fi

exec "$ROOT_DIR/scripts/sync-desktop-release.sh" "$1"
