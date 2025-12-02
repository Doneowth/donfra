"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/api";

type RoomStatus = {
  open: boolean;
  inviteLink?: string;
  headcount?: number;
  limit?: number;
};

export default function AdminDashboard() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<RoomStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState<string>("");
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("admin_token");
    if (saved) setToken(saved);
  }, []);

  useEffect(() => {
    if (token) refreshStatus();
  }, [token]);

  const login = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!password.trim()) {
      setError("Password required.");
      return;
    }
    try {
      setLoading(true);
      setError("");
      const res = await api.admin.login(password.trim());
      setToken(res.token);
      if (typeof window !== "undefined") localStorage.setItem("admin_token", res.token);
      await refreshStatus();
    } catch (err: any) {
      setError(err?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const refreshStatus = async () => {
    try {
      setError("");
      const res = await api.room.status();
      setStatus(res);
      setLastChecked(new Date());
    } catch (err: any) {
      setError(err?.message || "Unable to load status.");
    }
  };

  const closeRoom = async () => {
    if (!token) {
      setError("Login required before closing the room.");
      return;
    }
    try {
      setClosing(true);
      setError("");
      const res = await api.room.close(token);
      setStatus((prev) => ({ ...(prev || {}), open: res.open }));
    } catch (err: any) {
      const msg = err?.message || "Unable to close room.";
      setError(msg);
      if (msg.toLowerCase().includes("unauthorized")) {
        logout();
      }
    } finally {
      setClosing(false);
    }
  };

  const logout = () => {
    setToken(null);
    if (typeof window !== "undefined") localStorage.removeItem("admin_token");
  };

  const authed = Boolean(token);
  const statusBadge = status?.open ? "badge-on" : "badge-off";
  const statusText = status?.open ? "Room is live" : "Room is closed";

  if (!authed) {
    return (
      <main className="admin-shell">
        <video
          className="admin-hero-video"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/triumph.mp4" type="video/mp4" />
        </video>
        <div className="admin-vignette" />
        <div className="admin-bg-grid" />
        <div className="admin-wrapper">
          <div className="admin-headline">
            <p className="eyebrow">Admin Mission Control</p>
            <h1>Login</h1>
            <p className="lede">Authenticate to access the dashboard.</p>
          </div>
          <div className="admin-grid">
            <section className="admin-card">
              <div className="card-head">
                <div>
                  <p className="eyebrow">Access Gate</p>
                  <h2>Admin Login</h2>
                </div>
                <span className="pill">Locked</span>
              </div>
              <form className="form-stack" onSubmit={login}>
                <label className="label" htmlFor="admin-pass">Admin Password</label>
                <input
                  id="admin-pass"
                  type="password"
                  className="input-field"
                  placeholder="Enter passphrase"
                  value={password}
                  onChange={(e) => setPassword(e.currentTarget.value)}
                  disabled={loading}
                />
                <div className="actions">
                  <button type="submit" className="btn-strong" disabled={loading}>
                    {loading ? "Logging in…" : "Login"}
                  </button>
                </div>
              </form>
              {error && <div className="alert">{error}</div>}
            </section>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <video
        className="admin-hero-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/triumph.mp4" type="video/mp4" />
      </video>
      <div className="admin-vignette" />
      <div className="admin-bg-grid" />
      <div className="admin-wrapper">
        <div className="admin-headline">
          <p className="eyebrow">Admin Mission Control</p>
          <h1>Dashboard</h1>
          <p className="lede">
            Observe the live room and terminate it at will. Status checks ping the API at <code>/api/room/status</code>;
            closures post to <code>/api/room/close</code>.
          </p>
        </div>

        <div className="admin-grid">
          <section className="admin-card">
            <div className="card-head">
              <div>
                <p className="eyebrow">Room Status</p>
                <h2>Live Feed</h2>
              </div>
              <div className="status-actions">
                <span className={`pill ${statusBadge}`}>{statusText}</span>
                <button className="pill pill-ok" onClick={logout}>Log out</button>
              </div>
            </div>

            <div className="status-grid">
              <div className="status-block">
                <p className="label">Invite Link</p>
                <p className="mono">{status?.inviteLink || "—"}</p>
              </div>
              <div className="status-block">
                <p className="label">Headcount</p>
                <p className="metric">{status?.headcount ?? 0}</p>
              </div>
              <div className="status-block">
                <p className="label">Limit</p>
                <p className="metric">{status?.limit ?? "—"}</p>
              </div>
              <div className="status-block">
                <p className="label">Last Checked</p>
                <p className="mono">{lastChecked ? lastChecked.toLocaleTimeString() : "—"}</p>
              </div>
            </div>

            <div className="actions">
              <button className="btn-neutral" type="button" onClick={refreshStatus}>
                Refresh Status
              </button>
              <button className="btn-danger" type="button" onClick={closeRoom} disabled={!token || closing}>
                {closing ? "Closing…" : "Close Room"}
              </button>
            </div>

            <p className="footnote">
              Closing requires a valid admin JWT; the server will reject unsigned requests.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
