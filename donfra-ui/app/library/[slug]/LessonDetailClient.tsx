"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import ReactMarkdown, {
  type Components as MarkdownComponents,
} from "react-markdown";
import { API_BASE, api } from "@/lib/api";

type Lesson = {
  ID: number;
  Slug: string;
  Title: string;
  Markdown?: string;
  Excalidraw?: any;
};

const API_ROOT = API_BASE || "/api";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => <div style={{ color: "#aaa" }}>Loading diagram…</div>,
  }
);

const EMPTY_EXCALIDRAW = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [] as any[],
  appState: {
    gridSize: 20,
    gridStep: 5,
    gridModeEnabled: false,
    viewBackgroundColor: "#ffffff",
    collaborators: new Map(),
  },
  files: {},
};

// 不再用 CodeComponent 类型，自己定义一个 props 就行
type CodeProps = React.ComponentProps<"code"> & {
  inline?: boolean;
  node?: any;
};

const CodeBlock = ({ inline, className, children, ...props }: CodeProps) => {
  if (inline) {
    // `inline code`
    return (
      <code
        className={className}
        style={{
          background: "#161a19",
          padding: "2px 5px",
          borderRadius: 4,
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
          fontSize: "0.9em",
        }}
        {...props}
      >
        {children}
      </code>
    );
  }

  // ```block code```
  return (
    <pre
      style={{
        margin: "8px 0",
        background: "#0b0c0c",
        padding: 12,
        borderRadius: 6,
        overflowX: "auto",
      }}
    >
      <code
        className={className}
        style={{
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
          fontSize: "0.9em",
        }}
        {...props}
      >
        {children}
      </code>
    </pre>
  );
};

const markdownComponents: MarkdownComponents = {
  h1: ({ node, ...props }) => (
    <h1 style={{ fontSize: 26, margin: "10px 0" }} {...props} />
  ),
  h2: ({ node, ...props }) => (
    <h2 style={{ fontSize: 22, margin: "10px 0" }} {...props} />
  ),
  h3: ({ node, ...props }) => (
    <h3 style={{ fontSize: 19, margin: "8px 0" }} {...props} />
  ),
  p: ({ node, ...props }) => (
    <p style={{ margin: "8px 0", lineHeight: 1.7 }} {...props} />
  ),
  code: CodeBlock,
  ul: ({ node, ...props }) => (
    <ul style={{ paddingLeft: 20, margin: "8px 0" }} {...props} />
  ),
  ol: ({ node, ...props }) => (
    <ol style={{ paddingLeft: 20, margin: "8px 0" }} {...props} />
  ),
  blockquote: ({ node, ...props }) => (
    <blockquote
      style={{
        borderLeft: "3px solid #555",
        paddingLeft: 12,
        margin: "8px 0",
        color: "#b5c1be",
      }}
      {...props}
    />
  ),
};

