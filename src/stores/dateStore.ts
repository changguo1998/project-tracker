import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { format, addDays, isSameDay, parseISO } from "date-fns";
import type { DateRecord } from "@/types";

interface DateState {
    dates: DateRecord[];

    // Actions
    initializeDates: () => void;
    getPlanningRow: () => DateRecord | undefined;
    getTodayRow: () => DateRecord | undefined;
    getDateRows: () => DateRecord[];
    getSortedDates: () => DateRecord[];
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const DATE_RANGE = 30;

export const useDateStore = create<DateState>()(
    persist(
        (set, get) => ({
            dates: [],

            initializeDates: () => {
                const dates: DateRecord[] = [];

                // 规划行
                dates.push({
                    id: "planning",
                    date: null,
                    isPlanning: true,
                    createdAt: new Date().toISOString(),
                });

                // 今天及过去30天
                const today = new Date();
                for (let i = 0; i <= DATE_RANGE; i++) {
                    const date = addDays(today, -i);
                    dates.push({
                        id: generateId(),
                        date: date.toISOString(),
                        isPlanning: false,
                        createdAt: new Date().toISOString(),
                    });
                }

                set({ dates });
            },

            getPlanningRow: () => {
                return get().dates.find((d) => d.isPlanning);
            },

            getTodayRow: () => {
                const today = new Date();
                return get().dates.find((d) => {
                    if (!d.date) return false;
                    return isSameDay(parseISO(d.date), today);
                });
            },

            getDateRows: () => {
                return get().dates.filter((d) => !d.isPlanning);
            },

            getSortedDates: () => {
                return [...get().dates].sort((a, b) => {
                    if (a.isPlanning) return -1;
                    if (b.isPlanning) return 1;
                    if (!a.date || !b.date) return 0;
                    return (
                        new Date(b.date).getTime() - new Date(a.date).getTime()
                    );
                });
            },
        }),
        {
            name: "date-storage",
            storage: createJSONStorage(() => localStorage),
        },
    ),
);
