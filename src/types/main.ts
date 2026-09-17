export type TaskStatus = "plan" | "progress" | "failed" | "done" | "delay";

/** 服务端记录返回形状（与 §1.1 字段对齐，children 永不出现） */
export interface ProjectRec {
    id: string;
    parentID: string | null;
    name: string;
    level: number;
    /** 项目/子项目状态 */
    status: TaskStatus;
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
    summary: string;
    detail: string;
    /** 分类：单选，可空 */
    category: string | null;
    /** 标签：多选 */
    tags: string[];
    /** 开始时间 HH:mm，可空（不跨天） */
    timeStart: string | null;
    /** 结束时间 HH:mm，可空 */
    timeEnd: string | null;
    /** 完成标记（逐条粒度） */
    done: boolean;
    /** 紧急标记（独立设置，不混入标签） */
    urgent: boolean;
    /** 重要标记（独立设置，不混入标签） */
    important: boolean;
}

/** API 层别名，便于 api.ts 契约清晰表达 */
export type ApiProject = ProjectRec;
export type ApiLog = LogRec;
