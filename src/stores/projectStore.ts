import { defineStore } from "pinia";
import { ref, type Ref } from "vue";
import type { Project, ProjectRec } from "@/types/main";
import * as api from "@/api";

/** 扁平 parentID 列表重建 children Set（叶子为 null） */
function rebuildChildren(list: ProjectRec[]): Project[] {
    const map = new Map<string, Project>();
    for (const rec of list) {
        map.set(rec.id, { ...rec, children: null });
    }
    for (const rec of list) {
        if (rec.parentID !== null && map.has(rec.parentID)) {
            const parent = map.get(rec.parentID);
            if (parent) {
                if (parent.children === null) {
                    parent.children = new Set<string>();
                }
                parent.children.add(rec.id);
            }
        }
    }
    return Array.from(map.values());
}

export const useProjectStore = defineStore("projectSet", () => {
    const projectMap: Ref<Map<string, Project>> = ref(new Map());

    const loadState = async () => {
        const state = await api.getState();
        const projects = rebuildChildren(state.projects);
        projectMap.value = new Map(projects.map((p) => [p.id, p]));
    };

    const hasProject = (id: string): boolean => projectMap.value.has(id);
    const getByID = (id: string): Project | undefined => projectMap.value.get(id);

    /** 顶层项目（parentID === null） */
    const getLevel1 = (): Project[] =>
        Array.from(projectMap.value.values()).filter((p) => p.parentID === null);

    /** server-first：先 await 后端成功，再用服务端返回的 ID 落本地 */
    const addProject = async (name: string, parentID: string | null): Promise<Project> => {
        const project = await api.addProject({ parentID, name });
        const rec: Project = {
            id: project.id,
            parentID: project.parentID ?? parentID,
            name: project.name,
            level: project.level,
            children: null,
        };
        projectMap.value.set(rec.id, rec);
        if (rec.parentID !== null) {
            const parent = projectMap.value.get(rec.parentID);
            if (parent) {
                if (parent.children === null) {
                    parent.children = new Set<string>();
                }
                parent.children.add(rec.id);
            }
        }
        return rec;
    };

    const renameProject = async (id: string, name: string): Promise<Project | undefined> => {
        const project = await api.patchProject(id, { name });
        const cur = projectMap.value.get(id);
        if (cur) {
            cur.name = project.name;
            cur.level = project.level;
        }
        return cur;
    };

    /** server-first：后端已单事务级联删子树+logs，这里在本地按相同语义清理 */
    const rmProject = async (id: string) => {
        await api.deleteProject(id);
        const collect = (pid: string): string[] => {
            const ids: string[] = [pid];
            const p = projectMap.value.get(pid);
            if (p && p.children) {
                p.children.forEach((cid) => ids.push(...collect(cid)));
            }
            return ids;
        };
        const doomed = collect(id);
        for (const pid of doomed) {
            const p = projectMap.value.get(pid);
            if (p && p.parentID !== null) {
                const parent = projectMap.value.get(p.parentID);
                parent?.children?.delete(pid);
            }
            projectMap.value.delete(pid);
        }
    };

    return { projectMap, loadState, hasProject, getByID, getLevel1, addProject, renameProject, rmProject };
});
