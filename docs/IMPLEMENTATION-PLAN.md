# 详细实现计划（可并行执行）

> 依据 `docs/DESIGN.md`（设计方案 v1.0，已审阅）。
> **本计划是执行蓝图**：定义了固定接口契约、文件归属、并行 lane、验收门槛（Definition of Done）与集成时序。
> 状态：仅计划，未开始执行；契约已冻结（2026-09-16），**等待 Owner 发令开工**。

---

## 0.1 本文结构：Spec 层 + Task 层

本文由两层组成，可分层消费：

- **Spec 层（§1-§6）**：目标系统的精确规格——接口契约、数据结构、行为约束、决策与边界。判断标准：全部内容描述"目标系统应该是什么样"，不涉及谁做、何时做、如何验收。
- **Task 层（§9-§11）**：可执行的工作拆解——todo #1-#8 正式定义、每 todo 的子步骤与前置依赖、验收命令库、里程碑。判断标准：每条都对应一次具体执行动作与验收。

> 变更纪律：
>
> - 改 **Spec 层** = 改契约，必须回到 §1/§5 更新并通知全部 lane（§1 禁令）。
> - 改 **Task 层**（todo 清单/命令）只需更新对应 todo，不涉及契约。
> - 未来新增的候选契约细节，先用 [待确认] 标记、Owner 确认后才定为正式契约；当前契约已冻结（见 §1）。

---

## 0. 并行模型总览

依赖图（谁先谁后）：

```text
+-----------------------------------------------------------+
| 共享契约冻结 M1: §1.1 API 契约 | §1.2 环境/端口 | §1.3 文件归属 | §5 默认拍板 |
+----------------------+----------------------+---------------------------+
                       |                      |                          |
                       v                      v                          v
+-----------------+  +----------------------+  +--------------------+
| Lane A 后端     |  | Lane B 前端重写      |  | Lane C 部署/文档   |
| server/ 目录    |  | src/ + vite.config   |  | Dockerfile/compose |
| 单一 writer     |  | 单一 writer          |  | .env*/.gitignore  |
| Done: curl 冒烟 |  | Done: pnpm build OK  |  | docs/DEPLOY.md +   |
+--------+--------+  +----------------------+  | Done: 配置自洽检查 |
         |                       |              +---------+----------+
         +-----------------------+------------------------+
                                 v
+--------------------------------------------------------------------+
| Lane D 集成验证(串行): pnpm build + server + 浏览器 UI 冒烟 + 部署演练 |
| 通过后回填部署文档实测命令                                          |
+--------------------------------------------------------------------+
```

- **并行性来源**：A/B/C 三个 lane 各自负责**互不重叠的文件集**（§1.3），依赖的只有"冻结契约"而非彼此的源码，因此可同时开工、互不阻塞。
- **每个 lane 单一 writer**：同一目录不允许两个并行执行者同时写入，避免合并冲突与人审成本。
- **Lane D 必须串行**：集成验证需要在 A/B/C 产物合并后统一做。

---

## 1. 共享契约冻结（所有 lane 的前提，第一个做）

> 状态：**已冻结（2026-09-16 确认）**——A 类 3 项按文档定稿；此后任何 lane 不得私下改动契约，改契约须回到此文档更新并通知全部 lane。
> **§1.1 为 DESIGN §4.2 的定稿版**：差异——`parentID=null`、请求体不含 `level`（服务端计算）、PATCH 空 body 返 400；以本文为准，对照 DESIGN 时勿判为 bug。

### 1.1 API 契约（对 Lane A「实现」、Lane B「调用」同时生效）

来源 `DESIGN.md §4.2`，为唯一事实源（照抄，不得自行发挥）：

- `GET /api/state` -> `{ projects: ProjectRec[], logs: LogRec[] }`
  - `ProjectRec = { id, parentID, name, level }`（**不含 children**）
  - `LogRec = { id, projectID, date, status, summary, detail }`
