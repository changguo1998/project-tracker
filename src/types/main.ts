export type TaskStatus = "plan" | "progress" | "failed" | "done" | "delay";

/**
 * @field `projectID`: unique identifier of the project
 * @field `date`: date of the log
 * @field `status`: status of the task
 * @field `summary`: summary of the task
 * @field `detail`: detail of the task
 */
export interface Log {
    projectID: string;
    date: string;
    status: TaskStatus;
    summary: string;
    detail: string;
}

/**
 * @field `projectID`: unique identifier of the project
 * @field `parentID`: parent project ID of the project
 * @field `projectName`: name of the project
 * @field `level`: level of the project in the tree
 * @field `children`: children of the project, can be Project or Task
 *     - null: if the project has no children
 *     - Set<string>: children's are Project
 *     - string[]: children's are Task
 */
export interface Project {
    projectID: string;
    parentID: string;
    projectName: string;
    level: number;
    // Set<string>: children's are Project
    // string[]: children's are Task
    children: Set<string> | string[] | null;
}
