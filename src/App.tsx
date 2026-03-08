import { useState, useEffect } from "react";
import { TrackerTable } from "@/components/TrackerTable";
import { WebDAVSettings } from "@/components/WebDAVSettings";
import { Cloud, CloudOff, Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/stores/themeStore";

function App() {
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isOnline, setIsOnline] = useState(false);
    const { isDark, toggleTheme } = useThemeStore();

    useEffect(() => {
        const root = document.documentElement;
        if (isDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    }, [isDark]);

    useEffect(() => {
        const savedTheme = localStorage.getItem("theme-storage");
        if (savedTheme) {
            try {
                const parsed = JSON.parse(savedTheme);
                if (parsed.state?.isDark) {
                    document.documentElement.classList.add("dark");
                }
            } catch (e) {
                console.error("Failed to parse theme storage:", e);
            }
        }
    }, []);

    return (
        <div className="h-screen flex flex-col">
            <header className="bg-white dark:bg-gray-800 border-b px-4 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold dark:text-white">Project Tracker</h1>
                </div>
                <div className="flex items-center gap-4">
                    <button
                        onClick={toggleTheme}
                        className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                        title={isDark ? "切换到亮色模式" : "切换到暗色模式"}
                    >
                        {isDark ? <Sun size={18} /> : <Moon size={18} />}
                    </button>
                    <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-1 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white"
                    >
                        {isOnline ? (
                            <Cloud
                                size={18}
                                className="text-green-500"
                            />
                        ) : (
                            <CloudOff size={18} />
                        )}
                        <span className="text-sm dark:text-white">WebDAV</span>
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-hidden">
                <TrackerTable />
            </main>

            <WebDAVSettings
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </div>
    );
}

export default App;
