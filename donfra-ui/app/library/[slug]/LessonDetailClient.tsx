"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import ReactMarkdown, {
  type Components as MarkdownComponents,
} from "react-markdown";
import { API_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EMPTY_EXCALIDRAW, sanitizeExcalidraw } from "@/lib/utils/excalidraw";
import "./lesson-detail.css";

type Lesson = {
  id: number;
  slug: string;
  title: string;
  markdown?: string;
  excalidraw?: any;
  isVip?: boolean;
};

const API_ROOT = API_BASE || "/api";

const Excalidraw = dynamic(
  () => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw),
  {
    ssr: false,
    loading: () => <div style={{ color: "#aaa" }}>Loading diagram…</div>,
  }
);

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
  const { user } = useAuth();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canRenderDiagram, setCanRenderDiagram] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);

  // Check if user is admin via user authentication OR admin token
  const isUserAdmin = user?.role === "admin";
  const isAdmin = isUserAdmin || Boolean(token);
  const isVip = user?.role === "vip" || isAdmin;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const token = localStorage.getItem("admin_token");
    setToken(token);
    setCanRenderDiagram(true);
  }, []);

  useEffect(() => {
    // Skip fetching until token state is initialized
    if (typeof window !== "undefined" && token === null && localStorage.getItem("admin_token")) {
      return; // Token is being set, wait for next render
    }

    (async () => {
      try {
        setError(null);
        setLoading(true);

        const headers: HeadersInit = {};
        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(`${API_ROOT}/lessons/${slug}`, { headers, credentials: 'include' });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || `HTTP ${res.status}`);
        }

        let excaliData = data.excalidraw;
        if (typeof excaliData === "string") {
          try {
            excaliData = JSON.parse(excaliData);
          } catch {
            excaliData = null;
          }
        }

        setLesson({
          id: data.id,
          slug: data.slug ?? slug,
          title: data.title ?? slug,
          markdown: data.markdown ?? "",
          excalidraw: sanitizeExcalidraw(excaliData),
          isVip: data.isVip ?? false,
        });
      } catch (err: any) {
        console.error("Failed to load lesson:", err);
        setError(err?.message || "Failed to load lesson");
        setLesson(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug, token]);

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
          <h2 style={{ marginTop: 0 }}>
            {lesson.title || lesson.slug}
            {lesson.isVip && (
              <span style={{
                marginLeft: 12,
                fontSize: 14,
                color: "#ffd700",
                fontWeight: 700,
                background: "rgba(255,215,0,0.15)",
                padding: "4px 10px",
                borderRadius: 6,
              }}>
                VIP
              </span>
            )}
          </h2>
          <p
            style={{
              color: "#888",
              marginTop: 4,
              marginBottom: 12,
              fontSize: 14,
            }}
          >
            Slug: {lesson.slug} · ID: {lesson.id}
          </p>

          {isAdmin && (
            <div style={{ marginBottom: 12, display: "flex", gap: 10 }}>
              <button
                onClick={() => router.push(`/library/${lesson.slug}/edit`)}
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
                  if (!token && !isUserAdmin) {
                    setActionError("Admin authentication required. Please login.");
                    return;
                  }
                  if (!window.confirm("Delete this lesson? This cannot be undone.")) return;
                  try {
                    setBusy(true);
                    setActionError(null);
                    await api.study.delete(lesson.slug, token || "");
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

          {/* VIP Content Lock */}
          {lesson.isVip && !isVip ? (
            <div style={{
              padding: "40px 20px",
              textAlign: "center",
              background: "rgba(255,215,0,0.05)",
              border: "2px dashed rgba(255,215,0,0.3)",
              borderRadius: 8,
              marginTop: 20,
            }}>
              <div style={{
                fontSize: 48,
                marginBottom: 16,
              }}>🔒</div>
              <h3 style={{
                color: "#ffd700",
                marginTop: 0,
                marginBottom: 12,
              }}>VIP Content</h3>
              <p style={{
                color: "#ccc",
                fontSize: 16,
                marginBottom: 20,
                lineHeight: 1.6,
              }}>
                This lesson is exclusive to VIP members.<br />
                Please upgrade your account to access this content.
              </p>
              <button
                onClick={() => router.push("/user")}
                style={{
                  padding: "12px 24px",
                  borderRadius: 8,
                  border: "2px solid #ffd700",
                  background: "rgba(255,215,0,0.1)",
                  color: "#ffd700",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: 16,
                }}
              >
                Upgrade to VIP
              </button>
            </div>
          ) : (
            <>
              {/* 水平布局：左边Markdown，右边Diagram */}
              <div className="lesson-content-grid">
                {/* Markdown 内容 */}
                <div className="lesson-content-column">
                  <h4>Content</h4>
                  {lesson.markdown ? (
                    <div className="lesson-markdown-content">
                      <ReactMarkdown components={markdownComponents}>
                        {lesson.markdown}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div style={{ color: "#888" }}>No content.</div>
                  )}
                </div>

                {/* Excalidraw 区域 */}
                <div className="lesson-content-column">
                  <h4>Diagram</h4>
                  {canRenderDiagram ? (
                    <div className="lesson-diagram-container">
                      <Excalidraw
                        initialData={lesson.excalidraw || EMPTY_EXCALIDRAW}
                        zenModeEnabled
                        gridModeEnabled
                      />
                    </div>
                  ) : (
                    <div style={{ color: "#888" }}>Preparing canvas…</div>
                  )}
                </div>
              </div>
            </>
          )}

        </div>

      )}
    </main>
  );
}
