// lib/api.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://api:8080/api";
console.log("NEXT_PUBLIC_API_BASE_URL =", process.env.NEXT_PUBLIC_API_BASE_URL);


type JsonBody = Record<string, any>;

async function postJSON<T>(path: string, body: JsonBody, token?: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include", // 关键：让后端能设置/带上 cookie
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "GET",
    credentials: "include",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  room: {
    init: (passcode: string, size: number) =>
      postJSON<{ inviteUrl: string; token?: string }>("/room/init", { passcode, size }),
    join: (token: string) => postJSON<{ status: string }>("/room/join", { token }),
    close: (token?: string) => postJSON<{ open: boolean }>("/room/close", {}, token),
    status: () =>
      getJSON<{ open: boolean; inviteLink?: string; headcount?: number; limit?: number }>("/room/status"),
  },
  run: {
    python: (code: string) =>
      postJSON<{ stdout: string; stderr: string }>("/room/run", { code }),
  },
  admin: {
    login: (password: string) => postJSON<{ token: string }>("/admin/login", { password }),
  },
  study: {
    list: () =>
      getJSON<Array<{ slug: string; title: string; markdown: string; excalidraw: any; createdAt: string; updatedAt: string; isPublished: boolean }>>("/lessons"),
    get: (slug: string) =>
      getJSON<{ slug: string; title: string; markdown: string; excalidraw: any; createdAt: string; updatedAt: string; isPublished: boolean }>(`/lessons/${slug}`),
    create: (data: { slug: string; title: string; markdown: string; excalidraw: any; isPublished?: boolean }, token: string) =>
      fetch(`${API_BASE}/lessons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          Slug: data.slug,
          Title: data.title,
          Markdown: data.markdown,
          Excalidraw: data.excalidraw,
          IsPublished: data.isPublished ?? true,
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      }),
    update: (slug: string, data: { title?: string; markdown?: string; excalidraw?: any }, token: string) =>
      fetch(`${API_BASE}/lessons/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          ...(data.title !== undefined ? { Title: data.title } : {}),
          ...(data.markdown !== undefined ? { Markdown: data.markdown } : {}),
          ...(data.excalidraw !== undefined ? { Excalidraw: data.excalidraw } : {}),
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      }),
  },
};
