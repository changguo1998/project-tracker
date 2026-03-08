import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Task, VisibleColumn } from "@/types";

interface TaskState {
    tasks: Task[];
    expandedTasks: Set<string>;

    // Actions
    addTask: (name: string, parentId?: string) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    deleteTask: (id: string) => void;
    toggleExpand: (taskId: string) => void;
    getDirectChildren: (taskId: string) => Task[];
    getRootTasks: () => Task[];
    getVisibleColumns: () => VisibleColumn[];
    getTaskPath: (taskId: string) => Task[];
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const getRandomColor = (level: number) => {
    const hues = [200, 160, 280, 30, 340];
    const hue = hues[level % hues.length];
    return `hsl(${hue}, 70%, ${60 - level * 10}%)`;
};

export const useTaskStore = create<TaskState>()(
    persist(
        (set, get) => ({
            tasks: [],
            expandedTasks: new Set(),

            addTask: (name: string, parentId?: string) => {
                const parent = parentId
                    ? get().tasks.find((t) => t.id === parentId)
                    : null;
                const level = parent ? parent.level + 1 : 0;

                const newTask: Task = {
                    id: generateId(),
                    name,
                    parentId: parentId || null,
                    color: getRandomColor(level),
                    isExpanded: false,
                    level,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                set((state) => ({ tasks: [...state.tasks, newTask] }));
            },

            updateTask: (id: string, updates: Partial<Task>) => {
                set((state) => ({
                    tasks: state.tasks.map((t) =>
                        t.id === id
                            ? {
                                  ...t,
                                  ...updates,
                                  updatedAt: new Date().toISOString(),
                              }
                            : t,
                    ),
                }));
            },

            deleteTask: (id: string) => {
                const deleteRecursively = (taskId: string) => {
                    const children = get().tasks.filter(
                        (t) => t.parentId === taskId,
                    );
                    children.forEach((child) => deleteRecursively(child.id));
                    set((state) => ({
                        tasks: state.tasks.filter((t) => t.id !== taskId),
                    }));
                };
                deleteRecursively(id);
            },

            toggleExpand: (taskId: string) => {
                set((state) => {
                    const newExpanded = new Set(state.expandedTasks);
                    if (newExpanded.has(taskId)) {
                        newExpanded.delete(taskId);
                    } else {
                        newExpanded.add(taskId);
                    }
                    return { expandedTasks: newExpanded };
                });
            },

            getDirectChildren: (taskId: string) => {
                return get().tasks.filter((t) => t.parentId === taskId);
            },

            getRootTasks: () => {
                return get().tasks.filter((t) => t.parentId === null);
            },

            getVisibleColumns: () => {
                const columns: VisibleColumn[] = [];
                const rootTasks = get().getRootTasks();

                const addTaskColumns = (task: Task) => {
                    columns.push({
                        taskId: task.id,
                        isSubTask: task.parentId !== null,
                        parentTaskId: task.parentId,
                    });

                    if (get().expandedTasks.has(task.id)) {
                        const children = get().getDirectChildren(task.id);
                        children.forEach((child) => addTaskColumns(child));
                    }
                };

                rootTasks.forEach((task) => addTaskColumns(task));
                return columns;
            },

            getTaskPath: (taskId: string) => {
                const path: Task[] = [];
                let current = get().tasks.find((t) => t.id === taskId);
                while (current) {
                    path.unshift(current);
                    current = current.parentId
                        ? get().tasks.find((t) => t.id === current!.parentId)
                        : undefined;
                }
                return path;
            },
        }),
        {
            name: "task-storage",
            storage: createJSONStorage(() => localStorage),
        },
    ),
);
