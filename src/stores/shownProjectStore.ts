import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import { useProjectStore } from "./projectStore";

/**
 * 每设备 UI 显示状态（不同步到 server）。
 * 语义：默认全部顶层项目显示；switchShownFlag 切换单项目显示/隐藏。
 */
export const useShownProjectStore = defineStore("shownProjectSet", () => {
    const shownProjectSet: Ref<Map<string, boolean>> = ref(new Map());
    const projectStore = useProjectStore();

    /** 由 App 在载入完成后调用：为所有现存项目补齐默认显示态，清理已删除项 */
    const update = () => {
        const liveIds = new Set(projectStore.projectMap.keys());
        liveIds.forEach((id) => {
            if (!shownProjectSet.value.has(id)) {
                shownProjectSet.value.set(id, true);
            }
        });
        Array.from(shownProjectSet.value.keys()).forEach((id) => {
            if (!liveIds.has(id)) {
                shownProjectSet.value.delete(id);
            }
        });
    };

    const isShown = (id: string): boolean => shownProjectSet.value.get(id) ?? true;

    const switchShownFlag = (id: string) => {
        shownProjectSet.value.set(id, !isShown(id));
    };

    return { shownProjectSet, update, isShown, switchShownFlag };
});
