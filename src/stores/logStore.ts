import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import type { LogRec, TaskStatus } from "@/types/main";
import * as api from "@/api";

export const useLogStore = defineStore("logSet", () => {
    const logMap: Ref<Map<string, LogRec>> = ref(new Map());

    const loadState = async () => {
        const state = await api.getState();
        logMap.value = new Map(state.logs.map((l) => [l.id, l]));
    };

    const hasLog = (id: string): boolean => logMap.value.has(id);
    const getByID = (id: string): LogRec | undefined => logMap.value.get(id);

    const getLogsByProjectID = (projectID: string): LogRec[] =>
        Array.from(logMap.value.values()).filter(
            (l) => l.projectID === projectID,
        );

    /** 时间表单元格按 projectID+date 查询；多条时取最新（每项目每天 1 条为常规形态） */
    const getLogByProjectAndDate = (
        projectID: string,
        date: string,
    ): LogRec | undefined => {
        const cand = Array.from(logMap.value.values()).filter(
            (l) => l.projectID === projectID && l.date === date,
        );
        return cand.length > 0 ? cand[cand.length - 1] : undefined;
    };

    const getLogsByDate = (date: string): LogRec[] =>
        Array.from(logMap.value.values()).filter((l) => l.date === date);

    const getLogsByStatus = (status: TaskStatus): LogRec[] =>
        Array.from(logMap.value.values()).filter((l) => l.status === status);

    /** server-first：新增成功后才写本地，返回服务端 ID 的记录 */
    const addLog = async (p: {
        projectID: string;
        date: string;
        status: TaskStatus;
        summary: string;
        detail: string;
    }): Promise<LogRec> => {
        const log = await api.addLog(p);
        logMap.value.set(log.id, log);
        return log;
    };

    const updateLog = async (
        id: string,
        p: Partial<Omit<LogRec, "id">>,
    ): Promise<LogRec> => {
        const log = await api.patchLog(id, p);
        logMap.value.set(id, log);
        return log;
    };

    const rmLog = async (id: string) => {
        await api.deleteLog(id);
        logMap.value.delete(id);
    };

    /** 出现过的日志日期（去重、倒序，用于时间表行） */
    const allDates = (): string[] =>
        Array.from(
            new Set(Array.from(logMap.value.values()).map((l) => l.date)),
        )
            .sort()
            .reverse();

    return {
        logMap,
        loadState,
        hasLog,
        getByID,
        getLogsByProjectID,
        getLogByProjectAndDate,
        getLogsByDate,
        getLogsByStatus,
        addLog,
        updateLog,
        rmLog,
        allDates,
    };
});
