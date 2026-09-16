<template>
    <div class="project-time-table-container">
        <v-table>
            <thead>
                <tr>
                    <th class="date-col">日期</th>
                    <th v-for="p in shownProjects" :key="p.id">{{ p.name }}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="d in allDateList" :key="d">
                    <td class="date-col">{{ d }}</td>
                    <td
                        v-for="p in shownProjects"
                        :key="p.id"
                        class="cell"
                        @click="openCell(p.id, d)"
                    >
                        <span v-if="cellLog(p.id, d)" class="cell-has-log">
                            {{ cellLog(p.id, d)?.summary }}
                        </span>
                        <span v-else class="cell-empty">+</span>
                    </td>
                </tr>
            </tbody>
        </v-table>

        <LogDialog
            :open="dialogOpen"
            :mode="dialogMode"
            :log="dialogLog"
            :projectID="dialogProjectID"
            :date="dialogDate"
            @save="onSaveLog"
            @delete="onDeleteLog"
            @close="dialogOpen = false"
        />
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import type { LogRec, TaskStatus } from "@/types/main";
import { useLogStore } from "@/stores/logStore";
import { useProjectStore } from "@/stores/projectStore";
import { useShownProjectStore } from "@/stores/shownProjectStore";
import { reportError } from "@/utils/errorBus";
import LogDialog from "./LogDialog.vue";

const logStore = useLogStore();
const projectStore = useProjectStore();
const shownProjectStore = useShownProjectStore();

/** 列 = 已显示的顶层项目（响应式） */
const shownProjects = computed(() =>
    projectStore.getLevel1().filter((p) => shownProjectStore.isShown(p.id)),
);

const NEXT_DAYS = 3;
/** 行 = 出现的日志日期 ∪ 未来 NEXT_DAYS 天，倒序 */
const allDateList = computed(() => {
    const today = new Date();
    const dates: string[] = [];
    for (let i = 0; i < NEXT_DAYS; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        dates.push(d.toISOString().slice(0, 10));
    }
    dates.push(...logStore.allDates());
    return Array.from(new Set(dates)).sort().reverse();
});

/** 单元格 = 该项目该日的日志（修复旧实现按 log id 查询导致的恒空 bug） */
const cellLog = (projectID: string, date: string): LogRec | undefined =>
    logStore.getLogByProjectAndDate(projectID, date);

const dialogOpen = ref(false);
const dialogMode = ref<"create" | "edit">("create");
const dialogLog = ref<LogRec | undefined>(undefined);
const dialogProjectID = ref("");
const dialogDate = ref("");

const openCell = (projectID: string, date: string) => {
    const log = cellLog(projectID, date);
    dialogProjectID.value = projectID;
    dialogDate.value = date;
    dialogLog.value = log;
    dialogMode.value = log ? "edit" : "create";
    dialogOpen.value = true;
};

const onSaveLog = async (payload: {
    projectID: string;
    date: string;
    status: TaskStatus;
    summary: string;
    detail: string;
}) => {
    try {
        if (dialogMode.value === "create") {
            await logStore.addLog(payload);
        } else if (dialogLog.value) {
            await logStore.updateLog(dialogLog.value.id, payload);
        }
        dialogOpen.value = false;
    } catch (err) {
        reportError(err);
    }
};

const onDeleteLog = async () => {
    if (!dialogLog.value) return;
    try {
        await logStore.rmLog(dialogLog.value.id);
        dialogOpen.value = false;
    } catch (err) {
        reportError(err);
    }
};
</script>

<style>
.project-time-table-container {
    width: 100%;
    padding: 20px;
    border-radius: 10px;
    margin: 10px;
    flex: 1;
    overflow: auto;
}

.project-time-table-container .date-col {
    position: sticky;
    left: 0;
    background: #fafafa;
}

.project-time-table-container .cell {
    cursor: pointer;
    min-width: 120px;
}

.project-time-table-container .cell-empty {
    color: #bdbdbd;
}

.project-time-table-container .cell-has-log {
    color: #1e88e5;
}
</style>
