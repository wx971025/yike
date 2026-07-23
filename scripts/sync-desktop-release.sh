#!/usr/bin/env bash
# 从 GitHub Release 下载 YiKeSetup.exe 到 releases/desktop/，并生成 latest.json 供桌面版镜像更新。
# 用法:
#   ./scripts/sync-desktop-release.sh v1.1.8
# 或项目根目录:
#   ./get_releases.sh v1.1.8
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASES_DIR="$ROOT_DIR/releases/desktop"
GITHUB_REPO="wx971025/yike"
INSTALLER_NAME="YiKeSetup.exe"
CURL_CONNECT_TIMEOUT="${CURL_CONNECT_TIMEOUT:-15}"
CURL_MAX_TIME="${CURL_MAX_TIME:-600}"

usage() {
  cat <<'EOF'
用法: ./scripts/sync-desktop-release.sh <TAG>

  TAG  必填，例如 v1.1.8 或 1.1.8
EOF
}

die_network() {
  echo "失败: 网络问题，无法访问 GitHub" >&2
  echo "  $*" >&2
  echo "  请检查服务器网络、DNS、代理或防火墙后重试。" >&2
  exit 2
}

die_not_found() {
  echo "失败: 版本不存在" >&2
  echo "  $*" >&2
  exit 3
}

die_other() {
  echo "失败: $*" >&2
  exit 4
}

normalize_tag() {
  local raw="${1#v}"
  raw="${raw#V}"
  if [[ ! "$raw" =~ ^[0-9]+(\.[0-9]+)*(-[0-9A-Za-z.]+)?$ ]]; then
    die_other "版本号格式无效: $1（示例: v1.1.8 或 1.1.8）"
  fi
  echo "v${raw}"
}

curl_github() {
  local url=$1
  local body_file=$2
  local err_file
  err_file="$(mktemp)"
  local http_code

  if ! http_code="$(
    curl -sS -o "$body_file" -w "%{http_code}" \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      -H "Accept: application/vnd.github+json" \
      -H "User-Agent: YiKe-Sync" \
      "$url" 2>"$err_file"
  )"; then
    local err_msg
    err_msg="$(tr '\n' ' ' <"$err_file" | sed 's/  */ /g')"
    rm -f "$err_file"
    die_network "${err_msg:-curl 执行失败}"
  fi
  rm -f "$err_file"
  echo "$http_code"
}

assert_release_exists() {
  local tag=$1
  local api_url="https://api.github.com/repos/${GITHUB_REPO}/releases/tags/${tag}"
  local body_file
  body_file="$(mktemp)"

  local http_code
  http_code="$(curl_github "$api_url" "$body_file")"

  if [[ "$http_code" == "404" ]]; then
    rm -f "$body_file"
    die_not_found "GitHub 上未找到 Release「${tag}」。请确认已 push tag 且 CI 已成功发布。"
  fi

  if [[ "$http_code" != "200" ]]; then
    local detail
    detail="$(python3 - "$body_file" <<'PY'
import json, sys
try:
    data = json.load(open(sys.argv[1], encoding="utf-8"))
    print(data.get("message") or str(data)[:200])
except Exception:
    print(open(sys.argv[1], encoding="utf-8").read()[:200])
PY
)"
    rm -f "$body_file"
    if [[ "$http_code" == "403" ]]; then
      die_network "GitHub API 返回 403（可能被限流）: ${detail}"
    fi
    die_other "查询 Release 失败（HTTP ${http_code}）: ${detail}"
  fi

  if ! python3 - "$body_file" "$INSTALLER_NAME" <<'PY'
import json
import sys

body_path, installer_name = sys.argv[1], sys.argv[2]
data = json.load(open(body_path, encoding="utf-8"))
assets = data.get("assets") or []
names = [a.get("name") for a in assets if isinstance(a, dict)]
if installer_name not in names:
    print(
        f"Release {data.get('tag_name', '?')} 存在，但未上传 {installer_name}。"
        f" 已上传资源: {', '.join(n for n in names if n) or '（无）'}",
        file=sys.stderr,
    )
    sys.exit(1)
