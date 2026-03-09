import { useTaskStore } from "@/stores/taskStore";
import { debug } from "@/utils/debug";

export function Level1Selector() {
    const { tasks } = useTaskStore();
    const { level1Visibility, setLevel1Visibility } = useTaskStore();

    const level1Nodes = Object.values(tasks)
        .filter((node) => {
            if (!node || typeof node !== 'object') return false;
            return 'level' in node && node.level === 1;
        })
        .sort((a, b) => a.name.localeCompare(b.name));

    const handleCheckboxChange = (taskId: string, checked: boolean) => {
        debug('Level1Selector', { taskId, checked });
        setLevel1Visibility(taskId, checked);
    };

    return (
        <div className="p-4 bg-white dark:bg-gray-800 border-b">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    项目列表（勾选显示）：
                </span>
            </div>
            <div className="flex flex-wrap gap-2">
                {level1Nodes.map((node) => (
                    <label
                        key={node.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded cursor-pointer transition-colors ${
                            level1Visibility[node.id] !== false
                                ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                                : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                        }`}
                    >
                        <input
                            type="checkbox"
                            checked={level1Visibility[node.id]}
                            onChange={(e) => handleCheckboxChange(node.id, e.target.checked)}
                            className="hidden"
                        />
                        <div
                            className={`w-3 h-3 rounded border flex items-center justify-center ${
                                level1Visibility[node.id] !== false
                                    ? "bg-blue-500 border-blue-500"
                                    : "border-gray-400 dark:border-gray-500"
                            }`}
                        >
                            {level1Visibility[node.id] !== false && (
                                <svg
                                    className="w-2 h-2 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M5 13l4 4L19 7"
                                    />
                                </svg>
                            )}
                        </div>
                        <span className="text-sm">{node.name}</span>
                    </label>
                ))}
                {level1Nodes.length === 0 && (
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                        暂无项目
                    </span>
                )}
            </div>
        </div>
    );
}
