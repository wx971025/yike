#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

SERVICE="${1:-all}"

usage() {
  cat <<'EOF'
用法: ./deploy.sh [all|frontend|backend]

  all       重新构建并部署前后端（默认）
  frontend  仅重新构建并部署前端
  backend   仅重新构建并部署后端
EOF
}

if [[ "$SERVICE" == "-h" || "$SERVICE" == "--help" ]]; then
  usage
  exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "错误: 未找到 docker 命令" >&2
  exit 1
fi

if [[ ! -f "$ROOT_DIR/docker-compose.yml" ]]; then
  echo "错误: 未找到 docker-compose.yml" >&2
  exit 1
fi

echo "==> 项目目录: $ROOT_DIR"
echo "==> 开始重新部署: $SERVICE"

case "$SERVICE" in
  all)
    docker compose up --build -d
    ;;
  frontend|backend)
    docker compose up --build -d "$SERVICE"
    ;;
  *)
    echo "错误: 未知服务 \"$SERVICE\"" >&2
    usage
    exit 1
    ;;
esac

echo
echo "==> 部署完成，容器状态:"
docker compose ps

echo
echo "==> 访问地址: http://localhost:10001"
