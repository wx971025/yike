#!/usr/bin/env bash
# 下载 ECDICT 词典到 assets/ecdict.db（打包时嵌入 exe，运行时完全离线）
set -euo pipefail

PKG_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ASSETS="$PKG_DIR/assets"
DB="$ASSETS/ecdict.db"
URL="https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip"
MIN_BYTES=50000000

mkdir -p "$ASSETS"

if [[ -f "$DB" ]] && [[ "$(stat -c%s "$DB")" -ge "$MIN_BYTES" ]]; then
  echo "==> 内置词典已存在: $DB ($(du -h "$DB" | cut -f1))"
  exit 0
fi

echo "==> 下载 ECDICT 词典（约 200MB），仅构建时需要联网一次…"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$URL" -o "$TMP/ecdict.zip"
unzip -q "$TMP/ecdict.zip" -d "$TMP"
DB_FILE="$(find "$TMP" -name '*.db' | head -1)"
if [[ -z "$DB_FILE" ]]; then
  echo "错误: 压缩包内未找到 .db 文件" >&2
  exit 1
fi
cp "$DB_FILE" "$DB"
echo "==> 已保存: $DB ($(du -h "$DB" | cut -f1))"
