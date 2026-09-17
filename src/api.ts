import type { ApiLog, ApiProject, TaskStatus } from "@/types/main";

/** 构建期烘焙进 bundle 的共享口令；缺失时不带，靠 401 兜底 */
const TOKEN = (import.meta.env.VITE_API_TOKEN as string | undefined) || "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
        ...((init?.headers as Record<string, string> | undefined) ?? {}),
    };
    if (init?.body !== undefined) {
        headers["Content-Type"] = "application/json";
    }
    if (TOKEN) {
        headers["Authorization"] = `Bearer ${TOKEN}`;
    }
    const res = await fetch(path, { ...init, headers });
    if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
            const body = (await res.json()) as { error?: string };
            if (body && typeof body.error === "string") {
                msg = body.error;
            }
        } catch {
            // 非 JSON 错误体，保留 HTTP 状态字样
        }
        throw new Error(msg);
    }
    return (await res.json()) as T;
}

export function getState(): Promise<{
    projects: ApiProject[];
    logs: ApiLog[];
}> {
    return request("/api/state");
}

export async function addProject(p: {
    parentID: string | null;
    name: string;
    status?: TaskStatus;
}): Promise<ApiProject> {
    const body = await request<{ id: string; project: ApiProject }>(
        "/api/projects",
        {
            method: "POST",
            body: JSON.stringify(p),
        },
    );
    // 服务端返回 {id, project}，兼容 project 未内嵌 id 的情况
    return body.project.id ? body.project : { ...body.project, id: body.id };
}

export function patchProject(
    id: string,
    p: { name?: string; status?: TaskStatus },
): Promise<ApiProject> {
    return request<{ project: ApiProject }>(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(p),
    }).then((r) => r.project);
}

export function deleteProject(id: string): Promise<{ deleted: number }> {
    return request(`/api/projects/${id}`, { method: "DELETE" });
}

export async function addLog(p: {
    projectID: string;
    date: string;
    summary: string;
    detail: string;
    category?: string | null;
    tags?: string[];
    timeStart?: string | null;
    timeEnd?: string | null;
    done?: boolean;
}): Promise<ApiLog> {
    const body = await request<{ id: string; log: ApiLog }>("/api/logs", {
        method: "POST",
        body: JSON.stringify(p),
    });
    return body.log.id ? body.log : { ...body.log, id: body.id };
}

export function patchLog(id: string, p: Partial<ApiLog>): Promise<ApiLog> {
    return request<{ log: ApiLog }>(`/api/logs/${id}`, {
        method: "PATCH",
        body: JSON.stringify(p),
    }).then((r) => r.log);
}

export function deleteLog(id: string): Promise<{ deleted: number }> {
    return request(`/api/logs/${id}`, { method: "DELETE" });
}