- `POST /api/projects`  body `{ parentID, name }` -> `201 { id, project }`
- `PATCH /api/projects/:id` body `{ name }` -> `{ project }`
- `DELETE /api/projects/:id` -> `{ deleted: n }`（递归删子树 + 关联 logs，单事务）
- `POST /api/logs` body `{ projectID, date, status, summary, detail }` -> `201 { id, log }`
- `PATCH /api/logs/:id` body 部分字段 -> `{ log }`
- `DELETE /api/logs/:id` -> `{ deleted: 1 }`
- 错误统一 `{ error: string }`；状态码：401 未授权、400 非法入参/非法 status、404 不存在。
- ID 一律服务端 `crypto.randomUUID()` 生成；`level` **由服务端按 `parentID` 深度计算**（见 §5 默认拍板）。

> **契约逐条精确化**（实现以 JSON 示例为最终判据）：
>
> **字段名以 §1.1 为准**：`ProjectRec = { id, parentID, name, level }`、`LogRec = { id, projectID, date, status, summary, detail }`——前端类型定义必须与后端响应字段一致（见 §3.1 逐文件契约）。
>
> - `GET /api/state` -> `200` `{"projects":[],"logs":[]}`；记录示例（`children` 永不出现）：
>
>   ```json
>   {"projects":[{"id":"uuid-1","parentID":null,"name":"项目A","level":0}],
>    "logs":[{"id":"uuid-2","projectID":"uuid-1","date":"2026-09-16","status":"plan","summary":"a","detail":""}]}
>   ```
>
> - `parentID` 值为 `null` 表示根级项目（不再有历史 `"root"` 伪节点）；缺失/空视为 null。
> - 所有请求体 `application/json`；body 非法 JSON、缺必填字段或类型错 -> `400 {"error":"<字段>: <原因>"}`。
> - `status` 白名单：`plan|progress|failed|done|delay`，其他 -> `400`。
> - 错误体统一：`400 {"error":"invalid status"}` / `401 {"error":"unauthorized"}` / `404 {"error":"not found"}`。
> - ID 一律 36 位小写 UUID v4（`crypto.randomUUID()`），客户端不得透传 ID 覆盖。
> - PATCH 覆盖语义：仅覆盖 body 提供的字段；body 为空对象 -> `400`（防空提交）。

### 1.2 环境与端口（Lane A 与 C 共享）

| 变量/约定 | 值 | 消费者 |
| --- | --- | --- |
| 服务监听端口 | `PORT`，默认 `3000` | Lane A 读取默认值、C 使用 |
| 共享令牌 | `TOKEN`（必填，缺失则启动失败） | Lane A 鉴权、C 注入 compose |
| 前端构建期令牌 | `VITE_API_TOKEN`（烘焙进 bundle） | Lane B 读取、C 注入 stage1 |
| SQLite 路径 | `DB_PATH`，默认 `./server/data/tracker.db`（容器内 compose 改为 `/data/tracker.db`） | Lane A 读取默认值、C 挂卷 |

### 1.3 文件归属（防止并行写冲突）

| 文件/目录 | Owner | 动作 |
| --- | --- | --- |
| `server/*`（新建） | **Lane A** | 全目录独占 |
| `src/*`（重写）、`vite.config.ts` | **Lane B** | 独占；`.vue`/`.ts` 全部归 B |
| `Dockerfile`、`docker-compose.yml`、`.env.example`、`.dockerignore`、`.gitignore`（追加两行）、`docs/DEPLOY.md`、`README.md`（部署段） | **Lane C** | 独占（除 `.gitignore` 追加 2 行外不碰其他已有文件） |
| `docs/DESIGN.md`、`docs/IMPLEMENTATION-PLAN.md` | 集成/Owner | 只有 Owner（执行者）可改 |
| `package.json` | **Lane B/C 协商后 B 改** | B 若需新依赖先声明确认（见 §6 注意）；`packageManager` 字段由 B 加 |
| `index.html`、`public/*` | Lane B | 如需要 |

