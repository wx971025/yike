#!/usr/bin/env bash
# 从 GitHub Release 下载 YiKeSetup.exe 到 releases/desktop/，并生成 latest.json 供桌面版镜像更新。
# 用法:
#   ./scripts/sync-desktop-release.sh              # 同步 GitHub 上 latest release
#   ./scripts/sync-desktop-release.sh v1.1.6       # 同步指定 tag
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RELEASES_DIR="$ROOT_DIR/releases/desktop"
GITHUB_REPO="wx971025/yike"
INSTALLER_NAME="YiKeSetup.exe"

usage() {
  cat <<'EOF'
用法: ./scripts/sync-desktop-release.sh [TAG]

  TAG  可选，例如 v1.1.6；省略则取 GitHub latest release。
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "错误: 需要 curl" >&2
  exit 1
fi

mkdir -p "$RELEASES_DIR"

TAG="${1:-}"
if [[ -z "$TAG" ]]; then
  echo "==> 查询 GitHub latest release..."
  TAG="$(
    curl -fsSL \
      -H "Accept: application/vnd.github+json" \
      -H "User-Agent: YiKe-Sync" \
      "https://api.github.com/repos/${GITHUB_REPO}/releases/latest" \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'])"
  )"
fi

TAG="${TAG#v}"
TAG="v${TAG}"
VERSION="${TAG#v}"
DEST_NAME="YiKeSetup-${VERSION}.exe"
DEST_PATH="$RELEASES_DIR/$DEST_NAME"
DOWNLOAD_URL="https://github.com/${GITHUB_REPO}/releases/download/${TAG}/${INSTALLER_NAME}"
NOTES_PATH="$ROOT_DIR/.github/release-notes/${TAG}.md"

echo "==> 下载 ${DOWNLOAD_URL}"
echo "    -> ${DEST_PATH}"
curl -fsSL -L -o "$DEST_PATH" "$DOWNLOAD_URL"

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

if dest.read_bytes()[:2] != b"MZ":
    raise SystemExit("错误: 下载文件不是有效的 Windows 安装包")

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

echo "==> 同步完成"
echo "    元数据: http://43.128.141.141/releases/desktop/latest.json"
echo "    安装包: http://43.128.141.141/releases/desktop/${DEST_NAME}"
