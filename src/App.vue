<script setup lang="ts">
import { ref, computed } from "vue";
import type { TaskStatus } from "@/types/main";

/* ---------- 类型与随机数据池 ---------- */
interface DemoProject {
    id: string;
    name: string;
}
interface DemoLog {
    id: string;
    projectID: string;
    date: string;
    status: TaskStatus;
    summary: string;
    detail: string;
}

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
const STATUS: TaskStatus[] = ["plan", "progress", "failed", "done", "delay"];
const STATUS_NAME: Record<TaskStatus, string> = {
    plan: "计划",
    progress: "进行中",
    failed: "失败",
    done: "完成",
    delay: "延迟",
};

const DAYS = 14;

/* ---------- 状态 ---------- */
const projects = ref<DemoProject[]>([]);
const logs = ref<DemoLog[]>([]);

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const uid = (): string => Math.random().toString(36).slice(2, 10);
const dateStr = (d: Date): string => d.toISOString().slice(0, 10);

/** 近 DAYS 天（含今天），降序：今天的行在最上 */
const dates = computed((): string[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: string[] = [];
    for (let i = 0; i < DAYS; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        out.push(dateStr(d));
    }
    return out;
});

const isToday = (d: string): boolean => d === dateStr(new Date());
const isWeekend = (d: string): boolean => {
    const day = new Date(`${d}T00:00:00`).getDay();
    return day === 0 || day === 6;
};
const logOf = (pid: string, d: string): DemoLog | undefined =>
    logs.value.find((l) => l.projectID === pid && l.date === d);
const logCount = computed(() => logs.value.length);
const totalDays = computed(() => dates.value.length);
const hasData = computed(() => projects.value.length > 0);

/* ---------- 随机生成 / 清空 ---------- */
function randomize(): void {
    const n = 5 + Math.floor(Math.random() * 4); // 5~8 个项目
    projects.value = PROJECT_POOL.slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, n)
        .map((name) => ({ id: uid(), name }));
    const ls: DemoLog[] = [];
    for (const p of projects.value) {
        for (const d of dates.value) {
            if (Math.random() < 0.32) {
                ls.push({
                    id: uid(),
                    projectID: p.id,
                    date: d,
                    status: pick(STATUS),
                    summary: pick(SUMMARY_POOL),
                    detail: pick(DETAIL_POOL),
                });
            }
        }
    }
    logs.value = ls;
}

function clear(): void {
    projects.value = [];
    logs.value = [];
}
</script>

<template>
    <div class="app">
        <header class="topbar">
            <div class="brand">
                <span class="brand-mark">📅</span>
                <span class="brand-name">项目时间表</span>
                <span class="brand-sub">Project Tracker</span>
            </div>
            <div class="actions">
                <span v-if="hasData" class="stat">
                    {{ projects.length }} 个项目 · {{ logCount }} 条记录 · 近
                    {{ totalDays }} 天
                </span>
                <button class="btn ghost" :disabled="!hasData" @click="clear">
                    清空
                </button>
                <button class="btn primary" @click="randomize">
                    随机生成数据
                </button>
            </div>
        </header>

        <main class="content">
            <div v-if="!hasData" class="empty card">
                <div class="empty-mark">🗓</div>
                <p class="empty-title">还没有数据</p>
                <p class="empty-sub">点击右上角「随机生成数据」填充示例时间表</p>
            </div>

            <div v-else class="card table-card">
                <div class="table-scroll">
                    <table>
                        <thead>
                            <tr>
                                <th class="date-col">日期</th>
                                <th v-for="p in projects" :key="p.id">
                                    {{ p.name }}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr
                                v-for="d in dates"
                                :key="d"
                                :class="{ 'row-today': isToday(d), 'row-weekend': isWeekend(d) }"
                            >
                                <td class="date-col">
                                    <span class="date-text">{{ d }}</span>
                                    <span v-if="isToday(d)" class="today-tag"
                                        >今天</span
                                    >
                                </td>
                                <td
                                    v-for="p in projects"
                                    :key="p.id"
                                    class="cell"
                                    :class="{ 'cell-empty': !logOf(p.id, d) }"
                                >
                                    <template v-if="logOf(p.id, d)">
                                        <div
                                            class="log"
                                            :title="`${STATUS_NAME[logOf(p.id, d)!.status]} · ${logOf(p.id, d)!.detail}`"
                                        >
                                            <span
                                                class="badge"
                                                :class="`st-${logOf(p.id, d)!.status}`"
                                            >
                                                {{ STATUS_NAME[logOf(p.id, d)!.status] }}
                                            </span>
                                            <span class="summary">
                                                {{ logOf(p.id, d)!.summary }}
                                            </span>
                                        </div>
                                    </template>
                                    <span v-else class="plus">＋</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>
