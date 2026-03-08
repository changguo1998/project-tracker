import { useEffect } from "react";
import { useTaskStore } from "@/stores/taskStore";
import { useDateStore } from "@/stores/dateStore";
import { TaskColumn } from "./TaskColumn";
import { Plus, Calendar } from "lucide-react";
import { format, parseISO, isToday as isDateToday } from "date-fns";
import { zhCN } from "date-fns/locale";

export function TrackerTable() {
    const { getVisibleColumns, addTask, getRootTasks } = useTaskStore();
    const { initializeDates, getSortedDates, getPlanningRow } = useDateStore();

    useEffect(() => {
        initializeDates();
    }, []);

    const visibleColumns = getVisibleColumns();
    const sortedDates = getSortedDates();
    const planningRow = getPlanningRow();
    const rootTasks = getRootTasks();

    const handleAddRootTask = () => {
        const name = prompt("输入项目名称:");
        if (name) {
            addTask(name);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-gray-50">
            {/* 顶部工具栏 */}
            <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
                <h1 className="text-lg font-bold">项目进度追踪</h1>
                <button
                    onClick={handleAddRootTask}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    <Plus size={16} />
                    新建项目
                </button>
            </div>

            {/* 表格区域 */}
            <div className="flex-1 overflow-auto">
                <div className="inline-block min-w-full">
                    {/* 表头 - 日期列 */}
                    <div className="flex sticky top-0 z-10 bg-white border-b">
                        <div className="w-32 p-2 border-r font-medium text-gray-500 bg-gray-50">
                            日期
                        </div>
                        {visibleColumns.length === 0 ? (
                            <div className="p-4 text-gray-400">
                                点击"新建项目"开始追踪
                            </div>
                        ) : (
                            visibleColumns.map((col) => {
                                const task = useTaskStore
                                    .getState()
                                    .tasks.find((t) => t.id === col.taskId);
                                if (!task) return null;
                                return (
                                    <div
                                        key={col.taskId}
                                        className="min-w-[200px] p-2 border-r text-center font-medium"
                                        style={{
                                            backgroundColor: `${task.color}15`,
                                            color: task.color,
                                            paddingLeft: `${task.level * 16 + 8}px`,
                                        }}
                                    >
                                        {col.isSubTask && (
                                            <span className="mr-1">◆</span>
                                        )}
                                        {task.name}
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* 表格内容 */}
                    {sortedDates.map((dateRecord) => (
                        <div
                            key={dateRecord.id}
                            className={`flex border-b hover:bg-gray-50 ${
                                dateRecord.isPlanning ? "bg-blue-50" : ""
                            } ${dateRecord.date && isDateToday(parseISO(dateRecord.date)) ? "bg-yellow-50" : ""}`}
                        >
                            {/* 日期列 */}
                            <div className="w-32 p-2 border-r bg-gray-50 flex items-center gap-2">
                                {dateRecord.isPlanning ? (
                                    <>
                                        <Calendar
                                            size={16}
                                            className="text-blue-500"
                                        />
                                        <span className="font-medium text-blue-600">
                                            规划
                                        </span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-sm">
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
                                                <span className="text-xs bg-yellow-200 px-1.5 py-0.5 rounded">
                                                    今天
                                                </span>
                                            )}
                                    </>
                                )}
                            </div>

                            {/* 任务列 */}
                            {visibleColumns.length > 0 &&
                                visibleColumns.map((col) => {
                                    const task = useTaskStore
                                        .getState()
                                        .tasks.find((t) => t.id === col.taskId);
                                    if (!task) return null;
                                    return (
                                        <TaskColumn
                                            key={`${dateRecord.id}-${col.taskId}`}
                                            task={task}
                                            dateRecord={dateRecord}
                                            isPlanning={dateRecord.isPlanning}
                                        />
                                    );
                                })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
