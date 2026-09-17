import express from "express";
import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";

// TOKEN fail-fast：必须在任何 DB 初始化/服务启动之前
if (!process.env.TOKEN) {
  console.error("TOKEN required");
  process.exit(1);
}
const TOKEN = process.env.TOKEN;

// ---------- DB ----------
const DB_PATH = process.env.DB_PATH || "./server/data/tracker.db";
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
const db = new DatabaseSync(DB_PATH);

db.exec(`CREATE TABLE IF NOT EXISTS projects(
  id TEXT PRIMARY KEY,
  parentID TEXT,
  name TEXT,
  level INTEGER,
  updatedAt TEXT
)`);
db.exec(`CREATE TABLE IF NOT EXISTS logs(
  id TEXT PRIMARY KEY,
  projectID TEXT,
  date TEXT,
  status TEXT,
  summary TEXT,
  detail TEXT,
  category TEXT,
  tags TEXT,
  updatedAt TEXT
)`);

// 幂等迁移：老库（无 category/tags 列）补齐字段
const logCols = db
  .prepare("PRAGMA table_info(logs)")
  .all()
  .map((c) => c.name);
if (!logCols.includes("category"))
  db.exec("ALTER TABLE logs ADD COLUMN category TEXT");
if (!logCols.includes("tags")) db.exec("ALTER TABLE logs ADD COLUMN tags TEXT");

const VALID_STATUS = new Set(["plan", "progress", "failed", "done", "delay"]);
const now = () => new Date().toISOString();
const bodyError = (msg) => ({ error: msg });

