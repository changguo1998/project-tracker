import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { TreeNode, VisibleColumn, Dict } from "@/types";

interface TaskState {
    tasks: Dict<TreeNode>;
    expandedTasks: Set<string>;

    addTask: (name: string, parentId?: string) => void;
    deleteTask: (id: string) => void;
    expandSubTask: (id: string) => void;
    collapseSubTask: (id: string) => void;
    toggleExpand: (taskId: string) => void;
    getVisibleColumns: () => VisibleColumn[];
    ensureRootNode: () => void;
}

const generateId = () => "task-" + Math.random().toString(36).substring(2, 11);

const getRandomColor = (level: number) => {
    const hues = [200, 160, 280, 30, 340];
    const hue = hues[level % hues.length];
    return `hsl(${hue}, 70%, ${60 - level * 10}%)`;
};

const ROOT_NODE_ID = "root-summary";

const createRootNode = (): TreeNode => ({
    id: ROOT_NODE_ID,
    name: "摘要",
    parentId: null,
    color: "hsl(200, 70%, 60%)",
    isExpanded: true,
    level: 0,
    children: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
});

/**
 * 递归收集所有子节点ID（包括子孙节点）
 */
const collectAllDescendantIds = (tasks: Dict<TreeNode>, nodeId: string): string[] => {
    const node = tasks[nodeId];
    if (!node || node.children.length === 0) {
        return [];
    }
    const ids: string[] = [];
    for (const childId of node.children) {
        ids.push(childId);
        ids.push(...collectAllDescendantIds(tasks, childId));
    }
    return ids;
};

/**
 * 递归收集从根节点到目标节点的路径
 */
const collectParentPath = (tasks: Dict<TreeNode>, nodeId: string): string[] => {
    const node = tasks[nodeId];
    if (!node || node.parentId === null) {
        return [];
    }
    return [node.parentId, ...collectParentPath(tasks, node.parentId)];
};

const _expandSubTask = (taskId: string, tasks: Dict<TreeNode>, expandedTasks: Set<string>): Set<string> => {
    const node = tasks[taskId];
    if (!node) {
        console.error(`[TaskStore] 展开子任务失败：节点 ${taskId} 不存在`);
        return expandedTasks;
    }
    const newExpanded = new Set(expandedTasks);
    // 向上递归搜索添加到 expandedTasks 中
    collectParentPath(tasks, taskId).forEach(
        (id: string) => newExpanded.add(id)
    );
    return newExpanded;
};

const _collapseSubTask = (taskId: string, tasks: Dict<TreeNode>, expandedTasks: Set<string>): Set<string> => {
    const node = tasks[taskId];
    if (!node) {
        console.error(`[TaskStore] 折叠子任务失败：节点 ${taskId} 不存在`);
        return expandedTasks;
    }

    const newExpanded = new Set(expandedTasks);
    // 向下递归搜索删除 expandedTasks 中
    collectAllDescendantIds(tasks, taskId).forEach(
        (id: string) => newExpanded.delete(id)
    );
    return newExpanded;
};

