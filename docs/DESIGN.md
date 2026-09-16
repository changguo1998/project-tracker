# 设计方案：多端访问 + 数据持久化

> **状态：仅方案，未实现。**
> 本文档描述把 Project Tracker 从"纯前端内存 SPA"升级为"多端共享、数据持久化"的完整设计，
> 供实现前评审。实施任务已列入待办列表。

## 1. 目标

- **多端访问**：任何设备（浏览器）访问同一 URL 即可读写同一份数据。
- **数据持久化**：数据落盘，刷新/重启/重装浏览器不丢失，跨设备共享。
- 用户已确认的技术决策：**Node + SQLite**（栈）、**Docker**（部署）、**共享口令**（鉴权）、**Last-Write-Wins**（冲突模型）。云服务器负责托管。

## 2. 现状确认（2025-09 通读源码结论）

- 技术栈：Vue 3.5 + TypeScript + Vite 8 + Vuetify 4 + Pinia 3（`package.json`），无后端、无持久化。
- 全部状态在 3 个内存 Pinia store 中：`projectStore`(项目树)、`logStore`(日志)、`shownProjectStore`(每设备 UI 显示状态)。
- 全项目**无任何** `localStorage` / `fetch` / 网络层 / 数据库依赖（已 grep 确认）；`init()` 从未被调用；`vite.config.ts` 无 proxy。
- 前端存在以下问题（**前端将整体重写，见 §5；下述问题随重写消除**，仅作为重写动机记录）：

| 问题 | 位置 | 影响 |
| --- | --- | --- |
| 组件列表非响应式 | `TopLevelProjects.vue:21`、`ProjectTimeTable.vue:46~60` | setup 时算一次，异步载入后不会更新 |
| 时间表单元格按项目 ID 查 log | `ProjectTimeTable.vue:26` `logStore.getByID(p)` | `logStore` 按 log ID 索引，`p` 是 project ID → 单元格恒为空，属既有 bug |
| `rmProject` 空指针隐患 | `projectStore.ts:49` | `getByID` 断言非空但可能返回 `undefined` |

## 3. 总体架构

```
┌──────────────────── 云服务器（Docker 单容器）────────────────────┐
│  Express 进程 (单个 Node 进程)                              │
│   ├─ 静态托管 dist/（前端 build 产物）              →  /        │
│   ├─ REST API /api/*                               →  数据     │
│   └─ node:sqlite（内置驱动，零原生编译）            →  SQLite 库 │
└───────────────────────────────────────────────────────────────┘
  多设备浏览器 ─────── HTTPS ───────▶ 同一 URL，数据统一入库
```

- **单容器单进程**：Express 同时托管前端静态文件与 API，省去 nginx / 多服务编排。
- **SQLite 驱动选 `node:sqlite`**（Node 24 内置，非 better-sqlite3）：零原生依赖，Docker 镜像无需 python/g++ 编译；Node 23.4 起免 flag 可用，运行期可能出现 ExperimentalWarning（无害）。兜底：若不可用则退回 better-sqlite3（运行时需 `python3 make g++`）。
- **数据流**：设备操作 → 逐条 REST CRUD → 写 SQLite → 所有设备共享同一库。
- **一致性模型**：启动时全量拉取 + Sync 按钮手动刷新，不做实时轮询（见 §9 遗留）。

## 4. 后端设计（新增 `server/` 目录）

### 4.1 数据库 Schema（2 张表）

```sql
projects(id TEXT PK, parentID TEXT, name TEXT, level INTEGER, updatedAt TEXT);
logs(id TEXT PK, projectID TEXT, date TEXT, status TEXT,
     summary TEXT, detail TEXT, updatedAt TEXT);
```

- **不存储 `children`**：由 `parentID` 查询派生；"某项目是叶子还是容器" 由是否有子记录决定。
- **不存储 shownProjectSet**：它是每台设备自己的 UI 状态，不同步。
- `updatedAt` 作为 LWW 依据（"后写覆盖"，按整条记录粒度）。

### 4.2 REST API 契约

统一响应约定：`2xx` 返回 JSON；错误返回 `{ error: string }`。

