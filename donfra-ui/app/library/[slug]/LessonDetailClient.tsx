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
import Toast from "@/components/Toast";
import "./lesson-detail.css";

type Lesson = {
  id: number;
  slug: string;
  title: string;
  markdown?: string;
  excalidraw?: any;
  videoUrl?: string;
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

type TabType = "markdown" | "diagram" | "video";

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
  const [activeTab, setActiveTab] = useState<TabType>("markdown");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

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
          videoUrl: data.videoUrl,
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
                    setToast({ message: "Admin authentication required. Please login.", type: "error" });
                    return;
                  }
                  if (!window.confirm("Delete this lesson? This cannot be undone.")) return;
                  try {
                    setBusy(true);
                    setActionError(null);
                    await api.study.delete(lesson.slug, token || "");
                    setToast({ message: "Lesson deleted successfully!", type: "success" });
                    setTimeout(() => {
                      router.push("/library");
                    }, 1000);
                  } catch (err: any) {
                    const errorMsg = err?.message || "Failed to delete lesson";
                    setActionError(errorMsg);
                    setToast({ message: errorMsg, type: "error" });
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
              {/* Tab Navigation */}
              <div style={{
                display: "flex",
                gap: 8,
                borderBottom: "2px solid #333",
                marginBottom: 16,
              }}>
                <button
                  onClick={() => setActiveTab("markdown")}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    background: activeTab === "markdown" ? "#1a1f1e" : "transparent",
                    color: activeTab === "markdown" ? "#f4d18c" : "#888",
                    cursor: "pointer",
                    fontWeight: activeTab === "markdown" ? 600 : 400,
                    borderBottom: activeTab === "markdown" ? "2px solid #f4d18c" : "2px solid transparent",
                    marginBottom: -2,
                  }}
                >
                  Markdown
                </button>
                <button
                  onClick={() => setActiveTab("diagram")}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    background: activeTab === "diagram" ? "#1a1f1e" : "transparent",
                    color: activeTab === "diagram" ? "#f4d18c" : "#888",
                    cursor: "pointer",
                    fontWeight: activeTab === "diagram" ? 600 : 400,
                    borderBottom: activeTab === "diagram" ? "2px solid #f4d18c" : "2px solid transparent",
                    marginBottom: -2,
                  }}
                >
                  Diagram
                </button>
                {lesson.videoUrl && (
                  <button
                    onClick={() => setActiveTab("video")}
                    style={{
                      padding: "10px 20px",
                      border: "none",
                      background: activeTab === "video" ? "#1a1f1e" : "transparent",
                      color: activeTab === "video" ? "#f4d18c" : "#888",
                      cursor: "pointer",
                      fontWeight: activeTab === "video" ? 600 : 400,
                      borderBottom: activeTab === "video" ? "2px solid #f4d18c" : "2px solid transparent",
                      marginBottom: -2,
                    }}
                  >
                    Video
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div>
                {activeTab === "markdown" && (
                  <div>
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
                )}

                {activeTab === "diagram" && (
                  <div>
                    {canRenderDiagram ? (
                      <div style={{
                        height: "600px",
                        border: "1px solid #333",
                        borderRadius: 6,
                        overflow: "hidden",
                      }}>
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
                )}

                {activeTab === "video" && lesson.videoUrl && (
                  <div>
                    <video
                      controls
                      style={{
                        width: "100%",
                        maxWidth: "900px",
                        borderRadius: 6,
                        background: "#000",
                      }}
                      src={lesson.videoUrl}
                    >
                      Your browser does not support video playback.
                    </video>
                  </div>
                )}
              </div>
            </>
          )}

        </div>

      )}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isOpen={!!toast}
          onClose={() => setToast(null)}
        />
      )}
    </main>
  );
}
