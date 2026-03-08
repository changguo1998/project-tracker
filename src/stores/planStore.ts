import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { DailyPlan } from "@/types";

interface PlanState {
    plans: DailyPlan[];

    // Actions
    addPlan: (dateId: string, taskId: string, content: string) => void;
    updatePlan: (id: string, updates: Partial<DailyPlan>) => void;
    deletePlan: (id: string) => void;
    toggleComplete: (id: string) => void;
    getPlansByDateAndTask: (dateId: string, taskId: string) => DailyPlan[];
    getPlansByDate: (dateId: string) => DailyPlan[];
    getCompletionStatus: (
        dateId: string,
        taskId: string,
    ) => "completed" | "partial" | "none";
}

const generateId = () => Math.random().toString(36).substr(2, 9);

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
            },

            updatePlan: (id: string, updates: Partial<DailyPlan>) => {
                set((state) => ({
                    plans: state.plans.map((p) =>
                        p.id === id
                            ? {
                                  ...p,
                                  ...updates,
                                  updatedAt: new Date().toISOString(),
                              }
                            : p,
                    ),
                }));
            },

            deletePlan: (id: string) => {
                set((state) => ({
                    plans: state.plans.filter((p) => p.id !== id),
                }));
            },

            toggleComplete: (id: string) => {
                const plan = get().plans.find((p) => p.id === id);
                if (plan) {
                    get().updatePlan(id, { isCompleted: !plan.isCompleted });
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
