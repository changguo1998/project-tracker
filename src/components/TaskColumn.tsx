import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, MoreHorizontal } from "lucide-react";
import { useTaskStore } from "@/stores/taskStore";
import { usePlanStore } from "@/stores/planStore";
import type { Task, DateRecord } from "@/types";

interface TaskColumnProps {
    task: Task;
    dateRecord: DateRecord;
    isPlanning: boolean;
}

export function TaskColumn({ task, dateRecord, isPlanning }: TaskColumnProps) {
    const { toggleExpand, getDirectChildren, expandedTasks } = useTaskStore();
    const { getPlansByDateAndTask, addPlan, toggleComplete, plans } =
        usePlanStore();
    const [newPlanContent, setNewPlanContent] = useState("");
    const [isAdding, setIsAdding] = useState(false);

    const children = getDirectChildren(task.id);
    const isExpanded = expandedTasks.has(task.id);
    const taskPlans = getPlansByDateAndTask(dateRecord.id, task.id);

    const handleAddPlan = () => {
        if (newPlanContent.trim()) {
            addPlan(dateRecord.id, task.id, newPlanContent);
            setNewPlanContent("");
            setIsAdding(false);
        }
    };

    const renderHeader = () => (
        <div
            className="flex items-center justify-between p-2 border-b"
            style={{ backgroundColor: `${task.color}20` }}
        >
            <div className="flex items-center gap-1">
                {children.length > 0 && (
                    <button
                        onClick={() => toggleExpand(task.id)}
                        className="p-1 hover:bg-gray-200 rounded"
                    >
                        {isExpanded ? (
                            <ChevronDown size={16} />
                        ) : (
                            <ChevronRight size={16} />
                        )}
                    </button>
                )}
                <span
                    className="font-medium text-sm truncate"
                    style={{ color: task.color }}
                >
                    {task.parentId && "◆ "}
                    {task.name}
                </span>
            </div>
            <button className="p-1 hover:bg-gray-200 rounded">
                <MoreHorizontal size={14} />
            </button>
        </div>
    );

    const renderPlanningContent = () => (
        <div className="p-2 space-y-1">
            {children.map((child) => (
                <div
                    key={child.id}
                    className="text-sm p-1 rounded hover:bg-gray-100"
                    style={{ borderLeft: `3px solid ${child.color}` }}
                >
                    {child.name}
                </div>
            ))}
            <button
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 p-1"
                onClick={() => {
                    /* 添加子任务 */
                }}
            >
                <Plus size={14} />
                添加子任务
            </button>
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
                            plan.isCompleted ? "line-through text-gray-400" : ""
                        }
                    >
                        {plan.content}
                    </span>
                </div>
            ))}

            {isAdding ? (
                <div className="flex gap-1">
                    <input
                        type="text"
                        value={newPlanContent}
                        onChange={(e) => setNewPlanContent(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddPlan()}
                        placeholder="输入计划..."
                        className="flex-1 text-sm border rounded px-1 py-0.5"
                        autoFocus
                    />
                    <button
                        onClick={handleAddPlan}
                        className="text-xs bg-blue-500 text-white px-2 py-0.5 rounded"
                    >
                        添加
                    </button>
                </div>
            ) : (
                <button
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 p-1"
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
        <div className="min-w-[200px] border-r last:border-r-0 flex flex-col">
            {renderHeader()}
            <div className="flex-1">
                {isPlanning
                    ? renderPlanningContent()
                    : isToday(dateRecord.date)
                      ? renderDailyContent()
                      : renderHistoryContent()}
            </div>
        </div>
    );
}

function isToday(dateStr: string | null): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const today = new Date();
    return date.toDateString() === today.toDateString();
}
