#!/bin/sh
set -e

# 以 root 启动时：修正 bind mount 挂进来的目录属主，再降权到 node 运行
# （Docker 在 Linux 上新建的宿主机目录默认属主是 root，非 root 进程写不进去）
if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/database /app/uploads
  chown -R node:node /app/database /app/uploads 2>/dev/null || true
  exec su-exec node "$@"
fi

exec "$@"