export const useTaskStore = create<TaskState>()(
    persist(
        (set, get) => ({
            tasks: {},
            expandedTasks: new Set(),

            addTask: (name: string, parentId?: string) => {
                const targetParentId = parentId || ROOT_NODE_ID;
                let parent = get().tasks[targetParentId];

                if (!parent) {
                    if (targetParentId === ROOT_NODE_ID) {
                        console.warn('[TaskStore] 根节点不存在，自动创建根节点');
                        const rootNode = createRootNode();
                        set((state) => ({
                            tasks: { ...state.tasks, [ROOT_NODE_ID]: rootNode }
                        }));
                        parent = rootNode;
                    } else {
                        console.error(`[TaskStore] 添加任务失败：父节点 ${targetParentId} 不存在`);
                        return;
                    }
                }

                const level = parent.level + 1;
                const newTask: TreeNode = {
                    id: generateId(),
                    name,
                    parentId: targetParentId,
                    color: getRandomColor(level),
                    isExpanded: level <= 1,
                    level,
                    children: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                set((state) => {
                    const newState = {
                        tasks: {
                            ...state.tasks,
                            [newTask.id]: newTask,
                            [targetParentId]: {
                                ...parent,
                                children: [...parent.children, newTask.id],
                                updatedAt: new Date().toISOString()
                            }
                        },
                        expandedTasks: state.expandedTasks
                    };
                    return newState;
                });

                console.log(`[TaskStore] 添加任务成功：${name} (ID: ${newTask.id})`);
            },

            deleteTask: (id: string) => {
                if (id === ROOT_NODE_ID) {
                    console.warn('[TaskStore] 删除任务失败：不能删除根节点');
                    return;
                }

                const node = get().tasks[id];
                if (!node) {
                    console.error(`[TaskStore] 删除任务失败：节点 ${id} 不存在`);
                    return;
                }

                const allIdsToDelete = [id, ...collectAllDescendantIds(get().tasks, id)];
                const parent = get().tasks[node.parentId!];
                if (parent) {
                    set((state) => {
                        const newTasks = { ...state.tasks };

                        allIdsToDelete.forEach(deleteId => {
                            delete newTasks[deleteId];
                        });

                        newTasks[parent.id] = {
                            ...parent,
                            children: parent.children.filter(childId => childId !== id),
                            updatedAt: new Date().toISOString()
                        };

                        return { tasks: newTasks };
                    });
                }

                console.log(`[TaskStore] 删除任务成功：${node.name} (ID: ${id})，共删除 ${allIdsToDelete.length} 个节点`);
            },

            findNodeById: (id: string): TreeNode | null => {
                return get().tasks[id] || null;
            },

            expandSubTask: (taskId: string) => {
                set((state) => ({ expandedTasks: _expandSubTask(taskId, get().tasks, state.expandedTasks) }));
            },

            collapseSubTask: (taskId: string) => {
                set((state) => ({ expandedTasks: _collapseSubTask(taskId, get().tasks, state.expandedTasks) }));
            },

            toggleExpand: (taskId: string) => {
                const node = get().tasks[taskId];
                const parent = get().tasks[node.parentId!];
                if (!node) {
                    console.error(`[TaskStore] 切换展开状态失败：节点 ${taskId} 不存在`);
                    return;
                }

                set((state) => {
                    const newExpanded = new Set(state.expandedTasks);
                    if (newExpanded.has(taskId)) {
                        return { expandedTasks: _collapseSubTask(taskId, get().tasks, newExpanded) };
                    } else {
                        parent.children.forEach(childId => _collapseSubTask(childId, get().tasks, newExpanded));
                        return { expandedTasks: _expandSubTask(taskId, get().tasks, newExpanded) };
                    }
                });
            },

            getVisibleColumns: () => {
                const visibleColumns: VisibleColumn[] = [];
                const tasks = get().tasks;
                const expandedTasks = get().expandedTasks;

                const expandedSet = expandedTasks instanceof Set
                    ? expandedTasks
                    : new Set(Array.isArray(expandedTasks) ? expandedTasks : []);

                const traverse = (nodeId: string, shouldShow: boolean = false) => {
                    const node = tasks[nodeId];
                    if (!node) return;

                    if (shouldShow || expandedSet.has(nodeId) || node.level <= 1) {
                        visibleColumns.push({
                            taskId: nodeId,
                            isSubTask: node.parentId !== null,
                            parentTaskId: node.parentId,
                        });
                    }

                    if (expandedSet.has(nodeId) || node.level <= 1) {
                        node.children.forEach(childId => traverse(childId, true));
                    }
                };

                if (!tasks[ROOT_NODE_ID]) {
                    console.warn('[TaskStore] 根节点不存在，自动创建根节点');
                    const rootNode = createRootNode();
                    set((state) => ({
                        tasks: { ...state.tasks, [ROOT_NODE_ID]: rootNode }
                    }));
                }

                traverse(ROOT_NODE_ID, true);

                return visibleColumns;
            },
            ensureRootNode: () => {
                const tasks = get().tasks;
                if (!tasks[ROOT_NODE_ID]) {
                    const rootNode = createRootNode();
                    set((state) => ({
                        tasks: { ...state.tasks, [ROOT_NODE_ID]: rootNode }
                    }));
                }
            },
        }),
        {
            name: "task-storage",
            storage: createJSONStorage(() => localStorage),
        },
    ),
);