| 方法 | 路径 | 请求体（JSON） | 响应 | 说明 |
| --- | --- | --- | --- | --- |
| GET | `/api/state` | — | `{projects, logs}` | 全量快照，启动载入用（记录不含 `children`） |
| POST | `/api/projects` | `{parentID, name, level}` | `{id, project}` | 服务端生成 ID |
| PATCH | `/api/projects/:id` | `{name?}` | `{project}` | 改名 |
| DELETE | `/api/projects/:id` | — | `{deleted: n}` | **单事务递归删整棵子树** |
| POST | `/api/logs` | `{projectID, date, status?, summary?, detail?}` | `{id, log}` | 服务端生成 ID；`status` 校验 ∈ TaskStatus |
| PATCH | `/api/logs/:id` | 部分字段 | `{log}` | 更新 |
| DELETE | `/api/logs/:id` | — | `{deleted: 1}` | 删除 |

补充约束：

- **ID 全由服务端生成**（`crypto.randomUUID()`）：根协议约定 `randString(8)` 多设备碰撞风险真实存在，且 `Project.children` 与 log 的 `projectID` 依赖 ID 一致性。
- 每次写操作刷新 `updatedAt`（服务器时间）作为 LWW 校验依据；客户端不做乐观锁，后写即覆盖。
- PATCH 采用**覆盖语义**：按请求中提供的字段覆盖（客户端持有全量记录、通常整条提交），不做字段级合并。

### 4.3 鉴权（共享口令）

- 所有 `/api/*` 经中间件校验 `Authorization: Bearer <token>` === `process.env.TOKEN`，不匹配返回 `401 {error}`。
- **TOKEN 未设置 → 服务启动直接抛错退出（fail-fast）**，避免裸奔上线。
- 前端把 `VITE_API_TOKEN` 烘焙进构建产物（共享口令模型的既定代价；**轮换 token 需重建前端**，见 §6 部署）。

### 4.4 项目删除的级联语义

DELETE 项目需**在同一事务**内递归删除其全部后代项目，以及**指向这些项目（含自身）的所有 logs**，保证无孤儿数据。级联规则写入接口文档并作为默认行为。

## 5. 前端重构（允许重写，脱离历史代码）

**决策**：用户已授权必要时重写前端。现状 `src/` 规模小（9 文件 ~460 行）但有历史问题（非响应式列表、时间表按项目 ID 查 log 的 bug、无任何增删改 UI 入口），且新 API 模型（children 不落库、ID 服务端生成、全量载入）与旧内存模型差异大，增量改造收益低 → **前端整体重写**。保留技术栈（Vue3 + Vite + Vuetify + Pinia），§2 的历史代码问题随重写消失。

### 5.1 新增 `src/api.ts`

`fetch` 封装 + 自动带 `Authorization: Bearer <VITE_API_TOKEN>`；暴露：

```ts
getState()        addProject(payload)   patchProject(id, payload)  deleteProject(id)
                  addLog(payload)       patchLog(id, payload)     deleteLog(id)
```

约定：所有网络/解析失败向前端调用方抛错，由 store 决定处理与提示。

### 5.2 Stores 云同步

- `projectStore` / `logStore` 均新增 `loadState()`：`GET /api/state` → 重建内存 `Map`；`Project.children` 由 `parentID` 重建为 `Set`。
- 载入完成后由 `App.vue` 统一调用 `shownProjectStore.update()`（**避免 projectStore ↔ shownProjectStore 循环依赖**）。
- 所有变更操作 **server-first**（先 `await` 后端成功，再用服务端返回的 ID 写本地 Map）：
  - `addProject` → 服务端返回 ID 后构造本地 Project（含 children Set）挂到父节点。
  - `rmProject` → 调 DELETE（含级联）成功后本地递归删除子树。
  - `addLog` → 用服务端返回的 ID 写 `logMap`（保持返回 ID 的契约）。
  - `rmLog` / 编辑 → 对应 PATCH/DELETE 成功后再更新本地。
- 失败策略：网络/鉴权失败则不更新本地、向调用处抛错（不做乐观更新，UI 显示错误提示）。

### 5.3 应用骨架与启动载入

- `App.vue`：`onMounted` → `await Promise.all([projectStore.loadState(), logStore.loadState()])` → `shownProjectStore.update()`；载入期间显示简单 loading。
- `Header.vue`：Home / Sync / Settings。**Sync 按钮**接线 → 重新 `loadState()` + `update()`（复用现有入口）。

### 5.4 界面与交互（新增录入 UI）

布局沿用现有概念：上层为顶层项目 chip 区（点击切换显示/隐藏），主区为时间表（行=日期，列=已显示项目）。在此基础上补齐录入能力：

- **项目管理 UI**：
  - 新增项目：弹窗输入名称 + 选择父级（下拉，缺省为根=顶层）。
  - 改名 / 删除：每个项目提供操作入口（按钮/菜单）；删除需二次确认并提示级联删除子孙与日志。
