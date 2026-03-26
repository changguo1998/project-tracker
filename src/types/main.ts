export type TaskStatus = "plan" | "progress" | "failed" | "done" | "delay";

export interface Task {
    projectID: string;
    date: string;
    status: TaskStatus;
    summary: string;
    detail: string;
}

export interface Project {
    projectID: string;
    projectName: string;
    level: number;
    // Set<string>: children's are Project
    // string[]: children's are Task
    children: Set<string> | string[] | null;
}
