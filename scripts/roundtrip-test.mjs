// scripts/roundtrip-test.mjs
// 随机数据前后端往返测试：经真实 API 写入 → 读回逐条校验 → 清理。exit 0 即通过。
// 用法：
//   node scripts/roundtrip-test.mjs            # 随机写 → 读回校验 → 自清到空
//   node scripts/roundtrip-test.mjs --keep     # 随机写并保留（供重启持久化验证）
//   node scripts/roundtrip-test.mjs --clean    # 读回现库（应含保留数据）→ 全清 → 校验空
// 配置：读 .env 的 TOKEN；BASE 环境变量可覆盖基址（默认 http://localhost:8080）。

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.BASE ?? "http://localhost:8080";

function loadToken() {
    if (process.env.TOKEN) return process.env.TOKEN;
    try {
        const env = readFileSync(path.join(ROOT, ".env"), "utf8");
        for (const line of env.split("\n")) {
            const m = line.match(/^TOKEN=(.*)$/);
            if (m) return m[1].trim();
        }
    } catch {
        // 无 .env 时由下方统一报错
    }
    return "";
}

const TOKEN = loadToken();
if (!TOKEN) {
    console.error("FAIL: TOKEN 缺失（.env 或环境变量）");
    process.exit(2);
}

const headers = { Authorization: `Bearer ${TOKEN}` };
const json = { ...headers, "Content-Type": "application/json" };

async function api(p, init) {
    const res = await fetch(BASE + p, {
        ...init,
        headers: { ...headers, ...(init?.headers ?? {}) },
    });
    const body = res.status === 204 ? null : await res.json().catch(() => null);
    if (!res.ok) {
        const err = body?.error ?? "?";
        throw new Error(`${init?.method ?? "GET"} ${p} -> HTTP ${res.status}: ${err}`);
    }
    return body;
}

const assert = (cond, msg) => {
    if (!cond) {
        console.error("FAIL:", msg);
        process.exit(1);
    }
};

/* ---------- 随机数据池（与前端文案一致） ---------- */
const PROJECT_POOL = [
    "网站改版",
    "移动端 App",
    "数据迁移",
    "内部工具",
    "营销活动",
    "性能优化",
    "新客户接入",
    "支付子系统",
    "消息中心",
    "基础服务治理",
];
const SUMMARY_POOL = [
    "接口联调",
    "需求评审",
    "页面开发",
    "测试修复",
    "部署上线",
    "数据核对",
    "性能压测",
    "文档整理",
    "设计走查",
    "代码审查",
    "问题排查",
    "回归测试",
];
const DETAIL_POOL = [
    "与后端对齐字段与超时策略",
    "补齐边界用例并复查联调",
    "修复回归包中的两个缺陷",
    "补充监控告警与回滚预案",
    "核对线上数据与报表口径",
    "压测结果达到 QPS 目标",
    "整理周会同步材料",
    "走查并修整交互细节",
    "梳理历史遗留技术债",
    "补充多浏览器兼容处理",
];
const STATUS = ["plan", "progress", "failed", "done", "delay"];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const DAYS = 14;

function recentDates() {
    const out = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 0; i < DAYS; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        out.push(d.toISOString().slice(0, 10));
    }
    return out;
}

