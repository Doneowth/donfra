"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { API_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EMPTY_EXCALIDRAW, sanitizeExcalidraw, type ExcalidrawData } from "@/lib/utils/excalidraw";
import Toast from "@/components/Toast";
import "./edit-lesson.css";

type Lesson = {
  id: number;
  slug: string;
  title: string;
  markdown?: string;
  excalidraw?: any;
  videoUrl?: string;
  codeTemplate?: {
    language?: string;
    externalUrl?: string;
  };
  isPublished?: boolean;
  isVip?: boolean;
  author?: string;
  publishedDate?: string;
};

const API_ROOT = API_BASE || "/api";

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw), {
  ssr: false,
  loading: () => <div style={{ color: "#aaa" }}>Loading diagram…</div>,
});

export default function EditLessonClient({ slug }: { slug: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [author, setAuthor] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [codeUrl, setCodeUrl] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [diagram, setDiagram] = useState<ExcalidrawData>(EMPTY_EXCALIDRAW);
  const diagramRef = useRef<ExcalidrawData>(EMPTY_EXCALIDRAW);

  // Check if user is admin or above via user authentication
  const isAdmin = user?.role === "admin" || user?.role === "god";

  useEffect(() => {
    if (!isAdmin) {
      setError("Admin login required to edit lessons.");
    }
  }, [isAdmin]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setLoading(true);

        const res = await fetch(`${API_ROOT}/lessons/${slug}`, { credentials: 'include' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        let excaliData = data.excalidraw;
        if (typeof excaliData === "string") {
          try {
            excaliData = JSON.parse(excaliData);
          } catch {
            excaliData = null;
          }
        }
        const lessonData: Lesson = {
          id: data.id,
          slug: data.slug ?? slug,
          title: data.title ?? slug,
          markdown: data.markdown ?? "",
          excalidraw: sanitizeExcalidraw(excaliData),
          videoUrl: data.videoUrl,
          codeTemplate: data.codeTemplate,
          isPublished: data.isPublished ?? true,
          isVip: data.isVip ?? false,
          author: data.author,
          publishedDate: data.publishedDate,
        };
        setLesson(lessonData);
        setTitle(data.title ?? slug);
        setMarkdown(lessonData.markdown ?? "");
        setIsPublished(data.isPublished ?? true);
        setIsVip(data.isVip ?? false);
        setAuthor(data.author ?? "");
        setPublishedDate(data.publishedDate ?? "");
        setVideoUrl(data.videoUrl ?? "");
        setCodeUrl(data.codeTemplate?.externalUrl ?? "");
        const sanitized = lessonData.excalidraw || EMPTY_EXCALIDRAW;
        diagramRef.current = sanitized;
        setDiagram(sanitized);
      } catch (err: any) {
        setError(err?.message || "Failed to load lesson");
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  const handleSave = async () => {
    if (!isAdmin) {
      setError("Admin authentication required. Please login.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await api.study.update(slug, {
        title: title.trim(),
        markdown,
        excalidraw: diagramRef.current,
        videoUrl: videoUrl.trim() || undefined,
        codeTemplate: codeUrl.trim() ? {
          language: "Python",
          externalUrl: codeUrl.trim()
        } : undefined,
        isPublished,
        isVip,
        author: author.trim() || undefined,
        publishedDate: publishedDate || undefined,
      });
      setToast({ message: "Lesson updated successfully!", type: "success" });
      setTimeout(() => {
        router.push(`/library/${slug}`);
      }, 1000);
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to save";
      setError(errorMsg);
      setToast({ message: errorMsg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
  }, []);

  return (
    <main
      style={{
        padding: "24px 28px",
        fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        color: "#eee",
        background: "#0b0c0c",
        minHeight: "100vh",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <div style={{ marginBottom: 10, color: "#ccc" }}>
        <button
          onClick={() => router.push(`/library/${slug}`)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            color: "#f4d18c",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Back to lesson
        </button>
      </div>
      <h1 style={{ marginTop: 0, marginBottom: 12 }}>Edit Lesson</h1>
      {error && <div style={{ color: "#f88", marginBottom: 12 }}>{error}</div>}
      {loading && <div>Loading…</div>}
      {!loading && lesson && (
        <div className="edit-lesson-container">
          {/* Header fields: Title, Slug, Published, VIP */}
          <div className="edit-lesson-header">
            <div className="edit-lesson-field">
              <label>Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="edit-lesson-field">
              <label>Slug</label>
              <input
                value={lesson.slug}
                readOnly
              />
            </div>
            <div className="edit-lesson-field">
              <label>Author</label>
              <input
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="Author name (optional)"
              />
            </div>
            <div className="edit-lesson-field">
              <label>Published Date <span style={{ color: "#888", fontWeight: 400, fontSize: 13 }}>(optional, e.g., {new Date().toISOString().split('T')[0]})</span></label>
              <input
                type="date"
                value={publishedDate}
                onChange={(e) => setPublishedDate(e.target.value)}
              />
            </div>
            <div className="edit-lesson-field">
              <label>Video URL</label>
              <input
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                placeholder="https://your-cdn.akamai.com/video.mp4 (optional)"
              />
            </div>
            <div className="edit-lesson-field">
              <label>Code URL <span style={{ color: "#888", fontWeight: 400, fontSize: 13 }}>(CodeSandbox, Replit, StackBlitz)</span></label>
              <input
                value={codeUrl}
                onChange={(e) => setCodeUrl(e.target.value)}
                placeholder="https://codesandbox.io/p/devbox/... (optional)"
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="isPublished"
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="isPublished" style={{ color: "#ccc", margin: 0 }}>Published</label>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                id="isVip"
                type="checkbox"
                checked={isVip}
                onChange={(e) => setIsVip(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              <label htmlFor="isVip" style={{ color: "#ffd700", margin: 0, fontWeight: 600 }}>VIP</label>
            </div>
          </div>

          {/* 水平布局：左边Markdown编辑器，右边Diagram */}
          <div className="edit-content-grid">
            {/* Markdown 编辑器 */}
            <div className="edit-content-column">
              <h4>Markdown</h4>
              <textarea
                className="edit-markdown-editor"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
              />
            </div>

            {/* Excalidraw 区域 */}
            <div className="edit-content-column">
              <h4>Diagram</h4>
              {diagram ? (
                <div className="edit-diagram-container">
                  <Excalidraw
                    initialData={diagramRef.current}
                    onChange={(elements) => {
                      diagramRef.current = sanitizeExcalidraw({
                        ...diagramRef.current,
                        elements,
                      });
                    }}
                  />
                </div>
              ) : (
                <div style={{ color: "#888" }}>Preparing canvas…</div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="edit-actions">
            <button
              className="btn-save"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              className="btn-cancel"
              onClick={() => router.push(`/library/${slug}`)}
            >
              Cancel
            </button>
          </div>
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