禁止项：任何 lane 都不许写他人 owned 的文件；发现交叉需求 -> 记入计划问题，交由 Owner 汇总后再分配。

---

## 2. Lane A — 后端实现（todo #1 -> Lane D 冒烟消账）

**Owner**：1 个 subagent，独占 `server/`。

### 2.1 交付文件

```text
server/
  package.json        # type: module; deps: express（唯一运行时依赖）
  server.js           # 完整服务：静态托管 dist/ + /api 全部路由 + 鉴权中间件 + 启动
```

> 单文件优先（ponytail）；若超 ~250 行再拆 `db.js`，由 Owner 自行判断，禁止为"结构清晰"预拆。

### 2.2 实现要求（对应 DESIGN §4）

- `node:sqlite` 的 `DatabaseSync`，建 2 表（`projects`/`logs`），启动时 `CREATE TABLE IF NOT EXISTS`。
- 鉴权中间件：`Authorization: Bearer <token>` vs `process.env.TOKEN`；**TOKEN 未设置 -> 进程抛错退出**。
- `level`：`POST /api/projects` 忽略客户端传值，按 `parentID` 查父级深度 +1（root=0）。
- 级联删除：`DELETE /api/projects/:id` 单事务内递归删子树 + 删这些项目的全部 logs。
- `status` 服务端白名单校验（§5）。
- 静态托管：`express.static('<dist>')`，`dist` 路径解析为运行时相对 `server.js` 的 `../dist`（容器内即 `/app/dist`）；SPA fallback 到 `index.html`。
- 日志：简单 `console.log` 请求方法+路径+状态即可，不引日志库。

> **server.js 实现要点**（执行时以下列要点为准）：
>
> - **中间件顺序**（语义层层拦截）：`express.json()` -> 鉴权中间件挂 `/api`（token 不匹配 401 短路，不落库）-> `/api/*` 路由 -> `express.static(dist)` -> `app.get('*')` 回 `index.html`（SPA fallback，静态文件未命中才走）。API 路由必须先于 static 注册。
> - **鉴权**：比较 `req.get('Authorization')` 与 `` `Bearer ${process.env.TOKEN}` ``，`!==` 即 `401 {error:"unauthorized"}`。
> - **node:sqlite**：`import { DatabaseSync } from 'node:sqlite'`；`new DatabaseSync(dbPath)`；启动时执行 `CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY, parentID TEXT, name TEXT, level INTEGER, updatedAt TEXT)` 与 `logs(id TEXT PRIMARY KEY, projectID TEXT, date TEXT, status TEXT, summary TEXT, detail TEXT, updatedAt TEXT)`（字段与 §4.1 一致）。写操作用 prepare -> `run/get/all`；多写包 `BEGIN/COMMIT/ROLLBACK`。
> - **UUID/level**：`crypto.randomUUID()`；level = 父级 `level + 1`（`SELECT level FROM projects WHERE id=?`，parentID 不存在 -> 400），root（parentID null/缺省）-> 0。
> - **级联删除**：单事务内先递归收集整棵子树 id（`WITH RECURSIVE`，父 parentID 指向子树成员），再 `DELETE FROM logs WHERE projectID IN (...)` + `DELETE FROM projects WHERE id IN (...)`；返回 `{deleted: n}`（n=删除的项目数）。
> - **静态托管**：`express.static(path.resolve(import.meta.dirname, '../dist'))`；dist 不存在时仅 API 可用并 `console.warn`。
> - **日志**：`console.log` 请求方法+路径+状态码，不引日志库。
> - **TOKEN fail-fast**：`if (!process.env.TOKEN) { console.error('TOKEN required'); process.exit(1) }` 放在 DB 初始化前。

### 2.3 Definition of Done（本 lane 自检）

1. 本地 `TOKEN=t node server/server.js` 能起、`GET /api/state` 带 token 返回 `{projects:[],logs:[]}`。
2. **curl 冒烟全通过**（§2.4 的最小套件）。
3. 不带 token 请求任意 `/api/*` -> 401。
4. `TOKEN` 未设启动 -> 非零退出并打印明确报错。