async function run() {
    const mode = process.argv[2] ?? "default";
    if (!["default", "--keep", "--clean"].includes(mode)) {
        console.error(`FAIL: 未知模式 ${mode}（支持 default / --keep / --clean）`);
        process.exit(2);
    }

    if (mode === "--clean") {
        const st = await api("/api/state");
        assert(
            st.projects.length >= 1,
            `--clean 期望读到保留数据（≥1 项目），实际 ${st.projects.length}`,
        );
        // 按 level 降序删：先删最深层子级，再删父级，避免父级级联后子级 404
        const ordered = st.projects
            .slice()
            .sort((a, b) => b.level - a.level);
        for (const p of ordered) {
            const r = await api(`/api/projects/${p.id}`, {
                method: "DELETE",
                headers,
            });
            assert(r.deleted >= 1, `删除项目 ${p.id} 失败`);
        }
        const end = await api("/api/state");
        assert(
            end.projects.length === 0 && end.logs.length === 0,
            `清空后应无数据，实际 projects=${end.projects.length} logs=${end.logs.length}`,
        );
        console.log(
            `CLEAN: 读回旧库 ${st.projects.length} 个项目（跨重启持久化生效）→ 全清 → 校验空，OK`,
        );
        return;
    }

    // default / --keep：先记现有 id，避免误删他数据
    const pre = await api("/api/state");
    const preIds = new Set(pre.projects.map((p) => p.id));

    const names = PROJECT_POOL.slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, 5 + Math.floor(Math.random() * 4)); // 5~8 个
    const dates = recentDates();

    const createdProjects = [];
    for (const name of names) {
        const r = await api("/api/projects", {
            method: "POST",
            headers: json,
            body: JSON.stringify({ parentID: null, name, status: pick(STATUS) }),
        });
        createdProjects.push(r.project);
    }

    const createdLogs = [];
    for (const p of createdProjects) {
        for (const d of dates) {
            if (Math.random() < 0.32) {
                const l = await api("/api/logs", {
                    method: "POST",
                    headers: json,
                    body: JSON.stringify({
                        projectID: p.id,
                        date: d,
                        summary: pick(SUMMARY_POOL),
                        detail: pick(DETAIL_POOL),
                    }),
                });
                createdLogs.push(l.log);
            }
        }
    }

    // ---- 额外场景：子项目 / 改名 / 同日多日志 ----
    const parent = createdProjects[0];
    const childRes = await api("/api/projects", {
        method: "POST",
        headers: json,
        body: JSON.stringify({
            parentID: parent.id,
            name: "子项目·测试",
            status: "progress",
        }),
    });
    const child = childRes.project;
    createdProjects.push(child);
    assert(child.level === 1, `子项目 level 应为 1, 实际 ${child.level}`);
    assert(child.parentID === parent.id, "子项目 parentID 应指向父级");
    assert(child.status === "progress", "子项目状态应保存为 progress");

    const renamed = `${parent.name}·改名`;
    const up = await api(`/api/projects/${parent.id}`, {
        method: "PATCH",
        headers: json,
        body: JSON.stringify({ name: renamed, status: "done" }),
    });
    assert(
        up.project.name === renamed && up.project.status === "done",
        "PATCH 改名/改状态未生效",
    );
    parent.name = renamed;
    parent.status = "done";

    const dayP = createdProjects[1];
    const d0 = dates[0]; // 今天
    const mkLog = (summary, opts = {}) =>
        api("/api/logs", {
            method: "POST",
            headers: json,
            body: JSON.stringify({
                projectID: dayP.id,
                date: d0,
                summary,
                detail: "同日多日志测试",
                category: "开发",
                tags: ["冒烟", "回归"],
                timeStart: opts.timeStart ?? null,
                timeEnd: opts.timeEnd ?? null,
                done: opts.done ?? false,
                urgent: opts.urgent ?? false,
                important: opts.important ?? false,
            }),
        });
    const l1 = (
        await mkLog("联调进行中", {
            timeStart: "09:30",
            timeEnd: "10:00",
            urgent: true,
            important: true,
        })
    ).log;
    const l2 = (await mkLog("已完成联调", { timeStart: "14:00", done: true }))
        .log;
    createdLogs.push(l1, l2);
    assert(l1.id !== l2.id, "同日两条日志 id 应不同");
    assert(
        l1.timeStart === "09:30" &&
            l1.timeEnd === "10:00" &&
            l1.done === false &&
            l1.urgent === true &&
            l1.important === true,
        "时间/完成/紧急/重要字段未正确回显",
    );
    assert(l2.done === true, "l2 完成标记未回显");

    // 非法时间（end<start）应 400
    let badRejected = false;
    try {
        await api("/api/logs", {
            method: "POST",
            headers: json,
            body: JSON.stringify({
                projectID: dayP.id,
                date: d0,
                summary: "非法时间",
                timeStart: "14:00",
                timeEnd: "09:00",
            }),
        });
    } catch {
        badRejected = true;
    }
    assert(badRejected, "timeEnd 早于 timeStart 应被拒绝(400)");

    const patched = (
        await api(`/api/logs/${l1.id}`, {
            method: "PATCH",
            headers: json,
            body: JSON.stringify({
                summary: "联调超时",
                tags: ["全量"],
                done: true,
                urgent: false,
                important: false,
            }),
        })
    ).log;
    assert(
        patched.summary === "联调超时" &&
            patched.tags.join(",") === "全量" &&
            patched.done === true &&
            patched.urgent === false &&
            patched.important === false,
        "PATCH 日志未生效",
    );
    Object.assign(l1, patched);

    const delL = await api(`/api/logs/${l2.id}`, { method: "DELETE", headers });
    assert(delL.deleted === 1, "删除同日第二条日志失败");
    const l2idx = createdLogs.findIndex((x) => x.id === l2.id);
    if (l2idx >= 0) createdLogs.splice(l2idx, 1);

    // 读回逐条校验
    const after = await api("/api/state");
    const ps = new Map(after.projects.map((x) => [x.id, x]));
    const ls = new Map(after.logs.map((x) => [x.id, x]));
    assert(
        after.projects.length === preIds.size + createdProjects.length,
        `项目数不一致：期望 ${preIds.size + createdProjects.length}, 实际 ${after.projects.length}`,
    );
    for (const p of createdProjects) {
        const got = ps.get(p.id);
        assert(got, `写入项目「${p.name}」未在 state 中读回`);
        assert(got.name === p.name, `项目 ${p.id} 名称不一致`);
        assert(got.status === p.status, `项目 ${p.id} 状态不一致`);
    }
    for (const l of createdLogs) {
        const got = ls.get(l.id);
        assert(got, `写入日志 ${l.id} 未在 state 中读回`);
        assert(
            got.projectID === l.projectID &&
                got.date === l.date &&
                got.summary === l.summary &&
                got.detail === l.detail &&
                got.timeStart === (l.timeStart ?? null) &&
                got.timeEnd === (l.timeEnd ?? null) &&
                Boolean(got.done) === Boolean(l.done) &&
                Boolean(got.urgent) === Boolean(l.urgent) &&
                Boolean(got.important) === Boolean(l.important) &&
                got.category === (l.category ?? null) &&
                (got.tags ?? []).join(",") === (l.tags ?? []).join(","),
            `日志 ${l.id} 字段不一致`,
        );
    }

    if (mode === "--keep") {
        console.log(
            `KEEP: 写入 ${createdProjects.length} 项目 / ${createdLogs.length} 日志并保留，读回一致，OK`,
        );
        return;
    }

    // default：删除自己写入的项目（级联清其日志）——逆序先删子项目，避免父级级联后 404
    for (const p of createdProjects.slice().reverse()) {
        const r = await api(`/api/projects/${p.id}`, {
            method: "DELETE",
            headers,
        });
        assert(r.deleted >= 1, `删除项目 ${p.id} 失败`);
    }
    const end = await api("/api/state");
    assert(
        end.projects.length === preIds.size,
        `清理后项目数应回退到 ${preIds.size}, 实际 ${end.projects.length}`,
    );
    const ourIds = new Set(createdLogs.map((l) => l.id));
    const left = end.logs.filter((l) => ourIds.has(l.id)).length;
    assert(left === 0, `清理后仍有 ${left} 条本脚本写入的日志残留`);
    console.log(
        `ROUNDTRIP: 写入 ${createdProjects.length} 项目 / ${createdLogs.length} 日志 → 读回一致 → 级联删除 → 校验回退，OK`,
    );
}

run().catch((e) => {
    console.error("FAIL:", e.message);
    process.exit(1);
});
