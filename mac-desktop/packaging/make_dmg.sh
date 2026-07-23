#!/usr/bin/env bash
set -euo pipefail

# 用法: make_dmg.sh <app_path> <dmg_out_path> [volname]
APP_PATH="${1:?需要 .app 路径}"
DMG_OUT="${2:?需要输出 .dmg 路径}"
VOLNAME="${3:-忆刻 YiKe}"

if [[ ! -d "$APP_PATH" ]]; then
  echo "错误: 未找到 .app: $APP_PATH" >&2
  exit 1
fi

if ! command -v hdiutil >/dev/null 2>&1; then
  echo "错误: 未找到 hdiutil（仅 macOS 可用）" >&2
  exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

echo "==> 准备 DMG 内容: $STAGE"
cp -R "$APP_PATH" "$STAGE/"
ln -s /Applications "$STAGE/Applications"

mkdir -p "$(dirname "$DMG_OUT")"
rm -f "$DMG_OUT"

echo "==> 生成 DMG: $DMG_OUT"
hdiutil create \
  -volname "$VOLNAME" \
  -srcfolder "$STAGE" \
  -fs HFS+ \
  -format UDZO \
  -ov \
  "$DMG_OUT"

echo "==> DMG 完成: $DMG_OUT"
