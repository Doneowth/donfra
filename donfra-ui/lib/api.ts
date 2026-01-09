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
  admin: {
    users: {
      list: () => getJSON<{ users: Array<{ id: number; email: string; username: string; role: string; isActive: boolean; createdAt: string }> }>("/admin/users"),
      updateRole: (userId: number, role: string) =>
        fetch(`${API_BASE}/admin/users/${userId}/role`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ role }),
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          return data;
        }),
      updateActiveStatus: (userId: number, isActive: boolean) =>
        fetch(`${API_BASE}/admin/users/${userId}/active`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ is_active: isActive }),
        }).then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
          return data;
        }),
    },
  },
  study: {
    listSummary: (page?: number, size?: number, sortBy?: string, sortDesc?: boolean, search?: string) => {
      const params = new URLSearchParams();
      if (page !== undefined) params.append("page", page.toString());
      if (size !== undefined) params.append("size", size.toString());
      if (sortBy) params.append("sort_by", sortBy);
      if (sortDesc !== undefined) params.append("sort_desc", sortDesc.toString());
      if (search) params.append("search", search);
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
      getJSON<{ slug: string; title: string; markdown: string; excalidraw: any; videoUrl?: string; codeTemplate?: any; createdAt: string; updatedAt: string; isPublished: boolean; isVip: boolean; author?: string; publishedDate?: string }>(`/lessons/${slug}`),
    create: (data: { slug: string; title: string; markdown: string; excalidraw: any; videoUrl?: string; codeTemplate?: any; isPublished?: boolean; isVip?: boolean; author?: string; publishedDate?: string }) =>
      fetch(`${API_BASE}/lessons`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          slug: data.slug,
          title: data.title,
          markdown: data.markdown,
          excalidraw: data.excalidraw,
          videoUrl: data.videoUrl,
          codeTemplate: data.codeTemplate,
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
    update: (slug: string, data: { title?: string; markdown?: string; excalidraw?: any; videoUrl?: string; codeTemplate?: any; isPublished?: boolean; isVip?: boolean; author?: string; publishedDate?: string }) =>
      fetch(`${API_BASE}/lessons/${slug}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.markdown !== undefined ? { markdown: data.markdown } : {}),
          ...(data.excalidraw !== undefined ? { excalidraw: data.excalidraw } : {}),
          ...(data.videoUrl !== undefined ? { videoUrl: data.videoUrl } : {}),
          ...(data.codeTemplate !== undefined ? { codeTemplate: data.codeTemplate } : {}),
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
    delete: (slug: string) =>
      fetch(`${API_BASE}/lessons/${slug}`, {
        method: "DELETE",
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
    updatePassword: (currentPassword: string, newPassword: string) =>
      postJSON<{ message: string }>("/auth/update-password", { current_password: currentPassword, new_password: newPassword }),
    googleAuthURL: () =>
      getJSON<{ auth_url: string; state: string }>("/auth/google/url"),
  },
  interview: {
    init: () =>
      postJSON<{ room_id: string; invite_link: string; message: string }>("/interview/init", {}),
    join: (inviteToken: string) =>
      postJSON<{ room_id: string; message: string }>("/interview/join", { invite_token: inviteToken }),
    close: (roomId: string) =>
      postJSON<{ room_id: string; message: string }>("/interview/close", { room_id: roomId }),
    getMyRooms: () =>
      getJSON<{ rooms: Array<{ id: number; room_id: string; owner_id: number; headcount: number; code_snapshot: string; invite_link: string; created_at: string; updated_at: string }> }>("/interview/my-rooms"),
    getRoomStatus: (roomId: string) =>
      getJSON<{ room_id: string; owner_id: number; headcount: number; invite_link: string; created_at: string; updated_at: string }>(`/interview/rooms/${roomId}/status`),
    getAllRooms: () =>
      getJSON<{ rooms: Array<{ id: number; room_id: string; owner_id: number; headcount: number; code_snapshot: string; invite_link: string; created_at: string; updated_at: string }> }>("/interview/rooms/all"),
  },
  live: {
    create: (title: string, ownerName: string) =>
      postJSON<{ session_id: string; server_url: string; host_token: string; created_at: string; message: string }>("/live/create", { title, owner_name: ownerName }),
    join: (sessionId: string, userName: string, isHost: boolean = false) =>
      postJSON<{ session_id: string; access_token: string; server_url: string; role: string; can_publish: boolean; can_subscribe: boolean; message: string }>("/live/join", { session_id: sessionId, user_name: userName, is_host: isHost }),
    end: (sessionId: string) =>
      postJSON<{ session_id: string; ended_at: string; message: string }>("/live/end", { session_id: sessionId }),
  },
  ai: {
    chatStream: async (
      codeContent: string | undefined,
      question: string,
      history: Array<{ role: string; content: string }>,
      onChunk: (chunk: string) => void,
      onError?: (error: string) => void
    ) => {
      // Use direct backend URL to bypass Next.js proxy buffering for SSE
      const streamUrl = typeof window !== 'undefined' && process.env.NODE_ENV === 'development'
        ? 'http://localhost:8080/api/ai/chat/stream'
        : `${API_BASE}/ai/chat/stream`;

      const response = await fetch(streamUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          code_content: codeContent,
          question,
          history,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No response body");
      }

      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Decode chunk and add to buffer
          const decoded = decoder.decode(value, { stream: true });
          buffer += decoded;

          // Process complete lines from buffer
          const lines = buffer.split("\n");
          // Keep the last incomplete line in buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.trim()) continue;

            if (line.startsWith("data: ")) {
              const content = line.slice(6); // Remove "data: " prefix
              if (content && content !== "[DONE]") {
                onChunk(content);
              }
            } else if (line.startsWith("event: error")) {
              // Error event
              onError?.("Stream error occurred");
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    },
  },
};
