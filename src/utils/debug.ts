const DEBUG = false;

export function debug(label: string, ...args: unknown[]) {
    if (DEBUG) {
        console.log(`[${label}]`, ...args);
    }
}
