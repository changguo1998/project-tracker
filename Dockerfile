# ===== 运行时镜像（不再构建前端）=====
# 前端由宿主机 pnpm build 产出 dist/，后端源码与静态资源通过
# docker-compose 挂载进容器 —— 改动代码后只需 pnpm build / docker compose restart，
# 不需要重新构建本镜像。
FROM node:24-alpine

ENV NODE_ENV=production

WORKDIR /app

# 后端仅依赖 express（DB 用 Node 内置 node:sqlite，无原生模块）
COPY server/package.json ./server/package.json
RUN npm install --prefix ./server --omit=dev

EXPOSE 3000
CMD ["node", "server/server.js"]