### 2.4 最小 curl 冒烟（A 自证；D 会全量重跑）

```bash
export TOKEN=testtoken
node server/server.js &            # 背景运行
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/state           # -> 401
curl -s -H "Authorization: Bearer testtoken" localhost:3000/api/state        # -> {"projects":[],"logs":[]}
# POST project -> 记 id1；再 POST 子项目 -> id2；PATCH 改名；POST log(指向 id2)
# DELETE /api/projects/id1 -> 断言 id2 与 log 一并消失（GET state 复查）
# POST log 非法 status -> 400
```

---

## 3. Lane B — 前端重写（todo #2/#3/#4/#8 -> Lane D 冒烟消账）

**Owner**：1 个 subagent，独占 `src/`、`vite.config.ts`、`package.json`（packageManager 字段）。

### 3.1 交付文件（重写）

```text
src/
  api.ts                       # fetch 封装 + Bearer(VITE_API_TOKEN) + getState/addProject/patchProject/deleteProject/addLog/patchLog/deleteLog
  types/main.ts                # Project(含 children 由前端重建为 Set)/Log/TaskStatus
  stores/projectStore.ts       # loadState + addProject/rmProject(server-first)
  stores/logStore.ts           # loadState + addLog(server-first, 返回服务端 ID)/rmLog/updateLog
  stores/shownProjectStore.ts  # 保留：每设备显示状态, 不同步
  App.vue                      # onMounted 载入 2 store -> update(); loading 态
  main.ts                      # 基本不变(可微调)
  components/Header.vue        # Home/Sync/Settings; Sync 按钮接线 loadState+update
  components/TopLevelProjects.vue  # chip 区 + 新增/改名/删除入口
  components/ProjectTimeTable.vue  # 时间表; 单元格->日志弹窗(新增/编辑/删除)
  components/ProjectDialog.vue      # 项目：名称 + 父级下拉(新增/改名)
  components/LogDialog.vue          # 日志：status 下拉 + summary + detail + 删除
vite.config.ts                 # 加 server.proxy['/api'] -> http://localhost:3000
package.json                   # 加 "packageManager": "pnpm@11.1.2"（供 Docker stage1 识别）
```

> 旧 `utils/randString.ts` 不再由 store 生成 ID（服务端 UUID），**删除该文件**；保留类型/常量即可。

> **前端逐文件契约（API/类型签名）**：
>
> - `src/api.ts`（数据面唯一出口）：统一失败策略——`fetch` 非 2xx 时 `throw new Error((await body).error || \`HTTP \${res.status}\`)`，网络错误原样抛；成功返回解析后的 JSON。
>
>   ```ts
>   getState(): Promise<{ projects: ApiProject[]; logs: ApiLog[] }>
>   addProject(p: { parentID: string | null; name: string }): Promise<ApiProject>
>   patchProject(id: string, p: { name: string }): Promise<ApiProject>
>   deleteProject(id: string): Promise<{ deleted: number }>
>   addLog(p: { projectID: string; date: string; status: TaskStatus; summary: string; detail: string }): Promise<ApiLog>
>   patchLog(id: string, p: Partial<ApiLog>): Promise<ApiLog>
>   deleteLog(id: string): Promise<{ deleted: number }>
>   ```
>
>   头部：`Authorization: Bearer ${VITE_API_TOKEN}`（token 缺失时不带，靠 401 兜底）。
> - `src/types/main.ts` 字段名与 API 对齐（**与旧代码 `projectID/projectName` 不同，属重写点**）：
>   `ProjectRec = { id; parentID: string|null; name; level }`；前端 `Project = ProjectRec & { children: Set<string> | null }`；`LogRec = { id; projectID; date; status; summary; detail }`。
> - 组件 props/emit 约定：
>   - `ProjectDialog.vue`：`props { open:boolean; mode:'create'|'rename'; project?:Project }`；`emit('save',{ name, parentID })` / `emit('close')`。
>   - `LogDialog.vue`：`props { open:boolean; mode:'create'|'edit'; log?:LogRec; projectID:string; date:string }`；`emit('save', payload)` / `emit('delete')` / `emit('close')`。
> - 错误提示：store 抛错 -> 调用方用 App 级单例 `v-snackbar`（`src/components/ErrorBar.vue` 或 App 内嵌）显示 `err.message`。

