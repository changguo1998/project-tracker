<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import type { TaskStatus } from "@/types/main";
import type { ApiProject, ApiLog } from "@/types/main";
import {
    getState,
    addProject,
    patchProject,
    deleteProject,
    addLog,
    patchLog,
    deleteLog,
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

const CHILD_POOL = [
    "需求调研",
    "方案设计",
    "UI 实现",
    "接口开发",
    "联调测试",
    "上线部署",
    "数据核对",
    "运维监控",
];
const STATUS: TaskStatus[] = ["plan", "progress", "failed", "done", "delay"];
const STATUS_NAME: Record<TaskStatus, string> = {
    plan: "计划",
    progress: "进行中",
    failed: "失败",
    done: "完成",
    delay: "延迟",
};
const STATUS_ITEMS = STATUS.map((s) => ({ title: STATUS_NAME[s], value: s }));


const CATEGORY_POOL = [
    "开发",
    "测试",
    "设计",
    "会议",
    "文档",
    "运维",
    "其他",
];
const DEFAULT_TAGS = ["紧急", "阻塞", "重点", "本周"];
const DAYS = 14;
/** 表格只展示到该层级：0=仅根，1=根+直接子级 */
const MAX_DEPTH = 1;

/* ---------- 状态 ---------- */
const projects = ref<ApiProject[]>([]);
const logs = ref<ApiLog[]>([]);
const busy = ref(false);
const error = ref("");
/** 已展开（显示其子级列）的项目 id 集合 */
const expanded = ref<Set<string>>(new Set());

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const dateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`; // 本地时区日期（toISOString 为 UTC，东八区会显示成前一天）
};

/** 未来计划天数（可在标题栏调整） */
const futureDays = ref(7);

/** 日期序列：未来（+1..+F，升序）→ 今天 → 过去（-1..-DAYS，降序）
 *  未来部分用于添加计划；今天行以「今天」标签与底色标识 */
const dates = computed((): string[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: string[] = [];
    for (let i = 1; i <= futureDays.value; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        out.push(dateStr(d));
    }
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

/* ---------- 子树 ---------- */
const childrenOf = (id: string): ApiProject[] =>
    projects.value.filter((p) => p.parentID === id);
const hasChildren = (id: string): boolean => childrenOf(id).length > 0;
const roots = computed(() => projects.value.filter((p) => !p.parentID));

/* 筛选：勾选要渲染的根项目（子级随根显示） */
const selectedRoots = ref<Set<string>>(new Set());
const selectedRootsList = computed(() =>
    roots.value.filter((r) => selectedRoots.value.has(r.id)),
);
function toggleRoot(id: string, on: boolean): void {
    const s = new Set(selectedRoots.value);
    if (on) s.add(id);
    else s.delete(id);
    selectedRoots.value = s;
}

/** 可见列：按被勾选的根树 DFS 展开排序（收起的父级不进入其子级列） */
const visibleProjects = computed<ApiProject[]>(() => {
    const acc: ApiProject[] = [];
    const walk = (list: ApiProject[]): void => {
        for (const p of list) {
            acc.push(p);
            if (expanded.value.has(p.id) && p.level < MAX_DEPTH)
                walk(childrenOf(p.id));
        }
    };
    walk(selectedRootsList.value);
    return acc;
});


/* ---------- 树形表头（分组带 + 底部逐列格） ---------- */
/** 是否存在子项目（决定是否渲染分组带行） */
const hasSubtree = computed(() =>
    visibleProjects.value.some((p) => p.level > 0),
);
/** 该组可见列数（自身 + 展开的子孙），用于父级分组带 colspan */
function subtreeSpan(p: ApiProject): number {
    let n = 1;
    if (expanded.value.has(p.id) && p.level < MAX_DEPTH) {
        for (const c of childrenOf(p.id)) n += subtreeSpan(c);
    }
    return n;
}

/* ---------- 项目列配色：同族同色系，层级递浅 ---------- */
const FAMILY_HUES = [210, 145, 45, 330, 265, 190];
/** 找到项目所属根（沿 parentID 上溯） */
function rootOf(p: ApiProject): ApiProject {
    const byId = new Map(projects.value.map((x) => [x.id, x]));
    let cur = p;
    while (cur.parentID && byId.has(cur.parentID)) {
        cur = byId.get(cur.parentID)!;
    }
    return cur;
}
/** 列背景色：根按色板区分；子级同色系、更浅更淡 */
function columnBgColor(p: ApiProject): string {
    const root = rootOf(p);
    const order = roots.value.findIndex((r) => r.id === root.id);
    const hue = FAMILY_HUES[Math.max(0, order) % FAMILY_HUES.length];
    const lvl = p.level;
    const sat = 80 - lvl * 8;
    const light = 90 + lvl * 2;
    const alpha = Math.max(0.28, 0.9 - lvl * 0.12);
    return `hsla(${hue}, ${sat}%, ${light}%, ${alpha})`;
}
/** 可读文字色：同色相、深色（供筛选栏标签等使用） */
function columnTextColor(p: ApiProject): string {
    const root = rootOf(p);
    const order = roots.value.findIndex((r) => r.id === root.id);
    const hue = FAMILY_HUES[Math.max(0, order) % FAMILY_HUES.length];
    return `hsl(${hue}, 55%, 30%)`;
}
function toggleExpand(id: string): void {
    const s = new Set(expanded.value);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    expanded.value = s;
}

/** 一键折叠所有项目（清空展开集） */
function collapseAll(): void {
    expanded.value = new Set();
}
/** 一键展开所有项目（展开全部可展示层级且有子级的项目） */
function expandAll(): void {
    const s = new Set<string>();
    for (const p of projects.value) {
        if (hasChildren(p.id) && p.level < MAX_DEPTH) s.add(p.id);
    }
    expanded.value = s;
}

/* ---------- 日志查询 ---------- */
/** 该日日志（同日内按入库序，后插在前作为"最新"展示） */
const logsFor = (pid: string, d: string): ApiLog[] =>
    logs.value
        .filter((l) => l.projectID === pid && l.date === d)
        .slice()
        .reverse();
const cellLogs = (pid: string, d: string): ApiLog[] => logsFor(pid, d);
const primaryLog = (pid: string, d: string): ApiLog | undefined =>
    cellLogs(pid, d)[0];
const logCount = computed(() => logs.value.length);
const totalDays = computed(() => dates.value.length);
const hasData = computed(() => projects.value.length > 0);

/* ---------- 分类 / 标签 ---------- */
const tagSuggestions = computed<string[]>(() => {
    const s = new Set<string>(DEFAULT_TAGS);
    for (const l of logs.value) for (const t of l.tags) if (t) s.add(t);
    return [...s];
});
/** 单元格 tooltip 用的分类/标签文本 */
const metaText = (l: ApiLog): string => {
    const parts: string[] = [];
    if (l.category) parts.push(`分类:${l.category}`);
    if (l.tags.length) parts.push(`标签:${l.tags.join(",")}`);
    return parts.join(" · ");
};

/* ---------- 与后端交互 ---------- */
let firstLoad = true;
async function load(): Promise<void> {
    const st = await getState();
    projects.value = st.projects;
    logs.value = st.logs;

    // 同步筛选集：新增根默认勾选，已被删除的根移除
    const rids = new Set(
        projects.value.filter((p) => !p.parentID).map((r) => r.id),
    );
    const next = new Set(
        [...selectedRoots.value].filter((id) => rids.has(id)),
    );
    for (const id of rids) next.add(id);
    selectedRoots.value = next;
    if (firstLoad) {
        firstLoad = false;
        // 默认展开所有含子级的项目
        const s = new Set<string>();
        for (const p of projects.value) if (hasChildren(p.id)) s.add(p.id);
        expanded.value = s;
    }
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
        // 约半数顶层项目随机挂 1~2 个子项目，验证子树层级/折叠
        const childPool = CHILD_POOL.slice().sort(() => Math.random() - 0.5);
        for (const p of created.slice()) {
            if (Math.random() < 0.5 && childPool.length) {
                const k = 1 + Math.floor(Math.random() * 2); // 1~2 个
                for (let i = 0; i < k && childPool.length; i++) {
                    created.push(
                        await addProject({
                            parentID: p.id,
                            name: childPool.pop()!,
                        }),
                    );
                }
            }
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
        await load();
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
        expanded.value = new Set();
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        await load();
    } finally {
        busy.value = false;
    }
}

/* ---------- 弹窗与操作 ---------- */
interface ProjectDlg {
    open: boolean;
    mode: "new" | "rename";
    id: string | null;
    name: string;
    parentID: string | null;
}
const projectDlg = ref<ProjectDlg>({
    open: false,
    mode: "new",
    id: null,
    name: "",
    parentID: null,
});
const projectCandidates = computed(() =>
    projects.value.filter((p) => p.id !== projectDlg.value.id),
);

function openNewProject(parentID: string | null = null): void {
    projectDlg.value = {
        open: true,
        mode: "new",
        id: null,
        name: "",
        parentID,
    };
}
function openRename(p: ApiProject): void {
    projectDlg.value = {
        open: true,
        mode: "rename",
        id: p.id,
        name: p.name,
        parentID: null,
    };
}
function openNewChild(p: ApiProject): void {
    openNewProject(p.id);
}
async function saveProject(): Promise<void> {
    const d = projectDlg.value;
    const name = d.name.trim();
    if (!name) return;
    busy.value = true;
    error.value = "";
    try {
        if (d.mode === "new") {
            await addProject({ parentID: d.parentID, name });
        } else if (d.id) {
            await patchProject(d.id, { name });
        }
        d.open = false;
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
async function deleteProjectNow(id: string): Promise<void> {
    busy.value = true;
    error.value = "";
    try {
        await deleteProject(id);
        expanded.value = new Set();
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        await load();
    } finally {
        busy.value = false;
    }
}

interface LogDlg {
    open: boolean;
    project: ApiProject | null;
    date: string;
    log: ApiLog | null;
    status: TaskStatus;
    summary: string;
    detail: string;
    category: string;
    tags: string[];
}
const logDlg = ref<LogDlg>({
    open: false,
    project: null,
    date: "",
    log: null,
    status: "plan",
    summary: "",
    detail: "",
    category: "",
    tags: [],
});
function openLogNew(p: ApiProject, d: string): void {
    multiDlg.value.open = false;
    logDlg.value = {
        open: true,
        project: p,
        date: d,
        log: null,
        status: "plan",
        summary: "",
        detail: "",
        category: "",
        tags: [],
    };
}
function openLogEdit(l: ApiLog): void {
    multiDlg.value.open = false;
    const p = projects.value.find((x) => x.id === l.projectID) ?? null;
    logDlg.value = {
        open: true,
        project: p,
        date: l.date,
        log: l,
        status: l.status,
        summary: l.summary,
        detail: l.detail,
        category: l.category ?? "",
        tags: [...l.tags],
    };
}
async function saveLog(): Promise<void> {
    const d = logDlg.value;
    if (!d.project) return;
    busy.value = true;
    error.value = "";
    try {
        if (d.log) {
            await patchLog(d.log.id, {
                status: d.status,
                summary: d.summary,
                detail: d.detail,
                category: String(d.category ?? "").trim() || null,
                tags: d.tags.filter((t) => t.trim()),
            });
        } else {
            await addLog({
                projectID: d.project.id,
                date: d.date,
                status: d.status,
                summary: d.summary,
                detail: d.detail,
                category: String(d.category ?? "").trim() || null,
                tags: d.tags.filter((t) => t.trim()),
            });
        }
        d.open = false;
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
    } finally {
        busy.value = false;
    }
}
async function deleteLogNow(l: ApiLog): Promise<void> {
    busy.value = true;
    error.value = "";
    try {
        await deleteLog(l.id);
        logDlg.value.open = false;
        multiDlg.value.open = false;
        await load();
    } catch (e) {
        error.value = e instanceof Error ? e.message : String(e);
        await load();
    } finally {
        busy.value = false;
    }
}

/* 同日多日志列表 */
const multiDlg = ref<{ open: boolean; project: ApiProject | null; date: string }>({
    open: false,
    project: null,
    date: "",
});
const multiLogs = computed<ApiLog[]>(() => {
    const m = multiDlg.value;
    return m.project ? cellLogs(m.project.id, m.date) : [];
});
function openMulti(p: ApiProject, d: string): void {
    multiDlg.value = { open: true, project: p, date: d };
}

/** 点击单元格：多条开列表，单条直接编辑 */
function openCell(p: ApiProject, d: string): void {
    const ls = cellLogs(p.id, d);
    if (ls.length > 1) openMulti(p, d);
    else if (ls.length === 1) openLogEdit(ls[0]);
}

/* 通用确认框 */
const confirmDlg = ref<{ open: boolean; text: string; onYes: (() => void) | null }>({
    open: false,
    text: "",
    onYes: null,
});
function askDeleteProject(p: ApiProject): void {
    confirmDlg.value = {
        open: true,
        text: `删除「${p.name}」及其全部子项目与日志？此操作不可恢复。`,
        onYes: () => void deleteProjectNow(p.id),
    };
}
function askDeleteLog(l: ApiLog): void {
    confirmDlg.value = {
        open: true,
        text: `删除日志「${l.summary}」（${l.date}）？`,
        onYes: () => void deleteLogNow(l),
    };
}
function confirmYes(): void {
    const fn = confirmDlg.value.onYes;
    confirmDlg.value.open = false;
    logDlg.value.open = false;
    if (fn) fn();
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
                        {{ totalDays }} 天
                    </v-chip>
                    <v-select
                        v-model="futureDays"
                        :items="[0, 3, 5, 7, 10, 14]"
                        label="未来计划"
                        density="compact"
                        hide-details
                        class="future-select"
                    />
                    <v-btn
                        icon
                        size="small"
                        variant="text"
                        title="一键折叠所有项目"
                        :disabled="busy"
                        @click="collapseAll"
                    >
                        <v-icon>mdi-arrow-collapse-all</v-icon>
                    </v-btn>
                    <v-btn
                        icon
                        size="small"
                        variant="text"
                        title="一键展开所有项目"
                        :disabled="busy"
                        @click="expandAll"
                    >
                        <v-icon>mdi-arrow-expand-all</v-icon>
                    </v-btn>
                    <v-btn
                        variant="outlined"
                        :disabled="busy"
                        prepend-icon="mdi-plus"
                        @click="openNewProject(null)"
                    >
                        新建项目
                    </v-btn>

                    <v-divider vertical class="mx-2" />

                    <div class="test-group">
                        <span class="test-label">测试</span>
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
                    </div>                </div>
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
                        点击右上角「新建项目」或「随机生成数据」开始
                    </div>
                </v-card>

                <template v-else>
                <!-- 项目筛选栏：勾选要在表格中渲染的项目 -->
                <v-card v-if="roots.length" class="filter-bar">
                    <span class="filter-title">显示：</span>
                    <v-checkbox
                        v-for="r in roots"
                        :key="r.id"
                        :model-value="selectedRoots.has(r.id)"
                        density="compact"
                        hide-details
                        class="filter-check"
                        @update:model-value="toggleRoot(r.id, !!$event)"
                    >
                        <template #label>
                            <span
                                class="filter-label"
                                :style="{
                                    color: columnTextColor(r),
                                    fontWeight: 600,
                                }"
                            >
                                {{ r.name }}
                            </span>
                        </template>
                    </v-checkbox>
                </v-card>

                <!-- 日期 × 项目表格 -->
                <v-card
                    v-if="visibleProjects.length === 0"
                    class="empty"
                >
                    <v-icon size="52" color="secondary">
                        mdi-filter-off-outline
                    </v-icon>
                    <div class="empty-title">未勾选项目</div>
                    <div class="empty-sub">
                        在上方勾选要显示的项目
                    </div>
                </v-card>
                <v-card v-else class="table-card">
                    <div class="table-scroll">
                        <table>
                            <thead>
                                <template v-if="hasSubtree">
                                    <tr>
                                        <th
                                            class="date-col"
                                            rowspan="2"
                                        >
                                            日期
                                        </th>
                                        <th
                                            v-for="r in selectedRootsList"
                                            :key="r.id"
                                            :colspan="subtreeSpan(r)"
                                            class="band"
                                            :style="{
                                                backgroundColor:
                                                    columnBgColor(r),
                                            }"
                                        >
                                            <div class="proj-head band-head">
                                                <v-btn
                                                    v-if="
                                                        hasChildren(r.id) &&
                                                        r.level < MAX_DEPTH
                                                    "
                                                    icon
                                                    size="x-small"
                                                    variant="plain"
                                                    class="caret"
                                                    @click.stop="
                                                        toggleExpand(r.id)
                                                    "
                                                >
                                                    <v-icon>
                                                        {{
                                                            expanded.has(r.id)
                                                                ? "mdi-chevron-down"
                                                                : "mdi-chevron-right"
                                                        }}
                                                    </v-icon>
                                                </v-btn>
                                                <span
                                                    class="proj-name band-name"
                                                    :title="r.name"
                                                    @click="openRename(r)"
                                                >
                                                    {{ r.name }}
                                                </span>
                                                <v-menu location="bottom">
                                                    <template
                                                        #activator="{ props }"
                                                    >
                                                        <v-btn
                                                            v-bind="props"
                                                            icon
                                                            size="x-small"
                                                            variant="plain"
                                                            class="proj-more"
                                                        >
                                                            <v-icon>
                                                                mdi-dots-horizontal
                                                            </v-icon>
                                                        </v-btn>
                                                    </template>
                                                    <v-list density="compact">
                                                        <v-list-item
                                                            prepend-icon="mdi-folder-plus"
                                                            @click="
                                                                openNewChild(r)
                                                            "
                                                        >
                                                            新建子项目
                                                        </v-list-item>
                                                        <v-list-item
                                                            prepend-icon="mdi-pencil"
                                                            @click="
                                                                openRename(r)
                                                            "
                                                        >
                                                            重命名
                                                        </v-list-item>
                                                        <v-list-item
                                                            prepend-icon="mdi-delete"
                                                            class="danger-item"
                                                            @click="
                                                                askDeleteProject(r)
                                                            "
                                                        >
                                                            删除
                                                        </v-list-item>
                                                    </v-list>
                                                </v-menu>
                                            </div>
                                        </th>
                                    </tr>
                                </template>
                                <tr>
                                    <th
                                        v-if="!hasSubtree"
                                        class="date-col"
                                    >
                                        日期
                                    </th>
                                    <th
                                        v-for="p in visibleProjects"
                                        :key="p.id"
                                        :style="{
                                            backgroundColor: columnBgColor(p),
                                        }"
                                    >
                                        <div
                                            class="proj-head"
                                            :style="{
                                                paddingLeft:
                                                    p.level * 14 + 'px',
                                            }"
                                        >
                                            <v-btn
                                                v-if="
                                                    hasChildren(p.id) &&
                                                    p.level < MAX_DEPTH
                                                "
                                                icon
                                                size="x-small"
                                                variant="plain"
                                                class="caret"
                                                @click.stop="
                                                    toggleExpand(p.id)
                                                "
                                            >
                                                <v-icon>
                                                    {{
                                                        expanded.has(p.id)
                                                            ? "mdi-chevron-down"
                                                            : "mdi-chevron-right"
                                                    }}
                                                </v-icon>
                                            </v-btn>
                                            <span
                                                v-if="!hasSubtree || p.level > 0"
                                                class="proj-name"
                                                :title="p.name"
                                                @click="openRename(p)"
                                            >
                                                {{ p.name }}
                                            </span>
                                            <v-menu location="bottom">
                                                <template
                                                    #activator="{ props }"
                                                >
                                                    <v-btn
                                                        v-bind="props"
                                                        icon
                                                        size="x-small"
                                                        variant="plain"
                                                        class="proj-more"
                                                    >
                                                        <v-icon>
                                                            mdi-dots-horizontal
                                                        </v-icon>
                                                    </v-btn>
                                                </template>
                                                <v-list density="compact">
                                                    <v-list-item
                                                        prepend-icon="mdi-folder-plus"
                                                        @click="openNewChild(p)"
                                                    >
                                                        新建子项目
                                                    </v-list-item>
                                                    <v-list-item
                                                        prepend-icon="mdi-pencil"
                                                        @click="openRename(p)"
                                                    >
                                                        重命名
                                                    </v-list-item>
                                                    <v-list-item
                                                        prepend-icon="mdi-delete"
                                                        class="danger-item"
                                                        @click="
                                                            askDeleteProject(p)
                                                        "
                                                    >
                                                        删除
                                                    </v-list-item>
                                                </v-list>
                                            </v-menu>
                                        </div>
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
                                        v-for="p in visibleProjects"
                                        :key="p.id"
                                        class="cell"
                                        :class="{
                                            'cell-empty': !primaryLog(p.id, d),
                                        }"
                                        :style="{
                                            backgroundColor: columnBgColor(p),
                                        }"
                                    >
                                        <template v-if="primaryLog(p.id, d)">
                                            <div
                                                class="log clickable"
                                                @click="openCell(p, d)"
                                                :title="`${STATUS_NAME[primaryLog(p.id, d)!.status]} · ${primaryLog(p.id, d)!.summary}${metaText(primaryLog(p.id, d)!) ? '\n' + metaText(primaryLog(p.id, d)!) : ''}`"
                                            >
                                                <v-chip
                                                    size="x-small"
                                                    :class="[
                                                        'badge',
                                                        `st-${primaryLog(p.id, d)!.status}`,
                                                    ]"
                                                >
                                                    {{
                                                        STATUS_NAME[
                                                            primaryLog(p.id, d)!
                                                                .status
                                                        ]
                                                    }}
                                                </v-chip>
                                                <span class="summary">
                                                    {{
                                                        primaryLog(p.id, d)!
                                                            .summary
                                                    }}
                                                </span>
                                                <v-chip
                                                    v-if="
                                                        cellLogs(p.id, d).length >
                                                        1
                                                    "
                                                    size="x-small"
                                                    variant="tonal"
                                                    color="secondary"
                                                    class="multi-tag"
                                                >
                                                    +{{
                                                        cellLogs(p.id, d).length -
                                                        1
                                                    }}
                                                </v-chip>
                                            </div>
                                        </template>
                                        <span
                                            v-else
                                            class="plus clickable"
                                            @click="openLogNew(p, d)"
                                        >
                                            ＋
                                        </span>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </v-card>
                </template>
            </v-container>
        </v-main>

        <!-- 项目：新建 / 重命名 -->
        <v-dialog v-model="projectDlg.open" max-width="420" persistent>
            <v-card>
                <v-card-title>
                    {{ projectDlg.mode === "new" ? "新建项目" : "重命名项目" }}
                </v-card-title>
                <v-card-text>
                    <v-text-field
                        v-model="projectDlg.name"
                        label="项目名称"
                        density="compact"
                    />
                    <v-select
                        v-if="projectDlg.mode === 'new'"
                        v-model="projectDlg.parentID"
                        :items="projectCandidates"
                        item-title="name"
                        item-value="id"
                        label="父项目（可选，留空为根级）"
                        density="compact"
                        clearable
                    />
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="projectDlg.open = false">
                        取消
                    </v-btn>
                    <v-btn
                        color="primary"
                        :disabled="busy || !projectDlg.name.trim()"
                        @click="saveProject"
                    >
                        保存
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 日志：新增 / 编辑 -->
        <v-dialog v-model="logDlg.open" max-width="460" persistent>
            <v-card v-if="logDlg.project">
                <v-card-title>
                    {{
                        logDlg.log ? "编辑日志" : "新增日志"
                    }}
                    · {{ logDlg.project.name }} · {{ logDlg.date }}
                </v-card-title>
                <v-card-text>
                    <v-select
                        v-model="logDlg.status"
                        :items="STATUS_ITEMS"
                        label="状态"
                        density="compact"
                    />

                    <v-combobox
                        v-model="logDlg.category"
                        :items="CATEGORY_POOL"
                        label="分类（单选，可自定义）"
                        density="compact"
                        clearable
                    />
                    <v-combobox
                        v-model="logDlg.tags"
                        :items="tagSuggestions"
                        label="标签（多选，回车添加）"
                        density="compact"
                        multiple
                        small-chips
                        clearable
                    />
                    <v-text-field
                        v-model="logDlg.summary"
                        label="摘要"
                        density="compact"
                    />
                    <v-textarea
                        v-model="logDlg.detail"
                        label="详情"
                        density="compact"
                        rows="2"
                    />
                </v-card-text>
                <v-card-actions>
                    <v-btn
                        v-if="logDlg.log"
                        color="error"
                        variant="text"
                        @click="askDeleteLog(logDlg.log)"
                    >
                        删除
                    </v-btn>
                    <v-spacer />
                    <v-btn variant="text" @click="logDlg.open = false">
                        取消
                    </v-btn>
                    <v-btn
                        color="primary"
                        :disabled="busy"
                        @click="saveLog"
                    >
                        保存
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 同日多日志列表 -->
        <v-dialog v-model="multiDlg.open" max-width="500">
            <v-card v-if="multiDlg.project">
                <v-card-title class="multi-title">
                    {{ multiDlg.project.name }} · {{ multiDlg.date }}（{{
                        multiLogs.length
                    }}
                    条）
                </v-card-title>
                <v-card-text>
                    <v-list density="compact" class="multi-list">
                        <v-list-item
                            v-for="l in multiLogs"
                            :key="l.id"
                            class="multi-item"
                        >
                            <template #prepend>
                                <v-chip
                                    size="x-small"
                                    :class="['badge', `st-${l.status}`]"
                                >
                                    {{ STATUS_NAME[l.status] }}
                                </v-chip>
                            </template>
                            <v-list-item-title>{{ l.summary }}</v-list-item-title>
                            <v-list-item-subtitle>
                                {{ l.detail }}
                            </v-list-item-subtitle>

                            <div v-if="l.category || l.tags.length" class="log-meta">
                                <v-chip
                                    v-if="l.category"
                                    size="x-small"
                                    variant="flat"
                                    color="primary"
                                    class="meta-chip"
                                >
                                    {{ l.category }}
                                </v-chip>
                                <v-chip
                                    v-for="t in l.tags"
                                    :key="t"
                                    size="x-small"
                                    variant="outlined"
                                    class="meta-chip"
                                >
                                    #{{ t }}
                                </v-chip>
                            </div>
                            <template #append>
                                <v-btn
                                    icon
                                    size="x-small"
                                    variant="text"
                                    @click="openLogEdit(l)"
                                >
                                    <v-icon>mdi-pencil</v-icon>
                                </v-btn>
                                <v-btn
                                    icon
                                    size="x-small"
                                    variant="text"
                                    @click="askDeleteLog(l)"
                                >
                                    <v-icon>mdi-delete</v-icon>
                                </v-btn>
                            </template>
                        </v-list-item>
                    </v-list>
                </v-card-text>
                <v-card-actions>
                    <v-btn
                        variant="tonal"
                        @click="openLogNew(multiDlg.project, multiDlg.date)"
                    >
                        新增一条
                    </v-btn>
                    <v-spacer />
                    <v-btn variant="text" @click="multiDlg.open = false">
                        关闭
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>

        <!-- 删除确认 -->
        <v-dialog v-model="confirmDlg.open" max-width="380" persistent>
            <v-card>
                <v-card-text class="confirm-text">
                    {{ confirmDlg.text }}
                </v-card-text>
                <v-card-actions>
                    <v-spacer />
                    <v-btn variant="text" @click="confirmDlg.open = false">
                        取消
                    </v-btn>
                    <v-btn
                        color="error"
                        variant="tonal"
                        @click="confirmYes"
                    >
                        删除
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </v-app>
</template>

<style scoped>
.app {
    background: #f1f5f9;
}

/* ---------- 标题栏 ---------- */
.test-group {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 2px 10px;
    background: #f1f5f9;
    border-radius: 8px;
}
.test-label {
    font-size: 12px;
    color: #94a3b8;
    white-space: nowrap;
}
.brand {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 4px;
}
.brand-name {
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: 0.5px;
}
.brand-sub {
    font-size: 13px;
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
/* 项目筛选栏 */
.filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 16px;
    padding: 8px 16px;
    margin-bottom: 16px;
}
.filter-title {
    font-size: 14px;
    color: #64748b;
}
.filter-check {
    margin: 0;
}
.filter-label {
    font-size: 14px;
}
.empty {
    margin: 12vh auto 0;
    max-width: 440px;
    padding: 48px 24px;
    text-align: center;
    color: #64748b;
}
.empty-title {
    font-size: 17px;
    font-weight: 600;
    color: #334155;
    margin: 12px 0 4px;
}
.empty-sub {
    font-size: 14px;
    margin: 0;
}

/* ---------- 表格 ---------- */
.table-card {
    overflow: hidden;
}
.table-scroll {
    overflow: auto;
    max-height: calc(100vh - 200px);
}
table {
    border-collapse: separate;
    border-spacing: 0;
    width: 100%;
    min-width: 960px;
    font-size: 14px;
}
thead th {
    position: sticky;
    background: #f8fafc;
    color: #475569;
    font-weight: 600;
    text-align: left;
    padding: 6px 10px;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
    font-size: 14px;
}
/* 单行表头：贴顶 */
thead tr:only-child th {
    top: 0;
    z-index: 6;
}
/* 双行表头：分组带行贴顶，底排行下移到分组带高度之下 */
thead tr:first-child:not(:only-child) th {
    top: 0;
    z-index: 7;
}
thead tr:last-child:not(:only-child) th {
    top: 40px;
    z-index: 6;
}
tbody td {
    padding: 8px 14px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
}
tbody tr:hover td {
    background: #f8fafc;
}
/* 今天/周末行高亮 */
tbody tr.row-today td {
    background: #eff6ff;
}
tbody tr.row-today:hover td {
    background: #e8f0fe;
}
tbody tr.row-weekend td {
    background: #faf9f7;
}

/* 日期列：冻结在左侧 */
.date-col {
    position: sticky;
    left: 0;
    z-index: 6;
    background: #f8fafc;
    font-weight: 600;
    color: #475569;
    white-space: nowrap;
}
thead th.date-col {
    z-index: 7;
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

/* ---------- 表头（层级缩进 + 折叠 / 菜单） ---------- */
.band {
    text-align: center;
}
.band-head {
    justify-content: center;
}
.band-name {
    font-weight: 700;
}
.proj-head {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 120px;
    max-width: 200px;
}
.caret {
    flex: 0 0 auto;
    margin: 0 -6px;
}
.proj-name {
    cursor: pointer;
    color: #334155;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
}
.proj-name:hover {
    color: #1d4ed8;
}
.proj-more {
    flex: 0 0 auto;
    margin: 0 -6px;
    opacity: 0.4;
}
.proj-head:hover .proj-more {
    opacity: 1;
}
.danger-item {
    color: #dc2626;
}

/* ---------- 单元格 ---------- */
.cell {
    min-width: 132px;
    max-width: 220px;
}
.cell-empty {
    color: #cbd5e1;
    text-align: center;
}
.clickable {
    cursor: pointer;
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
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 160px;
}
.multi-tag {
    flex: 0 0 auto;
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

/* ---------- 弹窗 ---------- */
.multi-title {
    font-size: 16px;
}
.multi-list {
    max-height: 320px;
    overflow-y: auto;
}
.log-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 2px;
}
.meta-chip {
    height: 20px;
    font-size: 12px;
}
.multi-item :deep(.v-list-item__prepend) {
    margin-right: 12px;
}
.confirm-text {
    font-size: 15px;
    color: #334155;
}
</style>
