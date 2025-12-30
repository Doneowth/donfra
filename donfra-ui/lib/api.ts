// lib/api.ts
// Use proxy for both browser and SSR to maintain same-origin for cookies
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
    list: (page?: number, size?: number) => {
      const params = new URLSearchParams();
      if (page !== undefined) params.append("page", page.toString());
      if (size !== undefined) params.append("size", size.toString());
      const query = params.toString();
      return getJSON<{
        lessons: Array<{ id: number; slug: string; title: string; markdown: string; excalidraw: any; createdAt: string; updatedAt: string; isPublished: boolean; isVip: boolean; author?: string; publishedDate?: string }>;
        total: number;
        page: number;
        size: number;
        totalPages: number;
      }>(`/lessons${query ? `?${query}` : ""}`);
    },
    listSummary: (page?: number, size?: number) => {
      const params = new URLSearchParams();
      if (page !== undefined) params.append("page", page.toString());
      if (size !== undefined) params.append("size", size.toString());
      const query = params.toString();
      return getJSON<{
        lessons: Array<{ id: number; slug: string; title: string; isPublished: boolean; isVip: boolean; author?: string; publishedDate?: string; createdAt: string; updatedAt: string }>;
        total: number;
        page: number;
        size: number;
        totalPages: number;
      }>(`/lessons/summary${query ? `?${query}` : ""}`);
    },
    get: (slug: string) =>
      getJSON<{ slug: string; title: string; markdown: string; excalidraw: any; videoUrl?: string; createdAt: string; updatedAt: string; isPublished: boolean; isVip: boolean; author?: string; publishedDate?: string }>(`/lessons/${slug}`),
    create: (data: { slug: string; title: string; markdown: string; excalidraw: any; videoUrl?: string; isPublished?: boolean; isVip?: boolean; author?: string; publishedDate?: string }, token: string) =>
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
          videoUrl: data.videoUrl,
          isPublished: data.isPublished ?? true,
          isVip: data.isVip ?? false,
          author: data.author,
          publishedDate: data.publishedDate,
        }),
      }).then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        return body;
      }),
    update: (slug: string, data: { title?: string; markdown?: string; excalidraw?: any; videoUrl?: string; isPublished?: boolean; isVip?: boolean; author?: string; publishedDate?: string }, token: string) =>
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
          ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
          ...(data.isPublished !== undefined ? { isPublished: data.isPublished } : {}),
          ...(data.isVip !== undefined ? { isVip: data.isVip } : {}),
          ...(data.author !== undefined ? { author: data.author } : {}),
          ...(data.publishedDate !== undefined ? { publishedDate: data.publishedDate } : {}),
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
      getJSON<{ user: { id: number; email: string; username: string; role: string; isActive: boolean; createdAt: string } | null }>("/auth/me"),
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
  live: {
    create: (title: string, ownerName: string) =>
      postJSON<{ session_id: string; server_url: string; host_token: string; created_at: string; message: string }>("/live/create", { title, owner_name: ownerName }),
    join: (sessionId: string, userName: string, isHost: boolean = false) =>
      postJSON<{ session_id: string; access_token: string; server_url: string; role: string; can_publish: boolean; can_subscribe: boolean; message: string }>("/live/join", { session_id: sessionId, user_name: userName, is_host: isHost }),
    end: (sessionId: string) =>
      postJSON<{ session_id: string; ended_at: string; message: string }>("/live/end", { session_id: sessionId }),
  },
};