// 事务包装
function tx(fn) {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ---------- app ----------
const app = express();
app.use(express.json());

// 请求日志：方法 + 空格 + 路径 + 空格 + 状态码
app.use((req, res, next) => {
  res.on("finish", () =>
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode}`),
  );
  next();
});

// 鉴权（仅 /api）：token 不匹配 401 短路，不落库
app.use("/api", (req, res, next) => {
  if (req.get("Authorization") !== `Bearer ${TOKEN}`) {
    return res.status(401).json(bodyError("unauthorized"));
  }
  next();
});

// ---------- 七条 API 路由 ----------

// GET /api/state
app.get("/api/state", (req, res) => {
  const projects = db
    .prepare("SELECT id, parentID, name, level FROM projects ORDER BY name")
    .all();
  const parseTags = (t) => {
    if (t == null) return [];
    try {
      const a = JSON.parse(t);
      return Array.isArray(a) ? a : [];
    } catch {
      return [];
    }
  };
  const logs = db
    .prepare(
      "SELECT id, projectID, date, status, summary, detail, category, tags FROM logs ORDER BY date",
    )
    .all()
    .map((l) => ({ ...l, tags: parseTags(l.tags) }));
  res.json({ projects, logs });
});

// POST /api/projects
app.post("/api/projects", (req, res) => {
  const b = req.body || {};
  if (typeof b !== "object" || Array.isArray(b))
    return res.status(400).json(bodyError("name: 必须是对象"));
  if (typeof b.name !== "string" || b.name.trim() === "") {
    return res.status(400).json(bodyError("name: 必填字符串"));
  }
  if (
    b.parentID !== null &&
    b.parentID !== undefined &&
    typeof b.parentID !== "string"
  ) {
    return res.status(400).json(bodyError("parentID: 类型错误"));
  }

  let level = 0;
  if (b.parentID !== null && b.parentID !== undefined && b.parentID !== "") {
    const parent = db
      .prepare("SELECT level FROM projects WHERE id = ?")
      .get(b.parentID);
    if (!parent)
      return res
        .status(400)
        .json(bodyError(`parentID: 项目 ${b.parentID} 不存在`));
    level = parent.level + 1;
  } else {
    b.parentID = null; // 缺失/空/显式 null 一律视为根级
  }

  const id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO projects(id, parentID, name, level, updatedAt) VALUES (?,?,?,?,?)",
  ).run(id, b.parentID, b.name, level, now());
  const project = { id, parentID: b.parentID, name: b.name, level };
  res.status(201).json({ id, project });
});

// PATCH /api/projects/:id
app.patch("/api/projects/:id", (req, res) => {
  const b = req.body || {};
  if (typeof b !== "object" || Array.isArray(b))
    return res.status(400).json(bodyError("name: 必须是对象"));
  if (Object.keys(b).length === 0)
    return res.status(400).json(bodyError("无字段可更新"));
  if (!("name" in b)) return res.status(400).json(bodyError("name: 必填"));
  if (typeof b.name !== "string" || b.name.trim() === "") {
    return res.status(400).json(bodyError("name: 必填字符串"));
  }

  const existing = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(req.params.id);
  if (!existing) return res.status(404).json(bodyError("not found"));

  db.prepare("UPDATE projects SET name = ?, updatedAt = ? WHERE id = ?").run(
    b.name,
    now(),
    req.params.id,
  );
  const row = db
    .prepare("SELECT id, parentID, name, level FROM projects WHERE id = ?")
    .get(req.params.id);
  res.json({ project: row });
});

// DELETE /api/projects/:id（单事务级联删子树 + 关联 logs）
app.delete("/api/projects/:id", (req, res) => {
  const root = db
    .prepare("SELECT id FROM projects WHERE id = ?")
    .get(req.params.id);
  if (!root) return res.status(404).json(bodyError("not found"));

  let deleted = 0;
  tx(() => {
    const ids = db
      .prepare(`WITH RECURSIVE subtree(id) AS (
        SELECT id FROM projects WHERE id = ?
        UNION ALL
        SELECT p.id FROM projects p JOIN subtree s ON p.parentID = s.id
      ) SELECT id FROM subtree`)
      .all(req.params.id)
      .map((r) => r.id);

    const ph = ids.map(() => "?").join(",");
    db.prepare(`DELETE FROM logs WHERE projectID IN (${ph})`).run(...ids);
    deleted = db
      .prepare(`DELETE FROM projects WHERE id IN (${ph})`)
      .run(...ids).changes;
  });
  res.json({ deleted });
});

// POST /api/logs
app.post("/api/logs", (req, res) => {
  const b = req.body || {};
  if (typeof b !== "object" || Array.isArray(b))
    return res.status(400).json(bodyError("projectID: 必须是对象"));

  if (typeof b.projectID !== "string" || b.projectID === "") {
    return res.status(400).json(bodyError("projectID: 必填字符串"));
  }
  if (!db.prepare("SELECT id FROM projects WHERE id = ?").get(b.projectID)) {
    return res
      .status(400)
      .json(bodyError(`projectID: 项目 ${b.projectID} 不存在`));
  }
  if (typeof b.date !== "string" || b.date === "") {
    return res.status(400).json(bodyError("date: 必填字符串"));
  }
  if (typeof b.status !== "string" || !VALID_STATUS.has(b.status)) {
    return res.status(400).json(bodyError("invalid status"));
  }
  if (b.summary !== undefined && typeof b.summary !== "string")
    return res.status(400).json(bodyError("summary: 类型错误"));
  if (b.detail !== undefined && typeof b.detail !== "string")
    return res.status(400).json(bodyError("detail: 类型错误"));
  const id = crypto.randomUUID();
  if (
    b.category !== undefined &&
    b.category !== null &&
    typeof b.category !== "string"
  )
    return res.status(400).json(bodyError("category: 类型错误"));
  if (
    b.tags !== undefined &&
    (!Array.isArray(b.tags) || b.tags.some((t) => typeof t !== "string"))
  )
    return res.status(400).json(bodyError("tags: 字符串数组"));
  const summary = b.summary ?? "";
  const detail = b.detail ?? "";
  const category = b.category ?? null;
  const tags = JSON.stringify(b.tags ?? []);
  db.prepare(
    "INSERT INTO logs(id, projectID, date, status, summary, detail, category, tags, updatedAt) VALUES (?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    b.projectID,
    b.date,
    b.status,
    summary,
    detail,
    category,
    tags,
    now(),
  );
  const log = {
    id,
    projectID: b.projectID,
    date: b.date,
    status: b.status,
    summary,
    detail,
    category,
    tags: b.tags ?? [],
  };
  res.status(201).json({ id, log });
});

// PATCH /api/logs/:id（覆盖语义：提供哪些字段就覆盖哪些）
app.patch("/api/logs/:id", (req, res) => {
  const b = req.body || {};
  if (typeof b !== "object" || Array.isArray(b))
    return res.status(400).json(bodyError("status: 必须是对象"));
  if (Object.keys(b).length === 0)
    return res.status(400).json(bodyError("无字段可更新"));

  const existing = db
    .prepare("SELECT * FROM logs WHERE id = ?")
    .get(req.params.id);
  if (!existing) return res.status(404).json(bodyError("not found"));

  const fields = {};
  for (const key of [
    "date",
    "status",
    "summary",
    "detail",
    "category",
    "tags",
  ]) {
    if (key in b) fields[key] = b[key];
  }
  if (
    "date" in fields &&
    (typeof fields.date !== "string" || fields.date === "")
  ) {
    return res.status(400).json(bodyError("date: 必填字符串"));
  }
  if (
    "status" in fields &&
    (typeof fields.status !== "string" || !VALID_STATUS.has(fields.status))
  ) {
    return res.status(400).json(bodyError("invalid status"));
  }
  if (
    "summary" in fields &&
    fields.summary !== null &&
    typeof fields.summary !== "string"
  ) {
    return res.status(400).json(bodyError("summary: 类型错误"));
  }
  if (
    "detail" in fields &&
    fields.detail !== null &&
    typeof fields.detail !== "string"
  ) {
    return res.status(400).json(bodyError("detail: 类型错误"));
  }

  if (
    "category" in fields &&
    fields.category !== null &&
    typeof fields.category !== "string"
  )
    return res.status(400).json(bodyError("category: 类型错误"));
  if (
    "tags" in fields &&
    (!Array.isArray(fields.tags) ||
      fields.tags.some((t) => typeof t !== "string"))
  )
    return res.status(400).json(bodyError("tags: 字符串数组"));
  if ("tags" in fields) fields.tags = JSON.stringify(fields.tags);

  const assignments = Object.keys(fields)
    .map((k) => `${k} = ?`)
    .join(", ");
  db.prepare(`UPDATE logs SET ${assignments}, updatedAt = ? WHERE id = ?`).run(
    ...Object.values(fields),
    now(),
    req.params.id,
  );
  const row = db
    .prepare(
      "SELECT id, projectID, date, status, summary, detail, category, tags FROM logs WHERE id = ?",
    )
    .get(req.params.id);
  let tagsArr = [];
  try {
    const a = JSON.parse(row.tags);
    if (Array.isArray(a)) tagsArr = a;
  } catch {
    // 历史脏数据，按空标签处理
  }
  res.json({ log: { ...row, tags: tagsArr } });
});

// DELETE /api/logs/:id
app.delete("/api/logs/:id", (req, res) => {
  const existing = db
    .prepare("SELECT id FROM logs WHERE id = ?")
    .get(req.params.id);
  if (!existing) return res.status(404).json(bodyError("not found"));
  db.prepare("DELETE FROM logs WHERE id = ?").run(req.params.id);
  res.json({ deleted: 1 });
});

// ---------- 静态托管 + SPA fallback（API 之后） ----------
const DIST_DIR = path.resolve(import.meta.dirname, "../dist");
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR));
  app.get("*", (_req, res) => res.sendFile(path.join(DIST_DIR, "index.html")));
} else {
  console.warn(`dist 不存在于 ${DIST_DIR}，仅 API 可用`);
}

// 非法 JSON body 统一 400 JSON 错误体
app.use((err, _req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json(bodyError("invalid JSON"));
  }
  next(err);
});

// ---------- 启动 ----------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`project-tracker server listening on :${PORT}`);
  if (fs.existsSync(DIST_DIR)) console.log(`serving static from ${DIST_DIR}`);
});
