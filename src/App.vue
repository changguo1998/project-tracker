<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { TaskStatus } from "@/types/main";
import type { ApiProject, ApiLog } from "@/types/main";
import {
    getState,
    addProject,
    addLog,
    deleteProject,
} from "@/api";

/* ---------- 随机数据池（仅用于生成示例内容，写入走后端） ---------- */
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
const projects = ref<ApiProject[]>([]);
const logs = ref<ApiLog[]>([]);
const busy = ref(false);
const error = ref("");

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
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
const logOf = (pid: string, d: string): ApiLog | undefined =>
    logs.value.find((l) => l.projectID === pid && l.date === d);
const logCount = computed(() => logs.value.length);
const totalDays = computed(() => dates.value.length);
const hasData = computed(() => projects.value.length > 0);

/* ---------- 与后端交互 ---------- */
async function load(): Promise<void> {
    const st = await getState();
    projects.value = st.projects;
    logs.value = st.logs;
}

/** 随机生成：把示例数据真实写入后端，再从 state 读回渲染 */
async function randomize(): Promise<void> {
    busy.value = true;
    error.value = "";
    try {
        const n = 5 + Math.floor(Math.random() * 4); // 5~8 个项目
        const names = PROJECT_POOL.slice()
            .sort(() => Math.random() - 0.5)
            .slice(0, n);
        const created: ApiProject[] = [];
        for (const name of names) {
            created.push(await addProject({ parentID: null, name }));
        }
        for (const p of created) {
            for (const d of dates.value) {
                if (Math.random() < 0.32) {
                    await addLog({
                        projectID: p.id,
                        date: d,
                        status: pick(STATUS),
                        summary: pick(SUMMARY_POOL),
                        detail: pick(DETAIL_POOL),
                    });
                }
            }
        }
        await load(); // 以服务端为准回读
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        await load(); // 失败也回读，保持与库一致
    } finally {
        busy.value = false;
    }
}

/** 清空：逐个 DELETE 项目（级联清其日志） */
async function clear(): Promise<void> {
    busy.value = true;
    error.value = "";
    try {
        for (const id of projects.value.map((p) => p.id)) {
            await deleteProject(id);
        }
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        await load();
    } finally {
        busy.value = false;
    }
}

onMounted(() => {
    load().catch((e: unknown) => {
        error.value = e instanceof Error ? e.message : String(e);
    });
});
</script>

<template>
    <v-app class="app">
        <!-- 标题栏 -->
        <v-app-bar flat elevation="0" color="surface" border="b">
            <div class="brand">
                <v-icon start color="primary">mdi-calendar-month</v-icon>
                <span class="brand-name">项目时间表</span>
                <span class="brand-sub">Project Tracker</span>
            </div>
            <template #append>
                <div class="actions">
                    <v-chip
                        v-if="hasData"
                        variant="outlined"
                        size="small"
                        color="secondary"
                        class="stat-chip"
                    >
                        {{ projects.length }} 个项目 · {{ logCount }} 条记录 ·
                        近 {{ totalDays }} 天
                    </v-chip>
                    <v-btn
                        variant="tonal"
                        :disabled="busy || !hasData"
                        prepend-icon="mdi-delete-outline"
                        @click="clear"
                    >
                        清空
                    </v-btn>
                    <v-btn
                        color="primary"
                        :disabled="busy"
                        prepend-icon="mdi-dice-5"
                        @click="randomize"
                    >
                        随机生成数据
                    </v-btn>
                </div>
            </template>
        </v-app-bar>

        <v-progress-linear
            v-if="busy"
            indeterminate
            color="primary"
            height="2"
        />

        <!-- 内容区 -->
        <v-main>
            <v-container fluid class="content">
                <!-- 错误提示 -->
                <v-alert
                    v-if="error"
                    type="error"
                    variant="tonal"
                    closable
                    class="err"
                    @click:close="error = ''"
                >
                    {{ error }}
                </v-alert>

                <!-- 空状态 -->
                <v-card v-if="!hasData && !busy" class="empty">
                    <v-icon size="52" color="secondary">
                        mdi-calendar-blank-outline
                    </v-icon>
                    <div class="empty-title">还没有数据</div>
                    <div class="empty-sub">
                        点击右上角「随机生成数据」写入示例时间表（数据保存在后端）
                    </div>
                </v-card>

                <!-- 日期 × 项目表格 -->
                <v-card v-else class="table-card">
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
                                    :class="{
                                        'row-today': isToday(d),
                                        'row-weekend': isWeekend(d),
                                    }"
                                >
                                    <td class="date-col">
                                        <span class="date-text">{{ d }}</span>
                                        <v-chip
                                            v-if="isToday(d)"
                                            size="x-small"
                                            color="primary"
                                            class="today-tag"
                                        >
                                            今天
                                        </v-chip>
                                    </td>
                                    <td
                                        v-for="p in projects"
                                        :key="p.id"
                                        class="cell"
                                        :class="{
                                            'cell-empty': !logOf(p.id, d),
                                        }"
                                    >
                                        <template
                                            v-if="logOf(p.id, d)"
                                        >
                                            <div
                                                class="log"
                                                :title="`${STATUS_NAME[logOf(p.id, d)!.status]} · ${logOf(p.id, d)!.detail}`"
                                            >
                                                <v-chip
                                                    size="x-small"
                                                    :class="['badge', `st-${logOf(p.id, d)!.status}`]"
                                                >
                                                    {{
                                                        STATUS_NAME[
                                                            logOf(p.id, d)!.status
                                                        ]
                                                    }}
                                                </v-chip>
                                                <span class="summary">
                                                    {{
                                                        logOf(p.id, d)!.summary
                                                    }}
                                                </span>
                                            </div>
                                        </template>
                                        <span v-else class="plus">＋</span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </v-card>
            </v-container>
        </v-main>
    </v-app>
</template>

<style scoped>
.app {
    background: #f1f5f9;
}

/* ---------- 标题栏 ---------- */
.brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
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
    padding-right: 8px;
}
.stat-chip {
    white-space: nowrap;
}

/* ---------- 内容区 ---------- */
.content {
    padding: 24px;
}
.err {
    margin-bottom: 16px;
}
.empty {
    margin: 12vh auto 0;
    max-width: 440px;
    padding: 48px 24px;
    text-align: center;
    color: #64748b;
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
    overflow: hidden;
}
.table-scroll {
    overflow: auto;
    max-height: calc(100vh - 128px);
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
    font-style: normal;
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
}
.summary {
    color: #334155;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 200px;
}

/* 状态徽章配色（覆盖 v-chip 默认色） */
.badge.st-plan {
    background: #f1f5f9;
    color: #475569;
}
.badge.st-progress {
    background: #dbeafe;
    color: #1d4ed8;
}
.badge.st-failed {
    background: #fee2e2;
    color: #b91c1c;
}
.badge.st-done {
    background: #dcfce7;
    color: #15803d;
}
.badge.st-delay {
    background: #fef3c7;
    color: #b45309;
}
</style>
