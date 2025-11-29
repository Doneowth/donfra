// lib/api.ts
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL
console.log("NEXT_PUBLIC_API_BASE_URL =", process.env.NEXT_PUBLIC_API_BASE_URL);


type JsonBody = Record<string, any>;

async function postJSON<T>(path: string, body: JsonBody): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
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
    init: (passcode: string) =>
      postJSON<{ inviteUrl: string }>("/room/init", { passcode }),
    join: (token: string) => postJSON<{ status: string }>("/room/join", { token }),
    close: () => postJSON<{ open: boolean }>("/room/close", {}),
    status: () => getJSON<{ open: boolean }>("/room/status"),
  },
  run: {
    python: (code: string) =>
      postJSON<{ stdout: string; stderr: string }>("/room/run", { code }),
  },
};
