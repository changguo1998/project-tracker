import { defineStore } from "pinia";
import type { Project } from "@/types/main";
import { ref, type Ref } from "vue";
import { randString } from "@/utils/randString";

export const useProjectStore = defineStore("projectSet", () => {
    const projectSet: Ref<Map<string, Project>> = ref(new Map());
    const init = () => {
        projectSet.value = new Map<string, Project>();
        projectSet.value.set("root", {
            projectID: "root",
            parentID: "none",
            projectName: "",
            level: 0,
            children: null,
        });
    };
    const hasProject = (id: string): boolean => {
        return projectSet.value.has(id);
    };
    const getByID = (id: string): Project => {
        return projectSet.value.get(id) as Project;
    };
    const addProject = (name: string, parentID: string) => {
        const parent = getByID(parentID);
        if (parent === null) {
            return;
        }
        const newProject: Project = {
            projectID: randString(),
            parentID: parentID,
            projectName: name,
            level: parent.level + 1,
            children: null,
        };
        projectSet.value.set(newProject.projectID, newProject);
        if (parent.children === null) {
            parent.children = new Set<string>();
        }
        if (parent.children instanceof Set) {
            parent.children.add(newProject.projectID);
        }
    };
    const rmProject = (id: string) => {
        if (!hasProject(id)) {
            return;
        }
        const project = getByID(id);
        if (project === null) {
            return;
        }
        if (project.children instanceof Set) {
            project.children.forEach((childID) => {
                rmProject(childID);
            });
            project.children.clear();
        }
        projectSet.value.delete(id);
    };
    const getLevel1 = (): Set<string> => {
        return getByID("root").children as Set<string>;
    };
    return { projectSet, init, hasProject, getByID, addProject, rmProject, getLevel1 };
});
