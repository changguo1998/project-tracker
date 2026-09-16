import { reactive } from "vue";

/** App 级单例错误提示状态；各调用方（组件）catch 到 store 抛错后 reportError */
export const errorState = reactive({ show: false, message: "" });

export function reportError(err: unknown): void {
    errorState.message = err instanceof Error ? err.message : String(err);
    errorState.show = true;
}
