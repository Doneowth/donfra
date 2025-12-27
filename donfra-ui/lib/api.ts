// lib/api.ts
// Prefer same-origin proxy (/api) so both browser + SSR hit the backend via the reverse proxy.
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";


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
      postJSON<{ inviteUrl: string; roomId: string; token?: string }>("/room/init", { passcode, size }),
    join: (token: string) => postJSON<{ success: boolean }>("/room/join", { token }),
    close: (token?: string) => postJSON<{ open: boolean }>("/room/close", {}, token),
    status: () =>
      getJSON<{ open: boolean; roomId?: string; inviteLink?: string; headcount?: number; limit?: number }>("/room/status"),
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
          slug: data.slug,
          title: data.title,
          markdown: data.markdown,
          excalidraw: data.excalidraw,
          isPublished: data.isPublished ?? true,
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      }),
    update: (slug: string, data: { title?: string; markdown?: string; excalidraw?: any; isPublished?: boolean }, token: string) =>
      fetch(`${API_BASE}/lessons/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.markdown !== undefined ? { markdown: data.markdown } : {}),
          ...(data.excalidraw !== undefined ? { excalidraw: data.excalidraw } : {}),
          ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      }),
    delete: (slug: string, token: string) =>
      fetch(`${API_BASE}/lessons/${slug}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      }),
  },
  auth: {
    register: (email: string, password: string, username?: string) =>
      postJSON<{ user: { id: number; email: string; username: string; role: string; isActive: boolean; createdAt: string } }>("/auth/register", { email, password, username }),
    login: (email: string, password: string) =>
      postJSON<{ user: { id: number; email: string; username: string; role: string; isActive: boolean; createdAt: string }; token: string }>("/auth/login", { email, password }),
    logout: () =>
      postJSON<{ message: string }>("/auth/logout", {}),
    me: () =>
      getJSON<{ user: { id: number; email: string; username: string; role: string; isActive: boolean; createdAt: string } }>("/auth/me"),
    refresh: () =>
      postJSON<{ token: string }>("/auth/refresh", {}),
    updatePassword: (currentPassword: string, newPassword: string) =>
      postJSON<{ message: string }>("/auth/update-password", { current_password: currentPassword, new_password: newPassword }),
  },
  interview: {
    init: () =>
      postJSON<{ room_id: string; invite_link: string; message: string }>("/interview/init", {}),
    close: (roomId: string) =>
      postJSON<{ message: string }>("/interview/close", { room_id: roomId }),
    getMyRooms: () =>
      getJSON<{ rooms: Array<{ id: number; room_id: string; owner_id: number; headcount: number; code_snapshot: string; invite_link: string; created_at: string; updated_at: string }> }>("/interview/my-rooms"),
  },
};