### 3.2 关键行为（对应 DESIGN §5）

- **响应式**：所有列表一律 `computed` 派生（顶层项目、shown 项目、日期、allDate），禁止 setup 期一次性 `const list = ...`。
- **server-first**：所有增删改先 await API 成功后更新本地 Map；失败则抛错，UI 用 Vuetify `v-alert`/snackbar 提示，不做乐观更新。
- `Project.children`：`loadState` 由扁平 `parentID` 重建为 `Set<string>`（叶子为 null）。UI 层目前只展示/编辑**顶层**，子层级后续再展开（本期不做子树视图，见 §6 注意）。
- 日志弹窗：空单元格=新增；有 summary 单元格点击=编辑/删除复用同一弹窗；日志唯一键 `projectID + date`（每项目每天 1 条，多条的显示本期取最新，见 §6）。

### 3.3 Definition of Done（本 lane 自检）

1. `pnpm build`（`vue-tsc -b && vite build`）在 strict tsconfig 下**零错误零告警**通过。
2. `pnpm dev` 起来：dev 代理 `/api` -> 3000 生效（页面能拉到 state）。
3. 手动/脚本验证：页面能新增项目->chip 出现；点时间表单元格->录日志->表格渲染；Sync 后与 server 数据一致。
4. 无遗留 `randString` 引用（`grep -r randString src || 无`）。

---

## 4. Lane C — 部署与文档（todo #6 -> 集成时回填实测命令）

**Owner**：1 个 subagent，独占根目录部署文件 + 部署文档（与 A/B 文件零重叠）。

### 4.1 交付文件

```text
Dockerfile             # 多阶段：stage1 构建前端, stage2 node:24-alpine 运行
docker-compose.yml     # 卷挂载 ./server/data:/data; TOKEN/DB_PATH/PORT; 端口映射 8080:3000
.env.example           # 注明 VITE_API_TOKEN(前端构建) 与 TOKEN(服务端), 不落真实值
.dockerignore          # node_modules/dist/src?/docs? 最小集(含 server/data, .git, .env*)
.gitignore 追加 2 行    # server/data/  .env
docs/DEPLOY.md         # 云服务器一步步：装 Docker -> 拉代码 -> 构建 -> 起 compose；HTTPS 两个选项；token 轮换流程
```

### 4.2 关键点（仅靠冻结契约即可并行，无需等 A/B 代码）

- stage1：`npm i -g pnpm@11`（packageManager 已由 B 加，corepack 亦可）-> `pnpm install --frozen-lockfile` -> `pnpm build`；`ARG VITE_API_TOKEN` 传入构建期。
- stage2：`node:24-alpine` -> 拷贝 `server/` + `dist/` -> `CMD ["node","server/server.js"]`；`ENV DB_PATH=/data/tracker.db`；`VOLUME /data`。
- compose：`TOKEN` 必填（compose 校验占位 `TOKEN: ${TOKEN:?err}`），端口映射默认 `8080:3000`。
- DEPLOY.md 中所有命令标注 `[待回填] 待集成验证后回填`，集成通过（Lane D step 3）再由 Owner 回填为实测命令（遵守 DESIGN §7-3 铁律：命令必须实测过）。

