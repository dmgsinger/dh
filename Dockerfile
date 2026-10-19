# syntax=docker/dockerfile:1

# ---------- 前端构建 ----------
FROM node:20-alpine AS frontend-builder

WORKDIR /app

COPY web/package*.json ./
RUN npm ci

COPY web/ ./
RUN npm run build

# ---------- 生产镜像 ----------
FROM node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# sqlite3 是原生模块，musl 上如果没有预编译包会现场编译，这里备好构建工具
RUN apk add --no-cache --virtual .build-deps python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force \
    && apk del .build-deps

COPY app.js config.js db.js ./
COPY routes/ ./routes/
COPY LICENSE NOTICE ./
COPY --from=frontend-builder /app/dist ./web/dist

RUN mkdir -p uploads database && chown -R node:node /app
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "app.js"]
