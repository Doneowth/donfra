"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import "./live.css";

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

  // Stealth mode
  const [canStealth, setCanStealth] = useState(false);
  const [isHidden, setIsHidden] = useState(false);

  // Check if user has stealth permission
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(res => res.json())
      .then(data => {
        if (data.user?.canStealth) {
          setCanStealth(true);
        }
      })
      .catch(() => {});
  }, []);

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
      const response = await api.live.join(formData.sessionId, formData.userName, isHost, isHidden);

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
    <div className="app-root live-page">
      <div className="hero-alt live-hero">
        <video className="hero-video" autoPlay loop muted playsInline>
          <source src="/1200rr.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay-grid" />
        <div className="hero-vignette" />

        <div className="live-panel">
          <h1 className="display h2 live-title">
            Live Stream
          </h1>

          <div className="live-tabs">
            <button
              onClick={() => setMode("create")}
              className={`live-tab ${mode === "create" ? "active" : ""}`}
            >
              Create Session
            </button>
            <button
              onClick={() => setMode("join")}
              className={`live-tab ${mode === "join" ? "active" : ""}`}
            >
              Join Session
            </button>
          </div>

          {error && (
            <div className="live-error">
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
              className="btn-elegant btn-full"
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

            {canStealth && (
              <div className="form-group">
                <label className="form-checkbox">
                  <input
                    type="checkbox"
                    checked={isHidden}
                    onChange={(e) => setIsHidden(e.target.checked)}
                  />
                  <span className="checkbox-label">👻 Stealth Mode (others won't see you)</span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-elegant btn-full"
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