> **部署文件细节**（Dockerfile/compose 具体要点）：
>
> - **stage1（构建）**：`FROM node:24-alpine` -> `ARG VITE_API_TOKEN` + `ENV VITE_API_TOKEN=$VITE_API_TOKEN` -> 启用 corepack pnpm@11（或 `npm i -g pnpm@11`）-> `pnpm install --frozen-lockfile` -> `pnpm build` -> 产出 `dist/`。（`packageManager: pnpm@11.1.2` 由 Lane B 写入，供 corepack 识别。）
> - **stage2（运行时）**：`FROM node:24-alpine` -> `ENV NODE_ENV=production DB_PATH=/data/tracker.db PORT=3000` -> 复制 `server/` 与 `dist/` -> `EXPOSE 3000` -> `CMD ["node","server/server.js"]` -> `VOLUME /data`。
> - **compose**：`TOKEN: ${TOKEN:?err}` 占位强校验、`DB_PATH: /data/tracker.db`、`ports: 8080:3000`、`volumes: ./server/data:/data`。
> - **`.dockerignore`** 最小集：`node_modules` `dist`（stage1 会重产）`.git` `server/data` `.env*` `docs` `.trae` `.pi-glla`。
> - **.gitignore 追加两行**：`server/data/` 与 `.env`、`.env.local`（与 §4.1 一致）。

### 4.3 Definition of Done

1. `docker compose config` 无报错（本机有 docker 时）；无 docker 则用 `node -c`/YAML 解析 + 人工核对。
2. `.env.example` 与 compose/Dockerfile 引用的变量名一一对应。
3. DEPLOY.md 结构完整、HTTPS 与轮换流程说明到位；未实测命令已打 [待回填] 标记。

---

## 5. §10 开放问题 — 默认拍板（执行时生效，无异议即不必再问）

| # | 问题 | 默认决定 | 影响 |
| --- | --- | --- | --- |
| 1 | `TaskStatus` 校验放哪 | **服务端白名单校验**（plan/progress/failed/done/delay） | Lane A 实现 400；Lane B 下拉只用这 5 个值 |
| 2 | 请求体校验力度 | **最小必要**：类型/必填/status 合法，不引 zod | 双方都遵守，不扩 |
| 3 | `level` 谁定 | **服务端按 parentID 深度强制计算** | API body 不再要求 client 传 level（见 §1.1） |

> 若用户在执行前对任一默认有异议，Owner 先改 §1/§5 再发令开工。

---

## 6. 执行注意与边界（对齐 DESIGN §8/§9）

- **每个 lane 单一 writer**；同一时刻只有一名执行者动一个 lane 的文件；读他人 owned 文件允许、写禁止。
- 前端重写期间，**任何 lane 不并行触碰 `src/`**；Lane C 构建产物依赖「B 的 package.json/锁文件/Dockerfile 读它」，由 Owner 在 Lane D 统一触发 build。
- 平行不变量：**Dockerfile/compose 与 server.js 的路径、端口、env 名以 §1 为准**，任何一处偏差视为 bug，集成时 Owner 核对三项（路径/端口/TOKEN）。
- 明确**本期不做**（无需实现者考虑）：用户登录体系、WebSocket/轮询、离线队列、字段级合并、**子项目树形视图 UI**（数据模型支持，界面本期只做顶层+时间表；子树 UI 列入后续）、每项目每日多条日志的折叠展示（多条的展示本期取最新并注 `ponytail:` 注释）。
- 单测策略：不引测试框架；正确性通过 Lane D 的 curl + 浏览器冒烟保障（对应用规模最小成本）。

---

## 7. Lane D — 集成验证（串行，最后做）

**Owner**：主执行者（不并行）。

### 步骤

1. **契约核对**：比对 `server/server.js` 与 `src/api.ts` 的路径/字段名，与 §1.1 一致（不一致即退回对应 lane 修）。
2. **前端构建**：`pnpm install --frozen-lockfile && pnpm build`，strict 零告警。
3. **本地全链路冒烟**（DESIGN §7-2 ~ §7-4 全量）：
   - curl：401 -> POST/PATCH/DELETE 级联 -> log CRUD -> 非法 status 400；
   - 浏览器（dev 或 preview + server）：新增项目->chip->录/编/删日志->表格渲染->刷新数据仍在->Sync 生效。
