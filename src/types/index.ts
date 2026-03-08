// 任务（项目/任务/子任务统一模型）
export interface Task {
    id: string;
    name: string;
    parentId: string | null;
    color: string;
    isExpanded: boolean;
    level: number;
    createdAt: string;
    updatedAt: string;
}

// 日期记录
export interface DateRecord {
    id: string;
    date: string | null;
    isPlanning: boolean;
    createdAt: string;
}

// 每日计划项
export interface DailyPlan {
    id: string;
    dateId: string;
    taskId: string;
    content: string;
    isCompleted: boolean;
    actualTime?: number;
    notes: string;
    createdAt: string;
    updatedAt: string;
}

// 可见列（用于表格渲染）
export interface VisibleColumn {
    taskId: string;
    isSubTask: boolean;
    parentTaskId: string | null;
}

// WebDAV配置
export interface WebDAVConfig {
    url: string;
    username: string;
    password: string;
}

// 同步状态
export interface SyncState {
    lastSync: string | null;
    isSyncing: boolean;
    error: string | null;
}
