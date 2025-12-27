"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";

const LiveRoom = dynamic(() => import("@/components/LiveRoom"), {
  ssr: false,
});

function LivePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get("session_id");
  const roleFromUrl = searchParams.get("role");

  const [view, setView] = useState<"form" | "room">("form");
  const [mode, setMode] = useState<"create" | "join">("create");
  const [formData, setFormData] = useState({
    title: "",
    ownerName: "",
    userName: "",
    sessionId: sessionIdFromUrl || "",
  });
  const [roomData, setRoomData] = useState<{
    sessionId: string;
    token: string;
    serverUrl: string;
    userName: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (sessionIdFromUrl) {
      setMode("join");
      setFormData((prev) => ({ ...prev, sessionId: sessionIdFromUrl }));
    }
  }, [sessionIdFromUrl]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await api.live.create(formData.title, formData.ownerName);

      setRoomData({
        sessionId: response.session_id,
        token: response.host_token,
        serverUrl: response.server_url,
        userName: formData.ownerName,
      });
      setView("room");

      // Update URL with session ID
      const url = new URL(window.location.href);
      url.searchParams.set("session_id", response.session_id);
      url.searchParams.set("role", "host");
      window.history.pushState({}, "", url.toString());
    } catch (err: any) {
      setError(err.message || "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isHost = roleFromUrl === "host";
      const response = await api.live.join(formData.sessionId, formData.userName, isHost);

      setRoomData({
        sessionId: response.session_id,
        token: response.access_token,
        serverUrl: response.server_url,
        userName: formData.userName,
      });
      setView("room");
    } catch (err: any) {
      setError(err.message || "Failed to join session");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    setView("form");
    setRoomData(null);
    router.push("/live");
  };

  if (view === "room" && roomData) {
    return (
      <LiveRoom
        sessionId={roomData.sessionId}
        token={roomData.token}
        serverUrl={roomData.serverUrl}
        userName={roomData.userName}
        onDisconnected={handleDisconnect}
      />
    );
  }

  return (
    <div className="app-root" style={{ minHeight: "100vh" }}>
      {/* Hero Background */}
      <div className="hero-alt" style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        position: "relative",
      }}>
        <video
          className="hero-video"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/1200rr.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay-grid" />
        <div className="hero-vignette" />

        <div style={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: "8px",
          padding: "40px",
          maxWidth: "480px",
          width: "100%",
          position: "relative",
          zIndex: 1,
        }}>
          <h1 className="display h2" style={{
            textAlign: "center",
            marginBottom: "32px",
            color: "var(--brass)",
          }}>
            Live Stream
          </h1>

        <div style={{
          display: "flex",
          gap: "10px",
          marginBottom: "24px",
          borderBottom: "1px solid var(--line)",
        }}>
          <button
            onClick={() => setMode("create")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontSize: "14px",
              borderBottom: mode === "create" ? "2px solid var(--brass)" : "2px solid transparent",
              color: mode === "create" ? "var(--brass)" : "var(--ink-soft)",
              transition: "all 0.2s ease",
            }}
          >
            Create Session
          </button>
          <button
            onClick={() => setMode("join")}
            style={{
              flex: 1,
              padding: "12px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "Rajdhani, sans-serif",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              fontSize: "14px",
              borderBottom: mode === "join" ? "2px solid var(--brass)" : "2px solid transparent",
              color: mode === "join" ? "var(--brass)" : "var(--ink-soft)",
              transition: "all 0.2s ease",
            }}
          >
            Join Session
          </button>
        </div>

        {error && (
          <div style={{
            background: "rgba(220, 38, 38, 0.1)",
            border: "1px solid rgba(220, 38, 38, 0.3)",
            color: "#ef4444",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            fontSize: "13px",
            fontFamily: "IBM Plex Mono, monospace",
          }}>
            {error}
          </div>
        )}

        {mode === "create" ? (
          <form onSubmit={handleCreateSession}>
            <div className="form-group">
              <label className="form-label">
                Session Title
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter session title"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Your Name
              </label>
              <input
                type="text"
                required
                value={formData.ownerName}
                onChange={(e) => setFormData({ ...formData, ownerName: e.target.value })}
                placeholder="Enter your name"
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-elegant"
              style={{
                width: "100%",
                marginTop: "8px",
                justifyContent: "center",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Creating..." : "Create & Start Streaming"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleJoinSession}>
            <div className="form-group">
              <label className="form-label">
                Session ID
              </label>
              <input
                type="text"
                required
                value={formData.sessionId}
                onChange={(e) => setFormData({ ...formData, sessionId: e.target.value })}
                placeholder="Enter session ID"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                Your Name
              </label>
              <input
                type="text"
                required
                value={formData.userName}
                onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                placeholder="Enter your name"
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-elegant"
              style={{
                width: "100%",
                marginTop: "8px",
                justifyContent: "center",
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Joining..." : "Join Session"}
            </button>
          </form>
        )}
      </div>
    </div>
    </div>
  );
}

export default function LivePage() {
  return (
    <Suspense fallback={<div style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
      fontSize: "18px"
    }}>Loading...</div>}>
      <LivePageContent />
    </Suspense>
  );
}
