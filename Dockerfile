# ===== Stage 1: 构建前端（产出 dist/）=====
FROM node:24-alpine AS stage1

# 构建期令牌：烘焙进前端静态 bundle；轮换需改此值并重建镜像
ARG VITE_API_TOKEN
ENV VITE_API_TOKEN=$VITE_API_TOKEN

# 启用 corepack 并激活 pnpm@11（版本与 package.json 的 packageManager 字段一致）
RUN corepack enable && corepack prepare pnpm@11.1.2 --activate

WORKDIR /app

# 先复制依赖清单，利用层缓存
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# 复制源码并构建
COPY . .
RUN pnpm build

# ===== Stage 2: 运行时 =====
FROM node:24-alpine

ENV NODE_ENV=production \
    DB_PATH=/data/tracker.db \
    PORT=3000

WORKDIR /app

# server/ 自带 express 依赖，且不在根 workspace / pnpm-lock.yaml 中 —— 在运行时 phase 单独安装
COPY server/package.json ./server/package.json
RUN npm install --prefix ./server --omit=dev

# 复制构建产物与后端源码
COPY --from=stage1 /app/dist ./dist
COPY server ./server

EXPOSE 3000
VOLUME /data

CMD ["node", "server/server.js"]