PY
  then
    rm -f "$body_file"
    die_not_found "Release「${tag}」存在，但未找到安装包 ${INSTALLER_NAME}。请等待 CI 构建完成。"
  fi

  rm -f "$body_file"
}

download_installer() {
  local url=$1
  local dest=$2
  local err_file
  err_file="$(mktemp)"
  local http_code

  if ! http_code="$(
    curl -sS -L -o "$dest" -w "%{http_code}" \
      --connect-timeout "$CURL_CONNECT_TIMEOUT" \
      --max-time "$CURL_MAX_TIME" \
      -H "User-Agent: YiKe-Sync" \
      "$url" 2>"$err_file"
  )"; then
    rm -f "$dest" "$err_file"
    die_network "$(tr '\n' ' ' <"$err_file" | sed 's/  */ /g')"
  fi
  rm -f "$err_file"

  if [[ "$http_code" == "404" ]]; then
    rm -f "$dest"
    die_not_found "下载地址返回 404: ${url}"
  fi

  if [[ "$http_code" != "200" ]]; then
    rm -f "$dest"
    die_other "下载失败（HTTP ${http_code}）: ${url}"
  fi

  if [[ ! -s "$dest" ]]; then
    rm -f "$dest"
    die_other "下载结果为空文件"
  fi

  if ! python3 - "$dest" <<'PY'
import sys
from pathlib import Path

path = Path(sys.argv[1])
sys.exit(0 if path.read_bytes()[:2] == b"MZ" else 1)
PY
  then
    rm -f "$dest"
    die_other "下载内容不是有效的 Windows 安装包（缺少 PE 文件头）"
  fi
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ -z "${1:-}" ]]; then
  echo "错误: 请传入版本号" >&2
  usage >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  die_other "未找到 curl 命令"
fi

if ! command -v python3 >/dev/null 2>&1; then
  die_other "未找到 python3 命令"
fi

TAG="$(normalize_tag "$1")"
VERSION="${TAG#v}"
DEST_NAME="YiKeSetup-${VERSION}.exe"
DEST_PATH="$RELEASES_DIR/$DEST_NAME"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${TAG}/${INSTALLER_NAME}"
NOTES_PATH="$ROOT_DIR/.github/release-notes/${TAG}.md"

mkdir -p "$RELEASES_DIR"

echo "==> 检查 Release ${TAG} ..."
assert_release_exists "$TAG"

echo "==> 下载 ${DOWNLOAD_URL}"
echo "    -> ${DEST_PATH}"
download_installer "$DOWNLOAD_URL" "$DEST_PATH"

python3 - "$DEST_PATH" "$RELEASES_DIR/latest.json" "$VERSION" "$TAG" "$DEST_NAME" "$NOTES_PATH" <<'PY'
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

dest = Path(sys.argv[1])
meta_path = Path(sys.argv[2])
version = sys.argv[3]
tag = sys.argv[4]
filename = sys.argv[5]
notes_path = Path(sys.argv[6])

release_notes = ""
if notes_path.is_file():
    release_notes = notes_path.read_text(encoding="utf-8")[:4000]

data = dest.read_bytes()
meta = {
    "version": version,
    "tag": tag,
    "filename": filename,
    "size": dest.stat().st_size,
    "sha256": hashlib.sha256(data).hexdigest(),
    "download_url": f"/releases/desktop/{filename}",
    "release_notes": release_notes,
    "updated_at": datetime.now(timezone.utc).isoformat(),
}
meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"==> 已写入 {meta_path}")
print(f"    version={version} size={meta['size']} sha256={meta['sha256'][:16]}...")
PY

echo
echo "成功: 已同步 ${TAG} 到 releases/desktop/"
echo "  元数据: http://43.128.141.141/releases/desktop/latest.json"
echo "  安装包: http://43.128.141.141/releases/desktop/${DEST_NAME}"