</template>

<style scoped>
.app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
}

/* ---------- 标题栏 ---------- */
.topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 24px;
    background: #fff;
    border-bottom: 1px solid #e2e8f0;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}
.brand {
    display: flex;
    align-items: baseline;
    gap: 8px;
}
.brand-mark {
    font-size: 20px;
}
.brand-name {
    font-size: 17px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.5px;
}
.brand-sub {
    font-size: 12px;
    color: #94a3b8;
}
.actions {
    display: flex;
    align-items: center;
    gap: 10px;
}
.stat {
    font-size: 12.5px;
    color: #64748b;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    padding: 4px 12px;
    white-space: nowrap;
}

/* ---------- 按钮 ---------- */
.btn {
    font: inherit;
    font-size: 13.5px;
    border-radius: 8px;
    padding: 7px 14px;
    cursor: pointer;
    border: 1px solid transparent;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
}
.btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
}
.btn.primary {
    background: #2563eb;
    color: #fff;
}
.btn.primary:hover:not(:disabled) {
    background: #1d4ed8;
}
.btn.ghost {
    background: #fff;
    color: #334155;
    border-color: #cbd5e1;
}
.btn.ghost:hover:not(:disabled) {
    background: #f1f5f9;
}

/* ---------- 内容区 ---------- */
.content {
    flex: 1;
    padding: 24px;
    display: flex;
    flex-direction: column;
}
.card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.06);
}

/* ---------- 空状态 ---------- */
.empty {
    margin: auto;
    padding: 48px 64px;
    text-align: center;
    color: #64748b;
}
.empty-mark {
    font-size: 40px;
}
.empty-title {
    font-size: 16px;
    font-weight: 600;
    color: #334155;
    margin: 12px 0 4px;
}
.empty-sub {
    font-size: 13px;
    margin: 0;
}

/* ---------- 表格 ---------- */
.table-card {
    align-self: flex-start;
    width: 100%;
    overflow: hidden;
}
.table-scroll {
    overflow: auto;
    max-height: calc(100vh - 96px);
}
table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    min-width: 860px;
    font-size: 13px;
}
thead th {
    position: sticky;
    top: 0;
    z-index: 5;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
}
tbody td {
    padding: 8px 14px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
}
tbody tr:hover td {
    background: #f8fafc;
}
tbody tr.row-today td {
    background: #eff6ff;
}
tbody tr.row-today:hover td {
    background: #e8f0fe;
}
tbody tr.row-weekend td {
    background: #faf9f7;
}

/* 首列日期：冻结在左侧 */
.date-col {
    position: sticky;
    left: 0;
    z-index: 2;
    background: #f8fafc;
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
}
tbody .date-col {
    background: #f8fafc;
}
tbody tr.row-today .date-col {
    background: #eff6ff;
}
tbody tr.row-weekend .date-col {
    background: #f5f3ef;
}
td.date-col {
    border-right: 1px solid #e2e8f0;
}
.date-text {
    margin-right: 6px;
}
.today-tag {
    font-size: 11px;
    color: #2563eb;
    background: #dbeafe;
    border-radius: 999px;
    padding: 1px 7px;
    font-weight: 600;
}

/* ---------- 单元格 ---------- */
.cell {
    min-width: 132px;
}
.cell-empty {
    color: #cbd5e1;
    text-align: center;
}
.plus {
    opacity: 0;
    transition: opacity 0.15s;
}
tr:hover .plus {
    opacity: 0.7;
}
.log {
    display: flex;
    align-items: center;
    gap: 8px;
}
.badge {
    flex: 0 0 auto;
    font-size: 11px;
    border-radius: 999px;
    padding: 2px 8px;
    font-weight: 600;
}
.st-plan {
    color: #475569;
    background: #f1f5f9;
}
.st-progress {
    color: #1d4ed8;
    background: #dbeafe;
}
.st-failed {
    color: #b91c1c;
    background: #fee2e2;
}
.st-done {
    color: #15803d;
    background: #dcfce7;
}
.st-delay {
    color: #b45309;
    background: #fef3c7;
}
.summary {
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}
</style>