export default function LessonDetailClient({ slug }: { slug: string }) {
  const router = useRouter();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [canRenderDiagram, setCanRenderDiagram] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("admin_token");
    setIsAdmin(Boolean(token));
    setToken(token);
    setCanRenderDiagram(true);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setLoading(true);

        const res = await fetch(`${API_ROOT}/lessons/${slug}`);
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }

        let excaliData = data.Excalidraw ?? data.excalidraw;
        if (typeof excaliData === "string") {
          try {
            excaliData = JSON.parse(excaliData);
          } catch {
            excaliData = null;
          }
        }
        const appState = excaliData?.appState || {};
        // Excalidraw expects Map for collaborators; ensure shape to avoid runtime errors.
        const normalizedAppState = {
          ...appState,
          collaborators: appState?.collaborators instanceof Map ? appState.collaborators : new Map(),
        };
        const normalizedExcalidraw =
          excaliData && typeof excaliData === "object"
            ? { ...excaliData, appState: normalizedAppState }
            : EMPTY_EXCALIDRAW;

        setLesson({
          ID: data.ID ?? data.id,
          Slug: data.Slug ?? data.slug ?? slug,
          Title: data.Title ?? data.title ?? slug,
          Markdown: data.Markdown ?? data.markdown ?? "",
          Excalidraw: normalizedExcalidraw,
        });
      } catch (err: any) {
        console.error("Failed to load lesson:", err);
        setError(err?.message || "Failed to load lesson");
        setLesson(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  return (
    <main
      style={{
        padding: "32px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#eee",
        background: "#0b0c0c",
        minHeight: "100vh",
      }}
    >
      {/* 面包屑 */}
      <div style={{ marginBottom: 10, color: "#ccc" }}>
        <button
          onClick={() => router.push("/library")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#f4d18c",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Library 
        </button>
        <span style={{ margin: "0 8px" }}>/</span>
        <span>{slug}</span>
      </div>

      <h1 style={{ marginTop: 0, marginBottom: 12 }}>Lesson Detail</h1>

      {loading && <div>Loading…</div>}
      {error && !loading && (
        <div style={{ color: "#f88", marginTop: 8 }}>{error}</div>
      )}

      {!loading && !error && lesson && (
        <div
          style={{
            border: "1px solid #333",
            borderRadius: 8,
            padding: 12,
            background: "#0f1211",
          }}
        >
          <h2 style={{ marginTop: 0 }}>{lesson.Title || lesson.Slug}</h2>
          <p
            style={{
              color: "#888",
              marginTop: 4,
              marginBottom: 12,
              fontSize: 14,
            }}
          >
            Slug: {lesson.Slug} · ID: {lesson.ID}
          </p>

          {isAdmin && (
            <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
              <button
                onClick={() => router.push(`/library/${lesson.Slug}/edit`)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #f4d18c",
                  background: "transparent",
                  color: "#f4d18c",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Edit lesson
              </button>
              <button
                onClick={async () => {
                  if (!token) {
                    setActionError("Admin token missing. Please login.");
                    return;
                  }
                  if (!window.confirm("Delete this lesson? This cannot be undone.")) return;
                  try {
                    setBusy(true);
                    setActionError(null);
                    await api.study.delete(lesson.Slug, token);
                    router.push("/library");
                  } catch (err: any) {
                    setActionError(err?.message || "Failed to delete lesson");
                  } finally {
                    setBusy(false);
                  }
                }}
                disabled={busy}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #f26b6b",
                  background: "#2a0f0f",
                  color: "#f88",
                  cursor: "pointer",
                  fontWeight: 600,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Deleting…" : "Delete"}
              </button>
            </div>
          )}
          {actionError && (
            <div style={{ color: "#f88", marginBottom: 12 }}>{actionError}</div>
          )}

          {/* Markdown 内容 */}
          <div
            style={{
              borderTop: "1px solid #333",
              paddingTop: 12,
              marginTop: 8,
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", color: "#ddd" }}>Content</h4>
            {lesson.Markdown ? (
              <div
                style={{
                  background: "#0c0f0e",
                  border: "1px solid #1c1f1e",
                  borderRadius: 8,
                  padding: "12px 14px",
                  color: "#e7e7e7",
                  fontSize: 15,
                }}
              >
                <ReactMarkdown components={markdownComponents}>
                  {lesson.Markdown}
                </ReactMarkdown>
              </div>
            ) : (
              <div style={{ color: "#888" }}>No content.</div>
            )}
          </div>
          {/* Excalidraw 区域 */}
          <div style={{ marginTop: 18 }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#ddd" }}>Diagram</h4>
            {canRenderDiagram ? (
              <div
                style={{
                  position: "relative",
                  border: "1px solid #1c1f1e",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#1a1d1c",
                  minHeight: 360,
                  height: 420,
                }}
              >
                <Excalidraw
                  initialData={lesson.Excalidraw || EMPTY_EXCALIDRAW}
                  zenModeEnabled
                  gridModeEnabled
                />
              </div>
            ) : (
              <div style={{ color: "#888" }}>Preparing canvas…</div>
            )}
          </div>

        </div>

      )}
    </main>
  );
}
