"use client";

import "@/styles/codepad.css";   // ← standalone CSS
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import CodePad from "@/components/CodePad";

type Phase = "loading" | "lobby" | "pad";

function getCookie(name: string) {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : "";
}

export default function CodingPage() {
  // 改：不用 useSearchParams，避免静态导出报错
  const [inviteToken, setInviteToken] = useState<string>("");

  const [phase, setPhase] = useState<Phase>("loading");
  const [initPass, setInitPass] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string>("");

  // 仅浏览器：从 URL 解析 invite
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    setInviteToken(p.get("invite") || "");
  }, []);

  // boot 流程：有 invite 就 join；否则根据 cookie/status 判定 lobby/pad
  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        if (inviteToken) {
          setBusy(true);
          await api.room.join(inviteToken);
          if (!cancelled) { setPhase("pad"); setBusy(false); return; }
        }
        const cookie = getCookie("room_access");
        const st = await api.room.status();
        if (!cancelled) setPhase(cookie === "1" || st.open ? "pad" : "lobby");
      } catch {
        if (!cancelled) setPhase("lobby");
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    boot();
    return () => { cancelled = true; };
  }, [inviteToken]);

  const copyInvite = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(new URL(inviteUrl, window.location.origin).toString());
    setHint("Invite link copied to clipboard."); setTimeout(() => setHint(""), 1500);
  };

  const initRoom = async () => {
    if (!initPass.trim()) { setHint("Passphrase required."); setTimeout(() => setHint(""), 1200); return; }
    try {
      setBusy(true); setHint("");
      const res = await api.room.init(initPass.trim());
      setInviteUrl(res.inviteUrl);
    } catch (e: any) {
      setHint(e?.message || "Initialization failed."); setTimeout(() => setHint(""), 1500);
    } finally { setBusy(false); }
  };

  const onExit = () => {
    document.cookie = `room_access=; Path=/; Max-Age=0; SameSite=Lax`;
    setPhase("lobby"); setInviteUrl(""); setInitPass("");
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
          </div>

          {hint && <div className="hint">{hint}</div>}
        </div>
      </div>
    </div>
  );
}
