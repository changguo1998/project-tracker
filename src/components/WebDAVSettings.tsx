import { useState } from "react";
import { Settings, X, Check, AlertCircle } from "lucide-react";
import type { WebDAVConfig } from "@/types";

interface WebDAVSettingsProps {
    isOpen: boolean;
    onClose: () => void;
}

export function WebDAVSettings({ isOpen, onClose }: WebDAVSettingsProps) {
    const [config, setConfig] = useState<WebDAVConfig>({
        url: localStorage.getItem("webdav-url") || "",
        username: localStorage.getItem("webdav-username") || "",
        password: localStorage.getItem("webdav-password") || "",
    });
    const [testStatus, setTestStatus] = useState<
        "idle" | "testing" | "success" | "error"
    >("idle");

    const handleSave = () => {
        localStorage.setItem("webdav-url", config.url);
        localStorage.setItem("webdav-username", config.username);
        localStorage.setItem("webdav-password", config.password);
        onClose();
    };

    const handleTest = async () => {
        setTestStatus("testing");
        try {
            // 这里应该实际测试WebDAV连接
            // 暂时模拟测试
            await new Promise((resolve) => setTimeout(resolve, 1000));
            setTestStatus("success");
        } catch {
            setTestStatus("error");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-96 max-w-full mx-4">
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center gap-2">
                        <Settings size={20} className="dark:text-gray-300" />
                        <h2 className="text-lg font-medium dark:text-white">WebDAV 设置</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                        <X size={20} className="dark:text-gray-300" />
                    </button>
                </div>

                <div className="p-4 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            WebDAV 地址
                        </label>
                        <input
                            type="text"
                            value={config.url}
                            onChange={(e) =>
                                setConfig({ ...config, url: e.target.value })
                            }
                            placeholder="https://example.com/dav"
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            用户名
                        </label>
                        <input
                            type="text"
                            value={config.username}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    username: e.target.value,
                                })
                            }
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            密码
                        </label>
                        <input
                            type="password"
                            value={config.password}
                            onChange={(e) =>
                                setConfig({
                                    ...config,
                                    password: e.target.value,
                                })
                            }
                            className="w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                    </div>

                    {testStatus === "success" && (
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                            <Check size={16} />
                            连接成功
                        </div>
                    )}

                    {testStatus === "error" && (
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                            <AlertCircle size={16} />
                            连接失败，请检查配置
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-2 p-4 border-t">
                    <button
                        onClick={handleTest}
                        disabled={testStatus === "testing"}
                        className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                    >
                        {testStatus === "testing" ? "测试中..." : "测试连接"}
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        保存
                    </button>
                </div>
            </div>
        </div>
    );
}
