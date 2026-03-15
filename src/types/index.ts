export type TaskStatus =
    "plan" |
    "progress" |
    "failed" |
    "done" |
    "delay";

export interface Task {
    taskId: string;
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
    children: (string | Task)[];
}

export interface Timeline {
    dates: string[];
    tasks: Task[];
}
