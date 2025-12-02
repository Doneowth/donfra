"use client";

import "@/styles/codepad.css";   // ← standalone CSS
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import CodePad from "@/components/CodePad";

type Phase = "loading" | "lobby" | "pad";

export default function CodingPage() {
  // 改：不用 useSearchParams，避免静态导出报错
  const [inviteToken, setInviteToken] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("loading");
  const [initPass, setInitPass] = useState("");
  const [roomSize, setRoomSize] = useState<string>("2");
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [joinToken, setJoinToken] = useState<string>("");
  const [roomOpen, setRoomOpen] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string>("");

  // 仅浏览器：从 URL 解析 invite
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    setInviteToken(p.get("invite") || "");
  }, []);

  // 检查房间开放状态，决定展示初始化还是加入
  useEffect(() => {
    let cancelled = false;
    const loadStatus = async () => {
      try {
        const res = await api.room.status();
        if (!cancelled) {
          setRoomOpen(res.open);
          setPhase("lobby");
        }
      } catch (e: any) {
        if (!cancelled) {
          setRoomOpen(null);
          setPhase("lobby");
          setHint(e?.message || "Unable to read room status.");
          setTimeout(() => setHint(""), 1500);
        }
      }
    };
    loadStatus();
    return () => { cancelled = true; };
  }, []);

  // 有 invite 参数时直接尝试加入
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        if (inviteToken) {
          setBusy(true);
          await api.room.join(inviteToken);
          if (!cancelled) {
            persistToken(inviteToken);
            setPhase("pad"); setBusy(false); return;
          }
        }
        if (!cancelled) setPhase((prev) => (prev === "loading" ? "lobby" : prev));
      } catch (e: any) {
        if (!cancelled) {
          setHint(e?.message || "Join failed.");
          setTimeout(() => setHint(""), 1500);
          setPhase("lobby");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    boot();
    return () => { cancelled = true; };
  }, [inviteToken]);

  const persistToken = (token: string) => {
    if (typeof window === "undefined") return;
    try { localStorage.setItem("invite_token", token); } catch { /* ignore */ }
  };

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(new URL(inviteUrl, window.location.origin).toString());
    setHint("Invite link copied to clipboard."); setTimeout(() => setHint(""), 1500);
  };

  const initRoom = async () => {
    if (!initPass.trim()) { setHint("Passphrase required."); setTimeout(() => setHint(""), 1200); return; }
    const size = parseInt(roomSize, 10);
    if (!Number.isFinite(size) || size <= 0) { setHint("Room size must be at least 1."); setTimeout(() => setHint(""), 1400); return; }
    try {
      setBusy(true); setHint("");
      const res = await api.room.init(initPass.trim(), size);
      setRoomOpen(true);
      setInviteUrl(res.inviteUrl);
      if (res.token) {
        setJoinToken(res.token);
        persistToken(res.token);
      }
    } catch (e: any) {
      setHint(e?.message || "Initialization failed."); setTimeout(() => setHint(""), 1500);
    } finally { setBusy(false); }
  };

  const joinByToken = async (token?: string) => {
    const t = (token ?? joinToken).trim();
    if (!t) { setHint("Invite token required."); setTimeout(() => setHint(""), 1200); return; }
    try {
      setBusy(true); setHint("");
      await api.room.join(t);
      persistToken(t);
      setPhase("pad");
    } catch (e: any) {
      setHint(e?.message || "Join failed."); setTimeout(() => setHint(""), 1500);
    } finally { setBusy(false); }
  };

  const onExit = () => {
    document.cookie = `room_access=; Path=/; Max-Age=0; SameSite=Lax`;
    window.location.href = "/";
  };

  if (phase === "pad") {
    return (
      <div className="coding-page">
        <CodePad onExit={onExit} />
      </div>
    );
  }

  if (phase === "loading") {
    return (
      <div className="coding-page">
        <div className="lobby-root">
          <div className="lobby-card">Booting secure console…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="coding-page">
      <div className="lobby-root">
        <div className="lobby-card">
          <div className="lobby-head">
            <span className="brand">DONFRA</span>
            <span className="brand-sub">CodePad — Operations Lobby</span>
          </div>

          <div className="lobby-section">
            {roomOpen === false && (
              <>
                <div className="section-title">Handler Briefing (Passphrase Required)</div>
                <div className="row gap-12">
                  <input
                    className="input"
                    type="password"
                    placeholder="Enter passphrase"
                    value={initPass}
                    onChange={(e) => setInitPass(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && initRoom()}
                    disabled={busy}
                  />
                  <input
                    className="input"
                    type="number"
                    min={1}
                    placeholder="Room size"
                    value={roomSize}
                    onChange={(e) => setRoomSize(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && initRoom()}
                    disabled={busy}
                  />
                  <button className="btn-elegant" onClick={initRoom} aria-disabled={busy}>
                    {busy ? "Arming the room…" : "Agent Room"}
                  </button>
                </div>

                {inviteUrl && (
                  <>
                    <div className="share-line">
                      Invitation link generated:
                      <span className="share-url">
                        {typeof window !== "undefined"
                          ? new URL(inviteUrl, window.location.origin).toString()
                          : inviteUrl}
                      </span>
                    </div>
                    <div className="lobby-foot">
                      <button className="btn-ghost" onClick={copyInvite}>Copy invitation link</button>
                    </div>
                  </>
                )}
              </>
            )}

            {roomOpen !== false && (
              <>
                <div className="section-title">Join with Invite Token</div>
                <div className="row gap-12">
                  <input
                    className="input"
                    type="text"
                    placeholder="Enter invite token"
                    value={joinToken}
                    onChange={(e) => setJoinToken(e.currentTarget.value)}
                    onKeyDown={(e) => e.key === "Enter" && joinByToken()}
                    disabled={busy}
                  />
                  <button className="btn-elegant" onClick={() => joinByToken()} aria-disabled={busy}>
                    {busy ? "Joining…" : "Join with token"}
                  </button>
                </div>
              </>
            )}
          </div>

          {hint && <div className="hint">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
