import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import { useProjectStore } from "./projectStore";

export const useShownProjectStore = defineStore("shownProjectSet", () => {
    const shownProjectSet: Ref<Map<string, boolean>> = ref(new Map());
    const projectSet = useProjectStore();

    const update = () => {
        const IDlist = Array.from(projectSet.projectSet.values()).map((project) => project.projectID);
        IDlist.forEach((ID) => {
            setShow(ID);
        });
        IDlist.forEach((ID) => {
            if (!shownProjectSet.value.has(ID)) {
                setHide(ID);
            }
        });
        setShow("root");
    }
    const setShow = (projectID: string) => {
        if (!projectSet.hasProject(projectID)) {
            return;
        }
        const parentID = projectSet.getByID(projectID).parentID;
        if (parentID !== "none" && parentID !== "root") {
            setShow(parentID);
        }
        shownProjectSet.value.set(projectID, true);
    };

    const setHide = (projectID: string) => {
        if (!projectSet.hasProject(projectID)) {
            return;
        }
        if (projectID === "root") {
            console.log("root cannot be hidden");
            return;
        }
        const prj = projectSet.getByID(projectID);
        if (prj.children instanceof Set){
            prj.children.forEach((child) => {
                setHide(child);
            });
        }
        shownProjectSet.value.set(projectID, false);
    };

    const switchShownFlag = (projectID: string) => {
        if (shownProjectSet.value.has(projectID)) {
            if (isShown(projectID)) {
                setHide(projectID);
            } else {
                setShow(projectID);
            }
        }
    };

    const isShown = (projectID: string): boolean => {
        return shownProjectSet.value.get(projectID) || false;
    };

    return {
        shownProjectSet,
        update,
        setShow,
        setHide,
        switchShownFlag,
        isShown
    };
});
