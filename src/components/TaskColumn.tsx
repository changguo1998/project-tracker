import { useState, useEffect, useRef } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { usePlanStore } from "@/stores/planStore";
import type { TreeNode, DateRecord } from "@/types";

interface TaskColumnProps {
    task: TreeNode;
    dateRecord: DateRecord;
    isPlanning: boolean;
    columnWidth?: number;
}

export function TaskColumn({
    task,
    dateRecord,
    isPlanning,
    columnWidth = 240,
}: TaskColumnProps) {
    const { tasks, deleteTask, toggleExpand, addTask } = useTaskStore();
    const { getPlansByDateAndTask, addPlan, toggleComplete } = usePlanStore();
    const [newContent, setNewContent] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean;
        taskId: string;
        taskName: string;
    }>({ show: false, taskId: "", taskName: "" });

    const planInputRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                isAdding &&
                planInputRef.current &&
                !planInputRef.current.contains(event.target as Node)
            ) {
                setIsAdding(false);
                setNewContent("");
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isAdding]);

    const children = task.children
        .map((id) => tasks[id])
        .filter((node): node is TreeNode => node !== undefined);
    const taskPlans = getPlansByDateAndTask(dateRecord.id, task.id);

    const renderPlanningContent = () => (
        <div className="p-2 space-y-1">
            {task.id !== "root-summary" &&
                children.map((child) => {
                    return (
                        <div
                            className="text-sm p-1 rounded flex flex-col items-center justify-between group w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                            style={{ borderLeft: `3px solid ${child.color}` }}
                        >
                            <div className="flex-1">
                                <button
                                    key={child.id}
                                    onClick={() => {
                                        toggleExpand(child.id);
                                    }}
                                    className="flex items-center gap-1 flex-1 text-left"
                                >
                                    <span className="truncate flex-1 dark:text-gray-200">
                                        {child.name}
                                    </span>
                                </button>
                                <button
                                    onClick={(e) => {
                                        setDeleteConfirm({
                                            show: true,
                                            taskId: child.id,
                                            taskName: child.name,
                                        });
                                        e.stopPropagation();
                                    }}
                                    className="p-0.5 text-gray-400 dark:text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="删除子任务"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        </div>
                    );
                })}
            {isAdding ? (
                <div
                    ref={planInputRef}
                    className="flex gap-1 min-w-0 max-w-full"
                >
                    <input
                        type="text"
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                if (newContent.trim()) {
                                    if (task.id === "root-summary") {
                                        addTask(newContent, task.id);
                                    } else {
                                        addPlan(dateRecord.id, task.id, newContent);
                                    }
                                    setNewContent("");
                                    setIsAdding(false);
                                }
                            }
                        }}
                        placeholder={task.id === "root-summary" ? "输入子任务..." : "输入计划..."}
                        className="flex-1 text-sm border rounded px-1 py-0.5 min-w-0 max-w-[120px] dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        autoFocus
                    />
                    <button
                        onClick={() => {
                            if (newContent.trim()) {
                                if (task.id === "root-summary") {
                                    addTask(newContent, task.id);
                                } else {
                                    addPlan(dateRecord.id, task.id, newContent);
                                }
                                setNewContent("");
                                setIsAdding(false);
                            }
                        }}
                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded shrink-0 hover:bg-blue-600"
                    >
                        添加
                    </button>
                </div>
            ) : (
                <button
                    className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1"
                    onClick={() => setIsAdding(true)}
                >
                    <Plus size={14} />
                    {task.id === "root-summary" ? "添加子任务" : "添加计划"}
                </button>
            )}
        </div>
    );

    const renderDailyContent = () => (
        <div className="p-2 space-y-1">
            {taskPlans.map((plan) => (
                <div
                    key={plan.id}
                    className="flex items-start gap-1 text-sm"
                >
                    <input
                        type="checkbox"
                        checked={plan.isCompleted}
                        onChange={() => toggleComplete(plan.id)}
                        className="mt-1"
                    />
                    <span
                        className={
                            plan.isCompleted
                                ? "line-through text-gray-400 dark:text-gray-500"
                                : "dark:text-gray-200"
                        }
                    >
                        {plan.content}
                    </span>
                </div>
            ))}

            {isAdding ? (
                <div
                    ref={planInputRef}
                    className="flex gap-1 min-w-0"
                >
                    <input
                        type="text"
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                if (newContent.trim()) {
                                    addPlan(dateRecord.id, task.id, newContent);
                                    setNewContent("");
                                    setIsAdding(false);
                                }
                            }
                        }}
                        placeholder="输入计划..."
                        className="flex-1 text-sm border rounded px-1 py-0.5 min-w-0 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        autoFocus
                    />
                    <button
                        onClick={() => {
                            if (newContent.trim()) {
                                addPlan(dateRecord.id, task.id, newContent);
                                setNewContent("");
                                setIsAdding(false);
                            }
                        }}
                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded shrink-0 hover:bg-blue-600"
                    >
                        添加
                    </button>
                </div>
            ) : (
                <button
                    className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-1"
                    onClick={() => setIsAdding(true)}
                >
                    <Plus size={14} />
                    添加计划
                </button>
            )}
        </div>
    );

    const renderHistoryContent = () => {
        const { getCompletionStatus } = usePlanStore.getState();
        const status = getCompletionStatus(dateRecord.id, task.id);

        const statusColors = {
            completed: "bg-green-500",
            partial: "bg-yellow-500",
            none: "bg-gray-300",
        };

        return (
            <div className="p-4 flex justify-center">
                <div
                    className={`w-4 h-4 rounded-full ${statusColors[status]}`}
                    title={
                        status === "completed"
                            ? "全部完成"
                            : status === "partial"
                              ? "部分完成"
                              : "无数据"
                    }
                />
            </div>
        );
    };

    return (
        <div
            className="border-r last:border-r-0 flex flex-col shrink-0"
            style={{ width: `${columnWidth}px` }}
        >
            <div className="flex-1">
                {isPlanning
                    ? renderPlanningContent()
                    : isToday(dateRecord.date)
                      ? renderDailyContent()
                      : renderHistoryContent()}
            </div>

            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-80 shadow-xl">
                        <h3 className="text-lg font-medium mb-2 dark:text-white">
                            确认删除
                        </h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            确定要删除"{deleteConfirm.taskName}"吗？
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() =>
                                    setDeleteConfirm({
                                        show: false,
                                        taskId: "",
                                        taskName: "",
                                    })
                                }
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    deleteTask(deleteConfirm.taskId);
                                    setDeleteConfirm({
                                        show: false,
                                        taskId: "",
                                        taskName: "",
                                    });
                                }}
                                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                            >
                                删除
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function isToday(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
}
