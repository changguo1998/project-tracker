import { useState } from "react";
import { TrackerTable } from "@/components/TrackerTable";
import { WebDAVSettings } from "@/components/WebDAVSettings";
import { Cloud, CloudOff } from "lucide-react";

function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(false);

    return (
        <div className="h-screen flex flex-col">
            {/* 顶部栏 */}
            <header className="bg-white border-b px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold">Project Tracker</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-1 text-gray-600 hover:text-gray-800"
                    >
                        {isOnline ? (
                            <Cloud
                                size={18}
                                className="text-green-500"
                            />
                        ) : (
                            <CloudOff size={18} />
                        )}
                        <span className="text-sm">WebDAV</span>
                    </button>
                </div>
            </header>

            {/* 主内容 */}
            <main className="flex-1 overflow-hidden">
                <TrackerTable />
            </main>

            {/* 设置弹窗 */}
            <WebDAVSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}

export default App;