4. **部署演练**（可选但推荐）：本地 `docker build` + `docker compose up` 全绿后，**把实测命令回填 `docs/DEPLOY.md`**（去掉 [待回填]）。
5. 全部通过 -> 关闭 todo #1-#8 剩余项，向用户交付摘要。

### Gate（全部为硬门槛）

- [ ] Lane A curl 套件全绿
- [ ] Lane B `pnpm build` 零告警
- [ ] LANE D 全链路冒烟全绿（含 UI）
- [ ] DEPLOY.md 无 [待回填] 残留（部署演练通过后）

---

## 8. 执行顺序速查（给执行者）

1. 冻结 §1 契约（Owner，一次）。
2. 并发启动 Lane A、B、C（三个独立 subagent/worktree）。
3. 每个 lane 到 DoD 即汇报，Owner 验收各自产物。
4. 合并后 Owner 走 Lane D Gate；失败则定位 lane 退回修。
5. trough 平台：默认用 `pnpm`，勿引入 yarn/npm 混用。

---

## 9. Task 层 — todo 清单（正式定义 todo #1-#8）

> 本清单为 Task 层正式定义：每 todo 含
> 归属 lane、Spec 引用、前置依赖、子步骤、验收命令（§11）与状态（执行者勾选）。

### 9.1 一览表

| # | 标题 | Lane | Spec 引用 | 前置依赖 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1 | 后端 `server/`（server.js + package.json） | A | §2 + §1.1 | 契约冻结 M1 | [ ] |
| 2 | 前端地基：api.ts + types + vite proxy + packageManager | B | §3.1 | M1 | [ ] |
| 3 | stores 重写（project/log/shown） | B | §3.1/§3.2 | #2 | [ ] |
| 4 | 组件接线：Header + TopLevelProjects + ProjectTimeTable + App.vue | B | §3.1/§3.2 | #3 | [ ] |
| 5 | 录入 UI：ProjectDialog + LogDialog + 删除 randString | B | §3.1/§3.2 | #4 | [ ] |
| 6 | 部署文件（Dockerfile/compose/.env*/DEPLOY.md） | C | §4 | M1 | [ ] |
| 7 | 集成验证 Lane D（含回填 DEPLOY.md [待回填]） | D | §7 | #1..#6 且 #8 全绿（需 dist 产物） | [ ] |
| 8 | B 质量门：strict 构建 + randString 零残留 + dev 代理验证 | B | §3.3 | #5；(运行期需 #1 server 可运行) | [ ] |

**#5/#7 归属**：#5=B（弹窗 UI）、#7=D（集成验证）。

### 9.2 子步骤（每 todo）

**#1 后端**：1) `server/package.json`（type:module + express）2) `server/server.js` 单文件：node:sqlite 建表 -> TOKEN fail-fast -> 鉴权中间件 -> 7 路由 -> static + SPA fallback 3) 按 §2.4 cmd-1/cmd-2 冒烟。

**#2 前端地基**：1) `pnpm add -D @types/node`（已在）2) `vite.config.ts` 加 `server.proxy['/api']->http://localhost:3000` 3) `package.json` 加 `packageManager: pnpm@11.1.2` 4) 新增 `src/api.ts`（签名见 §3.1 逐文件契约）5) 重写 `src/types/main.ts` 字段对齐 API。

**#3 stores**：1) `projectStore`：`loadState` 由扁平数组重建 Map + children Set；`addProject`、`rmProject` server-first（`children` 断言为 `Set`，元素为项目 id 字符串；叶子为 null）2) `logStore`：`loadState`、`addLog`（返回服务端 id）、`rmLog`、`updateLog` 均 server-first 3) `shownProjectStore` 保留，`update()` 改由 App 调用（消除 store 循环依赖）。

