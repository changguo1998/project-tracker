import { useEffect, useState, useMemo } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { useDateStore } from "@/stores/dateStore";
import { usePlanStore } from "@/stores/planStore";
import { TaskColumn } from "./TaskColumn";
import { Calendar, Trash2 } from "lucide-react";
import { format, parseISO, isToday as isDateToday } from "date-fns";
import { zhCN } from "date-fns/locale";

export function TrackerTable() {
    const { tasks, deleteTask, getVisibleColumns, ensureRootNode } = useTaskStore();
    const { initializeDates, getSortedDates } = useDateStore();
    const { getPlansByDate } = usePlanStore();

    const [deleteConfirm, setDeleteConfirm] = useState<{
        show: boolean;
        taskId: string;
        taskName: string
    }>({
        show: false,
        taskId: "",
        taskName: ""
    });

    useEffect(() => {
        initializeDates();
        ensureRootNode();
    }, []);

    const visibleColumns = useMemo(() => {
        return getVisibleColumns();
    }, [tasks]);

    const sortedDates = getSortedDates();

    const filteredDates = useMemo(() => {
        return sortedDates.filter((dateRecord) => {
            if (dateRecord.isPlanning) return true;
            if (dateRecord.date && isDateToday(parseISO(dateRecord.date))) return true;
            const plans = getPlansByDate(dateRecord.id);
            return plans.length > 0;
        });
    }, [sortedDates, getPlansByDate]);

    const columnWidth = useMemo(() => {
        const baseWidth = 240;
        const dateColumnWidth = 128;
        const totalBaseWidth = dateColumnWidth + visibleColumns.length * baseWidth;

        if (typeof window === 'undefined') return baseWidth;

        const screenWidth = window.innerWidth;
        if (totalBaseWidth < screenWidth) {
            const availableWidth = screenWidth - dateColumnWidth;
            return Math.max(baseWidth, availableWidth / Math.max(1, visibleColumns.length));
        }
        return baseWidth;
    }, [visibleColumns.length]);

    return (
        <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
            <div className="bg-white dark:bg-gray-800 border-b px-4 py-2 flex items-center">
                <h1 className="text-lg font-bold dark:text-white">项目进度追踪</h1>
            </div>

            <div className="flex-1 overflow-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b">
                            <th className="w-32 p-2 border-r font-medium text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 text-left">
                                日期
                            </th>
                            {visibleColumns.length === 0 ? (
                                <th colSpan={1} className="p-4 text-gray-400 dark:text-gray-500 text-center">
                                    点击"新建项目"开始追踪
                                </th>
                            ) : (
                                visibleColumns.map((col) => {
                                    const task = tasks[col.taskId];
                                    if (!task) return null;

                                    return (
                                        <th
                                            key={col.taskId}
                                            className="border-r text-center font-medium h-10 group relative"
                                            style={{
                                                width: `${columnWidth}px`,
                                                backgroundColor: `${task.color}15`,
                                                color: task.color,
                                            }}
                                        >
                                            {col.isSubTask && (
                                                <span className="mr-1">◆</span>
                                            )}
                                            <span className="truncate px-2">{task.name}</span>

                                            {task.id !== "root-summary" && (
                                                <button
                                                    onClick={() => {
                                                        setDeleteConfirm({
                                                            show: true,
                                                            taskId: task.id,
                                                            taskName: task.name
                                                        });
                                                    }}
                                                    className="absolute right-1 p-1 text-gray-400 dark:text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="删除任务"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </th>
                                    );
                                })
                            )}
                        </tr>
                    </thead>
                    <tbody>
                        {filteredDates.map((dateRecord) => (
                            <tr
                                key={dateRecord.id}
                                className={`border-b hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                    dateRecord.isPlanning ? "bg-blue-50 dark:bg-blue-900/20" : ""
                                } ${
                                    dateRecord.date && isDateToday(parseISO(dateRecord.date)) ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                                }`}
                            >
                                <td className="w-32 p-2 border-r bg-gray-50 dark:bg-gray-700">
                                    {dateRecord.isPlanning ? (
                                        <>
                                            <Calendar
                                                size={16}
                                                className="text-blue-500 inline-block mr-2"
                                            />
                                            <span className="font-medium text-blue-600 dark:text-blue-400">
                                                规划
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-sm dark:text-gray-300">
                                                {dateRecord.date &&
                                                    format(
                                                        parseISO(dateRecord.date),
                                                        "MM-dd",
                                                        { locale: zhCN },
                                                    )}
                                            </span>
                                            {dateRecord.date &&
                                                isDateToday(
                                                    parseISO(dateRecord.date),
                                                ) && (
                                                    <span className="text-xs bg-yellow-200 dark:bg-yellow-600 dark:text-white px-1.5 py-0.5 rounded ml-2">
                                                        今天
                                                    </span>
                                                )}
                                        </>
                                    )}
                                </td>
                                {visibleColumns.length > 0 &&
                                    visibleColumns.map((col) => {
                                        const task = tasks[col.taskId];
                                        if (!task) return null;

                                        return (
                                            <td
                                                key={`${dateRecord.id}-${col.taskId}`}
                                                style={{ width: `${columnWidth}px` }}
                                            >
                                                <TaskColumn
                                                    task={task}
                                                    dateRecord={dateRecord}
                                                    isPlanning={dateRecord.isPlanning}
                                                    columnWidth={columnWidth}
                                                />
                                            </td>
                                        );
                                    })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {deleteConfirm.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-80 shadow-xl">
                        <h3 className="text-lg font-medium mb-2 dark:text-white">确认删除</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                            确定要删除"{deleteConfirm.taskName}"吗？
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setDeleteConfirm({ show: false, taskId: "", taskName: "" })}
                                className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                            >
                                取消
                            </button>
                            <button
                                onClick={() => {
                                    deleteTask(deleteConfirm.taskId);
                                    setDeleteConfirm({ show: false, taskId: "", taskName: "" });
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
