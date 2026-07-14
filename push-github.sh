#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

REMOTE="${REMOTE:-origin}"
BRANCH="${BRANCH:-main}"
COMMIT_MSG="${1:-}"

usage() {
  cat <<EOF
用法: ./push-github.sh [提交说明]

将当前仓库推送到 GitHub 的 ${BRANCH} 分支。

  无参数    工作区干净时直接推送；有未提交改动则提示先写提交说明
  有参数    暂存并提交所有改动，再推送到 ${REMOTE}/${BRANCH}

环境变量:
  REMOTE=origin   远程仓库名（默认 origin）
  BRANCH=main     目标分支（默认 main）

示例:
  ./push-github.sh
  ./push-github.sh "feat: 优化单词复习体验"
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v git >/dev/null 2>&1; then
  echo "错误: 未找到 git 命令" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "错误: 当前目录不是 Git 仓库" >&2
  exit 1
fi

if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  echo "错误: 未配置远程仓库 \"$REMOTE\"" >&2
  exit 1
fi

CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$BRANCH" ]]; then
  echo "错误: 当前分支为 \"$CURRENT_BRANCH\"，请切换到 \"$BRANCH\" 后再推送" >&2
  exit 1
fi

if git diff --cached --name-only | grep -qx '\.env'; then
  echo "错误: .env 已被暂存，请勿提交敏感配置" >&2
  exit 1
fi

if [[ -n "$(git status --porcelain)" ]]; then
  if [[ -z "$COMMIT_MSG" ]]; then
    echo "错误: 存在未提交的改动，请提供提交说明：" >&2
    echo >&2
    git status --short >&2
    echo >&2
    usage >&2
    exit 1
  fi

  echo "==> 待提交改动:"
  git status --short
  echo

  git add -A

  if git diff --cached --name-only | grep -qx '\.env'; then
    echo "错误: 检测到 .env 将被提交，已中止" >&2
    git reset HEAD -- .env >/dev/null 2>&1 || true
    exit 1
  fi

  echo "==> 创建提交"
  git commit -m "$COMMIT_MSG"
fi

if ! git rev-parse --verify "$REMOTE/$BRANCH" >/dev/null 2>&1; then
  echo "==> 首次推送到 ${REMOTE}/${BRANCH}"
  git push -u "$REMOTE" "$BRANCH"
else
  LOCAL_SHA="$(git rev-parse HEAD)"
  REMOTE_SHA="$(git rev-parse "$REMOTE/$BRANCH")"

  if [[ "$LOCAL_SHA" == "$REMOTE_SHA" ]]; then
    echo "==> 本地与 ${REMOTE}/${BRANCH} 已同步，无需推送"
    exit 0
  fi

  if ! git merge-base --is-ancestor "$REMOTE_SHA" "$LOCAL_SHA"; then
    echo "错误: 本地分支与 ${REMOTE}/${BRANCH} 已分叉，请先 pull 或 rebase" >&2
    exit 1
  fi

  echo "==> 推送到 ${REMOTE}/${BRANCH}"
  git push "$REMOTE" "$BRANCH"
fi

echo
echo "==> 推送完成"
git log -1 --oneline
echo "==> 远程: $(git remote get-url "$REMOTE")"
