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

    console.log('[CodePad] Room configuration:', {
      roomName,
      roomId,
      urlRoomId: params.get("room_id"),
      fullURL: window.location.href,
      collabURL
    });

    // 创建 Doc / Provider
    // The WebsocketProvider sends the roomName in the URL path (e.g., ws://host/yjs/room-id)
    // The WebSocket server extracts it from the path and creates isolated Yjs documents per room
    const doc = new YNS!.Doc();
    const ytext = doc.getText("monaco");
    const provider = new YWebsocketNS!.WebsocketProvider(collabURL, roomName, doc, { connect: true });

    console.log('[CodePad] WebSocket provider created, connecting to:', `${collabURL}/${roomName}`);
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
      if (event.status === 'disconnected') {
        console.warn('[CodePad] ⚠️ WebSocket disconnected! Will attempt to reconnect...');
      } else if (event.status === 'connected') {
        console.log('[CodePad] ✅ WebSocket connected successfully');
      }
    });

    // Track if we've done initial sync
    let hasInitialSynced = false;

    provider.on('sync', (isSynced: boolean) => {
      console.log('[CodePad] Sync status:', isSynced ? '✅ synced' : '⏳ syncing...', {
        isSynced,
        wsConnected: provider.wsconnected,
        docClientId: doc.clientID,
        ytextLength: ytext.toString().length,
        ytextContent: ytext.toString()
      });

      // Only initialize default content after first sync completes
      if (isSynced && !hasInitialSynced) {
        hasInitialSynced = true;
        if (ytext.length === 0) {
          ytext.insert(0, "print('hello from CodePad')\n");
          console.log('[CodePad] Initialized empty Yjs document with default content after sync');
        }
      }
    });

    // Monitor doc updates (low-level Yjs updates)
    doc.on('update', (update: Uint8Array, origin: any) => {
      console.log('[CodePad] 🔄 Doc update received:', {
        updateSize: update.length,
        origin: origin?.constructor?.name || 'unknown',
        isLocal: origin === doc,
        ytextContent: ytext.toString()
      });
    });

    // Monitor connection errors
    provider.on('connection-error', (event: any) => {
      console.error('[CodePad] ❌ WebSocket connection error:', event);
    });

    provider.on('connection-close', (event: any) => {
      console.warn('[CodePad] 🔌 WebSocket connection closed:', event);
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
    // Note: Default content initialization moved to 'sync' event handler to avoid race conditions
    const binding = new YMonacoNS!.MonacoBinding(
      ytext,
      model,
      new Set([editor]),
      awareness
    );

    console.log('[CodePad] MonacoBinding created with awareness. Current awareness states:', awareness.getStates().size);

    // === DEBUG: Monitor Yjs text changes ===
    ytext.observe((event: any) => {
      console.log('[CodePad] 📝 Yjs text changed:', {
        delta: event.delta,
        currentYjsText: ytext.toString(),
        currentMonacoText: editor.getValue(),
        match: ytext.toString() === editor.getValue()
      });
    });

    // === DEBUG: Monitor Monaco model changes ===
    model.onDidChangeContent((e: any) => {
      console.log('[CodePad] 🖊️  Monaco content changed:', {
        changes: e.changes,
        currentMonacoText: editor.getValue(),
        currentYjsText: ytext.toString(),
        match: ytext.toString() === editor.getValue()
      });
    });

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

    // === DEBUG: Expose debug utilities to window for manual inspection ===
    if (typeof window !== 'undefined') {
      (window as any).yjsDebug = {
        checkSync: () => {
          const monacoText = editor.getValue();
          const yjsText = ytext.toString();
          const match = monacoText === yjsText;
          console.log('=== Yjs <-> Monaco Sync Check ===');
          console.log('Monaco text length:', monacoText.length);
          console.log('Yjs text length:', yjsText.length);
          console.log('Content match:', match);
          console.log('WebSocket connected:', provider.wsconnected);
          console.log('Doc clientID:', doc.clientID);
          console.log('Awareness states:', Array.from(awareness.getStates().entries()));
          if (!match) {
            console.log('--- Monaco content ---');
            console.log(monacoText);
            console.log('--- Yjs content ---');
            console.log(yjsText);
          }
          return { match, monacoText, yjsText, wsConnected: provider.wsconnected };
        },
        getYjsText: () => ytext.toString(),
        getMonacoText: () => editor.getValue(),
        getProvider: () => provider,
        getDoc: () => doc,
        getAwareness: () => awareness,
        forceSync: () => {
          console.log('Forcing Monaco -> Yjs sync...');
          const currentText = editor.getValue();
          doc.transact(() => {
            ytext.delete(0, ytext.length);
            ytext.insert(0, currentText);
          });
          console.log('Sync forced. Check with yjsDebug.checkSync()');
        }
      };
      console.log('[CodePad] 🐛 Debug utilities exposed to window.yjsDebug');
      console.log('Available commands:');
      console.log('  - window.yjsDebug.checkSync()     // Check if Yjs and Monaco are in sync');
      console.log('  - window.yjsDebug.getYjsText()    // Get Yjs text content');
      console.log('  - window.yjsDebug.getMonacoText() // Get Monaco text content');
      console.log('  - window.yjsDebug.forceSync()     // Force Monaco content into Yjs');
    }
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
