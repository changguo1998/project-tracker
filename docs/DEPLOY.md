# 部署指南（Docker / 云服务器）

> **本机无 docker 环境，本文所有命令均为 `[待回填]` —— 待有 docker 环境实测通过后由维护者回填为实测命令，使用前请自行核对命令可用性。**

## 架构概览

`docker compose up` 启动单个容器：`node server/server.js` 同时承担静态托管（`dist/`，即前端构建产物）与 `/api/*` REST 服务；SQLite 数据文件落在宿主机 `./server/data/tracker.db`（挂载到容器 `/data`），重启不丢。宿主机 `8080` 端口对外映射到容器 `3000`。

## 1. 安装 Docker [待回填]

Ubuntu/Debian 一键安装：

```bash
curl -fsSL https://get.docker.com | sh       # [待回填]
sudo systemctl enable --now docker          # [待回填]
docker --version                            # [待回填] 验证安装
```

> 云服务器厂商（阿里云/腾讯云/AWS 等）的镜像市场一般也提供预装 Docker 的系统镜像，可省去本步。

## 2. 拉取代码并进入项目根目录 [待回填]

```bash
git clone <你的仓库地址> project-tracker     # [待回填]
cd project-tracker                          # [待回填]
```

## 3. 编写 .env（两个令牌）

从模板复制，然后填入**同一个**足够长的随机串，两个变量取值必须一致：

```bash
cp .env.example .env                        # [待回填]
vim .env                                    # [待回填]
```

`.env` 里只有两个变量，它们的含义与关系：

| 变量 | 阶段 | 作用 | 轮换 |
| --- | --- | --- | --- |
| `VITE_API_TOKEN` | 构建期 | 烘焙进前端 JS bundle，浏览器随每个 `/api` 请求以 `Authorization: Bearer ...` 发送 | 该值对用户可见，改后**必须重建镜像**才生效 |
| `TOKEN` | 运行时 | server 对所有 `/api` 请求做鉴权，不匹配返回 401；缺失则 compose 直接报错、进程 fail-fast 退出 | 可仅重启容器生效，但建议与上项一起重建 |

> **两者的关系**：是同一个共享口令的「前端侧」与「服务端侧」副本，必须相同，否则前端请求全部 401。
> 生成随机串示例：`openssl rand -hex 32` [待回填]。

## 4. 构建并启动 [待回填]

```bash
docker compose up -d --build                # [待回填] 构建镜像并后台启动（宿主机 8080 端口）
```

常用运维命令：

```bash
docker compose ps                           # [待回填] 查看运行状态
docker compose logs -f                      # [待回填] 跟踪日志（含每次 /api 请求）
docker compose down                         # [待回填] 停止；数据在 ./server/data 不受影响
docker compose down -v                      # [待回填] 慎用：会删除匿名卷；本项目数据在挂载卷，仍保留
```

启动后浏览器访问 `http://<服务器公网IP>:8080`。

> `docker compose up` 时若忘记建 `.env`，compose 会因 `${TOKEN:?}` 占位强校验直接报错——这是预期行为，按 §3 建好 `.env` 即可。

## 5. HTTPS（两个选项，二选一）

令牌会随请求头明文传输，**公网部署必须启用 HTTPS**。

### 选项 A：compose 前置反向代理，自动申请证书 [待回填]

在同一个 `docker-compose.yml` 增加一个 Caddy（或 Traefik）服务做反代与自动证书（Let's Encrypt）。Caddy 示例：

```yaml
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
volumes:
  caddy_data:
```

```text
# Caddyfile
example.com {
    reverse_proxy app:3000
}
```

其中 `app:3000` 是 compose 内置 DNS，指向本项目服务容器；`example.com` 换成你的域名并做好 A 记录指向服务器。启动后 `docker compose up -d` 即可自动签发/续期证书（443 端口需对公网开放）。

Traefik 思路相同（`traefik.http.routers.app.tls.certresolver=letsencrypt` 标签），不再展开。

### 选项 B：云服务商负载均衡 / 证书 [待回填]

以常见云厂商为例（具体以厂商控制台为准）：

1. 在防火墙/安全组放行 `8080` 端口（或仅对 LB 开放）。
2. 创建应用型负载均衡（SLB/ELB 等），后端指向服务器 `8080` 端口；健康检查路径 `/`。
3. 在 LB 上挂证书（云厂商免费证书或自购），443 入口终结 TLS 后转发到后端 8080。
4. 用户访问 `https://<你的域名>`，全程加密，`8080` 不直接对公网开放更佳。

## 6. 令牌轮换流程

轮换 = 修改共享口令，前端侧与后端侧必须同步：

1. 编辑 `.env`，把 `VITE_API_TOKEN` 与 `TOKEN` **同时**改为新的同一个随机串 [待回填]。
2. 重建并重启（`VITE_API_TOKEN` 已烘焙进旧前端 bundle，必须重建镜像才会更新）：

```bash
docker compose up -d --build                # [待回填]
```

1. 验证：浏览器刷新后能正常看到数据；用旧令牌 curl 应返回 401：

```bash
curl -i http://localhost:8080/api/state -H "Authorization: Bearer <旧令牌>"   # [待回填] 期望 401
```

## 7. 数据备份

数据库是单文件 `./server/data/tracker.db`（挂载卷）。备份即复制该文件：

```bash
cp ./server/data/tracker.db ./backup-$(date +%F).db     # [待回填] 建议先 docker compose down 保证一致
```

恢复：停服务后用备份文件覆盖 `./server/data/tracker.db` 再 `docker compose up -d` [待回填]。

## 8. 常见故障

| 现象 | 原因/处理 |
| --- | --- |
| 页面数据全空且控制台 401 | `.env` 中两个值为空/不一致，或改了 token 未重建镜像 —— 按 §6 重建 |
| `docker compose up` 报 `TOKEN must be set` | 未建 `.env` 或未填 `TOKEN` —— 按 §3 |
| 容器反复重启 / 日志 `Cannot find module 'express'` | 镜像不是最新（Dockerfile 已含运行时依赖安装）—— 重建镜像 |
| 刷新后数据不在 | 挂载卷未生效 / 用了 `dist` 内置旧 DB —— 确认 `./server/data` 存在且被挂载 |

---

> 本文所有命令待有 docker 环境的部署验证后回填（参见实现计划 §7 Lane D 部署演练）。
