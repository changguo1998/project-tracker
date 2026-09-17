export type TaskStatus = "plan" | "progress" | "failed" | "done" | "delay";

/** 服务端记录返回形状（与 §1.1 字段对齐，children 永不出现） */
export interface ProjectRec {
    id: string;
    parentID: string | null;
    name: string;
    level: number;
}

/** 前端模型：children 由 loadState 依据扁平 parentID 重建（叶子为 null） */
export interface Project extends ProjectRec {
    children: Set<string> | null;
}

/** 服务端日志记录（§1.1） */
export interface LogRec {
    id: string;
    projectID: string;
    date: string;
    status: TaskStatus;
    summary: string;
    detail: string;
    /** 分类：单选，可空 */
    category: string | null;
    /** 标签：多选 */
    tags: string[];
}

/** API 层别名，便于 api.ts 契约清晰表达 */
export type ApiProject = ProjectRec;
export type ApiLog = LogRec;