**#4 组件接线**：1) `App.vue`：`onMounted` -> `Promise.all(loadStatex2)` -> `shownProject.update()`；loading 态；挂 ErrorBar 2) `Header.vue`：Sync 按钮 -> 重新 loadState+update 3) `TopLevelProjects.vue`：列表改 `computed` 派生、chip 点击切换、补新增/改名/删除入口 4) `ProjectTimeTable.vue`：修复"按 projectID 查 log"反向 bug（时间表取 `logStore` 按 `projectID+date` 查）、列表全 `computed`。

**#5 录入 UI**：1) `ProjectDialog.vue`（create/rename）2) `LogDialog.vue`（create/edit/delete）3) 时间表单元格 -> 空=新增、有=编辑/删除 4) 删除 `src/utils/randString.ts` 及全部引用。

**#6 部署**：1) Dockerfile 两阶段 2) docker-compose.yml 3) .env.example/.dockerignore/.gitignore 追加 4) docs/DEPLOY.md（HTTPS 两选项 + token 轮换流程；命令先打 [待回填]）5) 本地 `docker compose config` 校验。

**#7 集成（串行）**：1) §7 步骤 1 契约核对 2) build 3) 全链路 curl + 浏览器冒烟 4) 部署演练 5) [待回填] 回填实测命令 6) 关闭全部 todo 状态。

**#8 质量门**：1) `pnpm install --frozen-lockfile && pnpm build`（strict 零告警）2) `grep -rn randString src` 无输出 3) `pnpm dev` + server 同起，页面能拉到 state。

## 10. Task 层 — 依赖 DAG 与里程碑

```text
M1 契约冻结(§1/§5 无未决项)
  |-- #2 -> #3 -> #4 -> #5 -> #8 (B 质量门)
  |-- #1 (A 后端) -------------+
  |-- #6 (C 部署) -------------+----> #7 (集成/D): 需 #1..#6 且 #8 全绿 + dist 产物
                                +----> 软依赖: #8 需 #1 server 运行(dev 代理拉 state)
  #7 -> 回填 #6 的 DEPLOY.md(去[待回填]) -> M4
```

- **并行窗口**：M1 后，#1(A)、#6(C)、#2(B) 可同时开工（文件集互不重叠，§1.3）。
- **串行段**：#7 必须等 #1..#6 且 #8 DoD 全绿（#7 还需 #8 的 dist 产物）；#8 的 dev 代理验证需 #1 server 可运行（软依赖），可与 #5 并行收尾。
- **里程碑**：M1 契约冻结 -> M2 A/B/C 产物全绿 -> M3 集成 4 Gate 全过 -> M4 部署演练通过、DEPLOY.md [待回填] 清零。

## 11. Task 层 — 验收命令库（集成时逐条实测）

```bash
# cmd-1 后端 curl 冒烟（§2.4 全量 + 级联断言 + 非法 status）
export TOKEN=testtoken && node server/server.js &   # 起后
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/state                       # 401
curl -s -H "Authorization: Bearer testtoken" localhost:3000/api/state                    # {projects:[],logs:[]}
# POST 父项目->记 id1；POST 子项目->id2；PATCH 改名；POST log(projectID:id2)
# DELETE /api/projects/id1 -> GET state 断言 id2 与 log 一并消失
curl -s -X POST -H "Authorization: Bearer testtoken" -H 'Content-Type: application/json' \
  -d '{"projectID":"x","date":"2026-09-16","status":"bogus"}' localhost:3000/api/logs    # 400

# cmd-2 TOKEN fail-fast：不设 TOKEN 启动 -> 非零退出 + 明确报错

# cmd-3 构建（strict 零告警）：pnpm install --frozen-lockfile && pnpm build
# cmd-4 残留检查：grep -rn randString src   # 期望无输出
# cmd-5 dev 全链路：pnpm dev + server 同起；浏览器：新增项目->chip->录/编/删日志->刷新仍在->Sync 生效
# cmd-6 部署：docker compose config 无错；docker build && docker compose up 演练全绿
```

> 状态更新约定：每完成一个 todo 把 §9.1 对应 `[ ]` 勾为 `[x]`；#7 的 4 个 Gate（§7）逐个勾选。
