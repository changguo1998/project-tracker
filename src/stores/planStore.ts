import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DailyPlan } from "@/types";

interface PlanState {
    plans: DailyPlan[];

    addPlan: (dateId: string, taskId: string, content: string) => void;
    deletePlan: (id: string) => void;
    toggleComplete: (id: string) => void;
    getPlansByDateAndTask: (dateId: string, taskId: string) => DailyPlan[];
    getPlansByDate: (dateId: string) => DailyPlan[];
    getCompletionStatus: (
        dateId: string,
        taskId: string,
    ) => "completed" | "partial" | "none";
}

const generateId = () => "plan-" + Math.random().toString(36).substr(2, 9);

export const usePlanStore = create<PlanState>()(
    persist(
        (set, get) => ({
            plans: [],

            addPlan: (dateId: string, taskId: string, content: string) => {
                const newPlan: DailyPlan = {
                    id: generateId(),
                    dateId,
                    taskId,
                    content,
                    isCompleted: false,
                    notes: "",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                set((state) => ({ plans: [...state.plans, newPlan] }));
                console.log(`[PlanStore] 添加计划成功：${content.substring(0, 20)}${content.length > 20 ? '...' : ''} (ID: ${newPlan.id})`);
            },

            deletePlan: (id: string) => {
                const plan = get().plans.find((p) => p.id === id);
                if (!plan) {
                    console.error(`[PlanStore] 删除计划失败：计划 ${id} 不存在`);
                    return;
                }
                set((state) => ({
                    plans: state.plans.filter((p) => p.id !== id),
                }));
                console.log(`[PlanStore] 删除计划成功：${plan.content.substring(0, 20)}${plan.content.length > 20 ? '...' : ''} (ID: ${id})`);
            },

            toggleComplete: (id: string) => {
                const plan = get().plans.find((p) => p.id === id);
                if (plan) {
                    const newStatus = !plan.isCompleted;
                    set((state) => ({
                        plans: state.plans.map((p) =>
                            p.id === id
                                ? {
                                    ...p,
                                    isCompleted: newStatus,
                                    updatedAt: new Date().toISOString(),
                                }
                                : p,
                        ),
                    }));
                    console.log(`[PlanStore] ${newStatus ? '完成' : '取消完成'}计划：${plan.content.substring(0, 20)}${plan.content.length > 20 ? '...' : ''} (ID: ${id})`);
                } else {
                    console.error(`[PlanStore] 切换完成状态失败：计划 ${id} 不存在`);
                }
            },

            getPlansByDateAndTask: (dateId: string, taskId: string) => {
                return get().plans.filter(
                    (p) => p.dateId === dateId && p.taskId === taskId,
                );
            },

            getPlansByDate: (dateId: string) => {
                return get().plans.filter((p) => p.dateId === dateId);
            },

            getCompletionStatus: (dateId: string, taskId: string) => {
                const plans = get().getPlansByDateAndTask(dateId, taskId);
                if (plans.length === 0) return "none";
                const completed = plans.filter((p) => p.isCompleted).length;
                if (completed === 0) return "none";
                if (completed === plans.length) return "completed";
                return "partial";
            },
        }),
        {
            name: "plan-storage",
            storage: createJSONStorage(() => localStorage),
        },
    ),
);
