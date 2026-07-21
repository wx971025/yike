#!/usr/bin/env bash
# Linux 构建准备：下载 ECDICT 到 assets/ecdict.db
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ASSETS="$ROOT/assets"
DB="$ASSETS/ecdict.db"
URL="https://github.com/skywind3000/ECDICT/releases/download/1.0.28/ecdict-sqlite-28.zip"
MIN_BYTES=50000000

mkdir -p "$ASSETS"

if [[ -f "$DB" ]] && [[ $(stat -c%s "$DB") -ge $MIN_BYTES ]]; then
  echo "==> 内置词典已存在: $DB"
  exit 0
fi

echo "==> 下载 ECDICT 词典（约 200MB）…"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "$URL" -o "$TMP/ecdict.zip"
unzip -q "$TMP/ecdict.zip" -d "$TMP"
DBFILE=$(find "$TMP" -name '*.db' | head -1)
if [[ -z "$DBFILE" ]]; then
  echo "压缩包内未找到 .db 文件" >&2
  exit 1
fi
cp "$DBFILE" "$DB"
echo "==> 已保存: $DB"
