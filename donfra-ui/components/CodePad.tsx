"use client";

import "./CodePad.css";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { api } from "@/lib/api";
import type { editor as MonacoEditor } from "monaco-editor";



// 动态加载 Monaco（禁 SSR）
const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false }) as any;

// 运行时再填充（仅在浏览器端）
let YNS: typeof import("yjs") | null = null;
let YWebsocketNS: typeof import("y-websocket") | null = null;
let YMonacoNS: typeof import("y-monaco") | null = null;

type Props = { onExit?: () => void; roomId?: string };
type Peer = { name: string; color: string; colorLight?: string };

export default function CodePad({ onExit, roomId }: Props) {
  // 运行区（由共享 Y.Map 驱动）
  const [stdout, setStdout] = useState("");
  const [stderr, setStderr] = useState("");
  const [running, setRunning] = useState(false);
  const [runBy, setRunBy] = useState<string>("");
  const [runAt, setRunAt] = useState<number | null>(null);

  // 在线协作者列表
  const [peers, setPeers] = useState<Peer[]>([]);

  // 本地 userName（用于标注 runner）
  const userNameRef = useRef<string>("");

  // Monaco + Yjs refs
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const bindingRef = useRef<any>(null);
  const providerRef = useRef<any>(null);
  const ydocRef = useRef<any>(null);

  // 共享输出 Map
  const yOutputsRef = useRef<any>(null);
  const outputsObserverRef = useRef<((e: any) => void) | null>(null);

  // 清理函数容器（awareness 监听 / MutationObserver / 样式）
  const cleanupFnsRef = useRef<(() => void)[]>([]);

  const editorOptions = useMemo(
    () => ({
      language: "python",
      minimap: { enabled: false },
      automaticLayout: true,
      fontSize: 14,
      lineNumbers: "on" as const,
      wordWrap: "on" as const,
      tabSize: 4,
      renderWhitespace: "selection" as const,
      scrollBeyondLastLine: false,
      cursorBlinking: "smooth" as const,
    }),
    []
  );

  // 从共享 Map 同步到本地 UI
  const applyOutputsFromY = useCallback(() => {
    const yMap = yOutputsRef.current;
    if (!yMap) return;
    setStdout(String(yMap.get("stdout") || ""));
    setStderr(String(yMap.get("stderr") || ""));
    setRunBy(String(yMap.get("runner") || ""));
    const ts = yMap.get("ts");
    setRunAt(typeof ts === "number" ? ts : null);
  }, []);

  // Run：执行 + 写入共享 Map
  const run = useCallback(async () => {
    const src = editorRef.current?.getValue() ?? "";
    if (!src.trim()) return;
    setRunning(true);
    try {
      const res = await api.run.python(src);
      // 本地即时
      setStdout(res.stdout || "");
      setStderr(res.stderr || "");
      setRunBy(userNameRef.current || "Someone");
      setRunAt(Date.now());
      // 共享
      const doc = ydocRef.current as import("yjs").Doc | null;
      const yMap = yOutputsRef.current;
      if (doc && yMap) {
        doc.transact(() => {
          yMap.set("stdout", res.stdout || "");
          yMap.set("stderr", res.stderr || "");
          yMap.set("runner", userNameRef.current || "Someone");
          yMap.set("ts", Date.now());
        });
      }
    } catch (e: any) {
      const msg = e?.message || "Run failed";
      setStderr(msg);
      const doc = ydocRef.current as import("yjs").Doc | null;
      const yMap = yOutputsRef.current;
      if (doc && yMap) {
        doc.transact(() => {
          yMap.set("stdout", "");
          yMap.set("stderr", msg);
          yMap.set("runner", userNameRef.current || "Someone");
          yMap.set("ts", Date.now());
        });
      }
    } finally {
      setRunning(false);
    }
  }, []);

  // Clear：清空共享 Map
  const clearOutput = useCallback(() => {
    setStdout("");
    setStderr("");
    setRunBy(userNameRef.current || "Someone");
    setRunAt(Date.now());
    const doc = ydocRef.current as import("yjs").Doc | null;
    const yMap = yOutputsRef.current;
    if (doc && yMap) {
      doc.transact(() => {
        yMap.set("stdout", "");
        yMap.set("stderr", "");
        yMap.set("runner", userNameRef.current || "Someone");
        yMap.set("ts", Date.now());
      });
    }
  }, []);

  const exit = async () => {
    // 断开本地协作连接，释放资源
    try { providerRef.current?.destroy?.(); } catch {}
    try { bindingRef.current?.destroy?.(); } catch {}
    try { ydocRef.current?.destroy?.(); } catch {}

    // 回到上层 / 关闭页面（保持你现有逻辑）
    onExit?.();
  };

  // Monaco onMount：绑定 Yjs + Awareness
  const onMount = useCallback(async (editor: MonacoEditor.IStandaloneCodeEditor, monacoNS: any) => {
    editorRef.current = editor;

    // 快捷键
    editor.addCommand(monacoNS.KeyMod.CtrlCmd | monacoNS.KeyCode.Enter, () => run());
    editor.addCommand(monacoNS.KeyMod.CtrlCmd | monacoNS.KeyCode.KeyL, () => clearOutput());

    if (typeof window === "undefined") return;

    // 动态导入命名空间
    if (!YNS || !YWebsocketNS || !YMonacoNS) {
      const [yjsNS, ywsNS, ymonoNS] = await Promise.all([
        import("yjs"),
        import("y-websocket"),
        import("y-monaco"),
      ]);
      YNS = yjsNS;
      YWebsocketNS = ywsNS;
      YMonacoNS = ymonoNS;
    }

    // 协作地址/房间
    const params = new URLSearchParams(window.location.search);
    // Use roomId prop if provided (for interview rooms), otherwise use room_id from URL params
    // This ensures all users in the same room connect to the same Yjs document
    const roomName = roomId || params.get("room_id") || "default-room";
    // Ensure collabURL is a string: prefer env var, otherwise derive a sensible fallback from current origin
    const collabURL = process.env.NEXT_PUBLIC_COLLAB_WS ?? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/yjs`;

    console.log('[CodePad] Room configuration:', { roomName, roomId, urlRoomId: params.get("room_id") });

    // 创建 Doc / Provider
    // The WebsocketProvider sends the roomName in the URL path (e.g., ws://host/yjs/room-id)
    // The WebSocket server extracts it from the path and creates isolated Yjs documents per room
    const doc = new YNS!.Doc();
    const ytext = doc.getText("monaco");
    const provider = new YWebsocketNS!.WebsocketProvider(collabURL, roomName, doc, { connect: true });
    const awareness = provider.awareness;

    // Get real username from backend (if user is authenticated)
    let userName = `User-${Math.random().toString(36).slice(2, 6)}`;
    try {
      const response = await fetch("/api/auth/me", {
        method: "GET",
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        if (data.user && data.user.username) {
          userName = data.user.username;
        }
      }
    } catch (err) {
      // If not authenticated or error, use guest username
      console.log("Not authenticated or error fetching user info, using guest username");
    }
    userNameRef.current = userName;

    // Generate distinct color for this user using a predefined palette
    // This ensures colors are visually distinct and easy to differentiate
    const colorPalette = [
      { color: "#e74c3c", colorLight: "rgba(231, 76, 60, 0.25)" },   // Red
      { color: "#3498db", colorLight: "rgba(52, 152, 219, 0.25)" },  // Blue
      { color: "#2ecc71", colorLight: "rgba(46, 204, 113, 0.25)" },  // Green
      { color: "#f39c12", colorLight: "rgba(243, 156, 18, 0.25)" },  // Orange
      { color: "#9b59b6", colorLight: "rgba(155, 89, 182, 0.25)" },  // Purple
      { color: "#1abc9c", colorLight: "rgba(26, 188, 156, 0.25)" },  // Turquoise
      { color: "#e91e63", colorLight: "rgba(233, 30, 99, 0.25)" },   // Pink
      { color: "#00bcd4", colorLight: "rgba(0, 188, 212, 0.25)" },   // Cyan
      { color: "#ff5722", colorLight: "rgba(255, 87, 34, 0.25)" },   // Deep Orange
      { color: "#8bc34a", colorLight: "rgba(139, 195, 74, 0.25)" },  // Light Green
    ];
    const colorIndex = Math.floor(Math.random() * colorPalette.length);
    const { color, colorLight } = colorPalette[colorIndex];

    awareness.setLocalState({ user: { name: userName, color, colorLight } });

    console.log('[CodePad] Local awareness state set:', { userName, color, colorLight });
    console.log('[CodePad] Provider status:', provider.wsconnected ? 'connected' : 'disconnected');

    // Monitor WebSocket connection status
    provider.on('status', (event: any) => {
      console.log('[CodePad] WebSocket status changed:', event.status);
    });

    provider.on('sync', (isSynced: boolean) => {
      console.log('[CodePad] Sync status:', isSynced ? 'synced' : 'syncing');
    });

    // 在线同伴列表
    const applyPeers = () => {
      const states = Array.from(awareness.getStates().values())
        .map((s: any) => s?.user)
        .filter(Boolean) as Peer[];
      setPeers(states);
      console.log('[CodePad] Awareness states updated. Total peers:', states.length, states);
    };
    awareness.on("change", applyPeers);
    applyPeers();
    cleanupFnsRef.current.push(() => awareness.off("change", applyPeers));

    // 绑定 Monaco（把 awareness 传入，让 y-monaco 渲染光标/选区/标签）
    const model = editor.getModel();

    if (!model) return;

    // IMPORTANT: Pass awareness to MonacoBinding to enable remote cursor/selection rendering
    // The binding will automatically create decorations for remote users
    const binding = new YMonacoNS!.MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      awareness
    );

    console.log('[CodePad] MonacoBinding created with awareness. Current awareness states:', awareness.getStates().size);

    // === (A) 为每位协作者注入“按 clientId 的颜色样式”（兼容类后缀 & data-clientid） ===
    const styleElId = `y-remote-style-${roomName}`;
    let styleEl = document.getElementById(styleElId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleElId;
      document.head.appendChild(styleEl);
    }
    const toLight = (c: string) => {
      if (!c) return "rgba(0,0,0,.18)";
      if (c.startsWith("hsl")) return c.replace(")", " / .22)");
      if (c.startsWith("#") && c.length === 7) return `${c}38`; // 22% 透明
      if (c.startsWith("#") && c.length === 9) return c;
      return "rgba(0,0,0,.18)";
    };
    const selFor = (clientId: number) => {
      const root = `.editor-pane .monaco-editor`;
      return {
        head: `${root} .yRemoteSelectionHead-${clientId}`,
        body: `${root} .yRemoteSelection-${clientId}`,
        headLabel: `${root} .yRemoteSelectionHead-${clientId} .yRemoteSelectionHeadLabel`,
      };
    };
    const applyClientStyles = () => {
      const states = awareness.getStates() as Map<number, any>;
      const rules: string[] = [];
      states.forEach((s, clientId) => {
        const base = s?.user?.color || `hsl(${clientId % 360} 70% 55%)`;
        const light = s?.user?.colorLight || toLight(base);
        const S = selFor(clientId);
        rules.push(`
          ${S.head} {
            border-left-color: ${base} !important;
            border-left-width: 3px !important;
            border-left-style: solid !important;
            z-index: 12 !important;
            position: relative !important;
            animation: cursor-blink-${clientId} 1s ease-in-out infinite !important;
          }
          ${S.body} {
            background: ${light} !important;
            mix-blend-mode: normal !important;
            z-index: 11 !important;
            position: relative !important;
            pointer-events: none !important;
            border: 1px solid ${base}40 !important;
          }
          ${S.headLabel} {
            background-color: ${base} !important;
            color: #fff !important;
            font-size: 12px !important;
            font-weight: 600 !important;
            line-height: 1.5 !important;
            padding: 2px 8px !important;
            border-radius: 4px !important;
            box-shadow: 0 2px 4px rgba(0,0,0,.3) !important;
            z-index: 13 !important;
            position: relative !important;
          }
          @keyframes cursor-blink-${clientId} {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0.6; }
          }
        `);
      });

      styleEl!.textContent = rules.join("\n");
    };
    applyClientStyles();
    const onAwarenessColorChange = () => applyClientStyles();
    awareness.on("change", onAwarenessColorChange);
    cleanupFnsRef.current.push(() => awareness.off("change", onAwarenessColorChange));

    // === (B) 强制把“名字”写入每个远端光标的标签（不同版本有时不自动渲染） ===
    const parseClientId = (el: Element | null): number | null => {
      if (!el) return null;
      const idAttr = (el as HTMLElement).dataset?.clientid;
      if (idAttr && /^\d+$/.test(idAttr)) return Number(idAttr);
      const m = el.className.match(/(?:^|\s)yRemoteSelectionHead-(\d+)(?:\s|$)/);
      return m ? Number(m[1]) : null;
    };
    const updateCursorLabels = () => {
      const dom = editor.getDomNode();
      if (!dom) return;
      const states = awareness.getStates() as Map<number, any>;
      const labels = dom.querySelectorAll(".yRemoteSelectionHeadLabel");
      labels.forEach((labelEl) => {
        const head = (labelEl as HTMLElement).closest(".yRemoteSelectionHead") as HTMLElement | null;
        const cid = parseClientId(head);
        if (cid == null) return;
        const u = states.get(cid)?.user;
        const name = u?.name || `User-${cid}`;
        if ((labelEl as HTMLElement).textContent !== name) {
          (labelEl as HTMLElement).textContent = name;
        }
      });
    };
    updateCursorLabels();
    const domNode = editor.getDomNode();
    let mo: MutationObserver | null = null;
    if (domNode) {
      mo = new MutationObserver(() => updateCursorLabels());
      mo.observe(domNode, { childList: true, subtree: true });
    }
    const onAwarenessNameChange = () => updateCursorLabels();
    awareness.on("change", onAwarenessNameChange);
    cleanupFnsRef.current.push(() => awareness.off("change", onAwarenessNameChange));
    cleanupFnsRef.current.push(() => { try { mo?.disconnect(); } catch {} });

    // 共享输出 Map
    const yOutputs = doc.getMap<any>("outputs");
    yOutputsRef.current = yOutputs;

    // 初始同化一次（拿远端现状）
    applyOutputsFromY();

    // 监听输出变更
    const observer = () => applyOutputsFromY();
    outputsObserverRef.current = observer;
    yOutputs.observe(observer);

    // 保存引用
    ydocRef.current = doc;
    providerRef.current = provider;
    bindingRef.current = binding;
  }, [run, clearOutput, applyOutputsFromY, roomId]);

  // 卸载清理
  useEffect(() => {
    return () => {
      try { cleanupFnsRef.current.forEach((fn) => { try { fn(); } catch {} }); } catch {}
      try {
        if (yOutputsRef.current && outputsObserverRef.current) {
          yOutputsRef.current.unobserve(outputsObserverRef.current);
        }
      } catch {}
      try { bindingRef.current?.destroy?.(); } catch {}
      try { providerRef.current?.destroy?.(); } catch {}
      try { ydocRef.current?.destroy(); } catch {}
    };
  }, []);

  const runMeta =
    runAt != null ? `Last run by ${runBy || "Someone"} at ${new Date(runAt).toLocaleString()}` : "";

  return (
    <div className="codepad-root">
      {/* 工具栏 */}
      <div className="codepad-toolbar">
        <div className="left">
          <span className="brand">DONFRA</span>
          <span className="brand-sub">CodePad</span>
        </div>
        <div className="right">
          {/* 在线协作者 */}
          <div className="peers">
            {peers.map((p, i) => (
              <span key={i} className="peer">
                <i className="dot" style={{ background: p.color }} />
                {p.name}
              </span>
            ))}
          </div>
          <button className="btn ghost" onClick={clearOutput} title="Clear output (Ctrl/Cmd+L)">
            Clear
          </button>
          <button className="btn run" onClick={run} disabled={running} title="Run (Ctrl/Cmd+Enter)">
            {running ? "Running…" : "Run"}
          </button>
          <button className="btn danger" onClick={exit}>Quit</button>
        </div>
      </div>

      {/* 主区域：2:1 */}
      <div className="codepad-main">
        <div className="editor-pane" aria-label="code editor">
          <Editor
            height="100%"
            defaultLanguage="python"
            theme="vs-dark"
            defaultValue={"print('hello from CodePad')\n"}
            onMount={onMount}
            options={editorOptions}
          />
        </div>

        <div className="terminal-pane" aria-label="terminal output">
          <div className="terminal-header">
            <span>Terminal</span>
            {runMeta && <span style={{ opacity: .7, marginLeft: 8, fontSize: 12 }}>{runMeta}</span>}
          </div>
          <div className="terminal-body">
            {stdout && (
              <>
                <div className="stream-title ok">$ stdout</div>
                <pre className="stream">{stdout}</pre>
              </>
            )}
            {stderr && (
              <>
                <div className="stream-title warn">$ stderr</div>
                <pre className="stream error">{stderr}</pre>
              </>
            )}
            {!stdout && !stderr && <div className="empty">no output</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
