import { defineStore } from "pinia";
import type { Log, TaskStatus } from "@/types/main";
import { ref, type Ref } from "vue";
import { randString } from "@/utils/randString";

export const useLogStore = defineStore("logSet", () => {
    const logMap: Ref<Map<string, Log>> = ref(new Map());

    const init = () => {
        logMap.value = new Map<string, Log>();
    };

    const hasLog = (id: string): boolean => {
        return logMap.value.has(id);
    };

    const getByID = (id: string): Log | null => {
        const log = logMap.value.get(id);
        return log || null;
    };

    const addLog = (
        projectID: string,
        date: string,
        status: TaskStatus = "plan",
        summary: string = "",
        detail: string = "",
    ) => {
        const newLog: Log = {
            projectID: projectID,
            date: date,
            status: status,
            summary: summary,
            detail: detail,
        };
        const logID = randString();
        logMap.value.set(logID, newLog);
        return logID;
    };

    const rmLog = (id: string) => {
        if (!hasLog(id)) {
            return;
        }
        logMap.value.delete(id);
    };

    const getLogsByProjectID = (projectID: string): Log[] => {
        const logs: Log[] = [];
        logMap.value.forEach((log) => {
            if (log.projectID === projectID) {
                logs.push(log);
            }
        });
        return logs;
    };

    const getLogsByDate = (date: string): Log[] => {
        const logs: Log[] = [];
        logMap.value.forEach((log) => {
            if (log.date === date) {
                logs.push(log);
            }
        });
        return logs;
    };

    const getLogsByStatus = (status: TaskStatus): Log[] => {
        const logs: Log[] = [];
        logMap.value.forEach((log) => {
            if (log.status === status) {
                logs.push(log);
            }
        });
        return logs;
    };

    return {
        logMap,
        init,
        hasLog,
        getByID,
        addLog,
        rmLog,
        getLogsByProjectID,
        getLogsByDate,
        getLogsByStatus,
    };
});