- **日志录入 UI**（时间表单元格）：
  - 点击空单元格 → 日志弹窗（status 下拉 + summary + detail）新增该日该项目的日志。
  - 点击已有日志单元格 → 同一弹窗进入编辑/删除模式。

### 5.5 开发期代理

`vite.config.ts` 增加 `server.proxy['/api'] → http://localhost:3000`（仅开发期；生产同源直连，无需代理）。

## 6. 部署（Docker，根目录新文件）

```
根目录:
  Dockerfile            多阶段：stage1 构建前端，stage2 运行时
  docker-compose.yml    卷挂载 + TOKEN 环境变量 + 端口映射
  .env.example          VITE_API_TOKEN（前端构建用）与 TOKEN（服务端）
  .dockerignore
  .gitignore 追加:     server/data/  .env
```

- **Dockerfile 多阶段**：
  - stage1（构建）：启用 corepack pnpm → `pnpm install --frozen-lockfile && pnpm build` → 产出 `dist/`。
  - stage2（运行时）：`node:24-alpine` → 拷贝 `dist/` + `server/` → `node server/server.js`。
- **compose 关键项**：`./server/data:/data` 卷（SQLite 文件跨重启保留）、`TOKEN` 注入、宿主机端口映射（示例 `8080:3000`）。
- **HTTPS**：共享口令必须走 HTTPS。部署文档给出两个选项：compose 前置 Caddy/Traefik 反代自动证书；或云服务商 LB/证书（以用户实际云环境为准，属部署期配置，不在本期代码内）。
- **token 轮换**：改 `VITE_API_TOKEN` + `TOKEN` → Docker 重建即完成（文档写明）。

## 7. 验证计划（实现完成后执行）

1. `pnpm build` 在 strict tsconfig 下干净通过（重写后的前端同样受 `noUnusedLocals` 约束）。
2. 本地起 server（测试 TOKEN）+ curl 冒烟，按序：
   no token → 401；POST project → GET `/api/state` 可见 → PATCH 改名 → 挂子项目 → DELETE 父项目 → 子项目与指向日志被级联删净；log CRUD 全流程（含 status 非法值 400）。
3. 上述命令**实测通过后**，才写入部署说明（§6，命令必须是验证过的真实命令）。
4. 浏览器 UI 冒烟：dev 起 vite + server，页面新增项目（含子项目）→ chip 显示 → 点击时间表单元格新增/编辑/删除日志 → 表格正确渲染 → 刷新后数据仍在 → Sync 生效。
5. 多端验证（可选，用户有云服务器后做）：两台设备各自增删，Sync 后互相可见。

## 8. 明确不做（本期边界）

- ✅ **已纳入本期**：增删改 UI（§5.4）——新增/编辑/删除项目与日志的完整录入界面。
- ❌ 不做用户注册/登录（共享口令达成多端隔离所需的最简鉴权）。
- ❌ 不做实时轮询/WebSocket（Sync 手动拉取够用，真需要再加）。
- ❌ 不做离线写队列/乐观协作（断网即失败报错）。
- ❌ 不做字段级合并（LWW 整条覆盖是本期冲突模型）。

## 9. 遗留与风险

- **LWW 整条覆盖**：两设备同时改同一项目，后写覆盖先写；记录级而非字段级。可接受的牺牲（用户已确认）。
- **无离线写**：断网操作直接失败，服务端为唯一真相。
- **无实时推送**：A 设备改动，B 设备需刷新/Sync 才可见。
- **共同编辑同一项目树（多设备同时增删项目）**：LWW 不能解决"同一父节点下并发生成不同子节点"的操作序，极端并发下可能出现本地内存树与远端不一致，靠 `loadState（Sync/刷新）` 收敛归一。
- **共享口令是单会话弱认证**：适合小团队/自用；若公开互联网且无 HTTPS 会泄露 token（部署默认 HTTPS）。

## 10. 开放问题（实现前需定）

1. `TaskStatus` 枚举放服务端校验，还是信任客户端？（方案默认服务端校验 ∈ {plan,progress,failed,done,delay}）
2. POST/PATCH 请求体校验力度：本期以最小必要校验（类型、必填、status 合法）为准，不做 zod 全量 schema？
3. `level` 是否完全信任客户端传入？（合理做法：服务端按 `parentID` 深度**强制计算**，避免脏数据；代价是多一次树遍历，代价可忽略）
