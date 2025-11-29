"use client";

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

type Props = { onExit?: () => void };
type Peer = { name: string; color: string; colorLight?: string };

export default function CodePad({ onExit }: Props) {
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
    try { await api.room.close();} catch {} // 忽略错误
    // 3) 断开本地协作连接，释放资源
    try { providerRef.current?.destroy?.(); } catch {}
    try { bindingRef.current?.destroy?.(); } catch {}
    try { ydocRef.current?.destroy?.(); } catch {}

    // 4) 回到上层 / 关闭页面（保持你现有逻辑）
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
    const roomName = params.get("invite") || "default-room";
    // Ensure collabURL is a string: prefer env var, otherwise derive a sensible fallback from current origin
    const collabURL = process.env.NEXT_PUBLIC_COLLAB_WS ?? `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/yjs`;

    // 创建 Doc / Provider
    const doc = new YNS!.Doc();
    const ytext = doc.getText("monaco");
    const provider = new YWebsocketNS!.WebsocketProvider(collabURL, roomName, doc, { connect: true });
    const awareness = provider.awareness;

    // Awareness：用户名 + 颜色（role: master/agent；或随机）
    const role = (params.get("role") || "").toLowerCase();
    const userName =
      (role === "master" && "Master") ||
      (role === "agent" && "Agent") ||
      `User-${Math.random().toString(36).slice(2, 6)}`;
    userNameRef.current = userName;

    const pickColor = () => {
      if (role === "master") return { color: "#2aa198", colorLight: "rgba(42,161,152,.25)" }; // teal
      if (role === "agent")  return { color: "#d33682", colorLight: "rgba(211,54,130,.25)" }; // magenta
      const h = Math.floor(Math.random() * 360);
      return { color: `hsl(${h} 70% 55%)`, colorLight: `hsl(${h} 70% 55% / .22)` };
    };
    const { color, colorLight } = pickColor();

    awareness.setLocalState({ user: { name: userName, color, colorLight } });

    // 在线同伴列表
    const applyPeers = () => {
      const states = Array.from(awareness.getStates().values())
        .map((s: any) => s?.user)
        .filter(Boolean) as Peer[];
      setPeers(states);
    };
    awareness.on("change", applyPeers);
    applyPeers();
    cleanupFnsRef.current.push(() => awareness.off("change", applyPeers));

    // 绑定 Monaco（把 awareness 传入，让 y-monaco 渲染光标/选区/标签）
    const model = editor.getModel();
    
    if (!model) return;
    const binding = new YMonacoNS!.MonacoBinding(ytext, model, new Set([editor]), awareness);

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
      const headClass = `.yRemoteSelectionHead-${clientId}`;
      const bodyClass = `.yRemoteSelection-${clientId}`;
      const headAttr  = `.yRemoteSelectionHead[data-clientid="${clientId}"]`;
      const bodyAttr  = `.yRemoteSelection[data-clientid="${clientId}"]`;
      const root = `.editor-pane .monaco-editor`;
      return {
        head: `${root} ${headClass}, ${root} ${headAttr}`,
        body: `${root} ${bodyClass}, ${root} ${bodyAttr}`,
        label: `${root} .yRemoteSelectionHeadLabel`,
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
            border-left-width: 2px !important;
            z-index: 12 !important;
            position: relative !important;
          }
          ${S.body} {
            background: ${light} !important;
            mix-blend-mode: normal !important;
            z-index: 11 !important;
            position: relative !important;
            pointer-events: none !important;
          }
        `);
      });
      // 标签通用强化（背景由库设置，这里兜底）
      rules.push(`
        ${selFor(0).label} {
          color: #fff !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
          padding: 1px 6px !important;
          border-radius: 4px !important;
          box-shadow: 0 1px 2px rgba(0,0,0,.25);
          transform: translateY(-2px);
          z-index: 13 !important;
          position: relative !important;
        }
      `);
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
  }, [run, clearOutput, applyOutputsFromY]);

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
          <button className="btn danger" onClick={exit}>Exit</button>
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
