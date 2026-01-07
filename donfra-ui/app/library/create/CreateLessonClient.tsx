"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { API_BASE, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { EMPTY_EXCALIDRAW, sanitizeExcalidraw, type ExcalidrawData } from "@/lib/utils/excalidraw";
import Toast from "@/components/Toast";
import "../[slug]/edit/edit-lesson.css";

type LessonPayload = {
  slug: string;
  title: string;
  markdown: string;
  excalidraw: any;
  videoUrl?: string;
  isPublished: boolean;
  isVip: boolean;
  author?: string;
  publishedDate?: string;
};

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw), {
  ssr: false,
  loading: () => <div style={{ color: "#aaa" }}>Loading diagram…</div>,
});

export default function CreateLessonClient() {
  const router = useRouter();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [author, setAuthor] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const excaliRef = useRef<ExcalidrawData>(EMPTY_EXCALIDRAW);

  // Check if user is admin or above via user authentication
  const isAdmin = user?.role === "admin" || user?.role === "god";

  useEffect(() => {
    if (!isAdmin) {
      setError("Admin login required to create lessons.");
    }
  }, [isAdmin]);

  const handleSubmit = async () => {
    if (!isAdmin) {
      setError("Admin authentication required. Please login.");
      return;
    }
    if (!slug.trim() || !title.trim()) {
      setError("Slug and Title are required.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload: LessonPayload = {
        slug: slug.trim(),
        title: title.trim(),
        markdown,
        excalidraw: excaliRef.current,
        videoUrl: videoUrl.trim() || undefined,
        isPublished,
        isVip,
        author: author.trim() || undefined,
        publishedDate: publishedDate || undefined,
      };

      await api.study.create(payload);
      setToast({ message: "Lesson created successfully!", type: "success" });
      setTimeout(() => {
        router.push(`/library/${payload.slug}`);
      }, 1000);
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to create lesson";
      setError(errorMsg);
      setToast({ message: errorMsg, type: "error" });
    } finally {
      setSaving(false);
    }
  };

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
          Back to library
        </button>
      </div>
      <h1 style={{ marginTop: 0, marginBottom: 12 }}>Create Lesson</h1>
      {error && <div style={{ color: "#f88", marginBottom: 12 }}>{error}</div>}

      <div className="edit-lesson-container">
        {/* Header fields: Title, Slug, Published, VIP */}
        <div className="edit-lesson-header">
          <div className="edit-lesson-field">
            <label>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Lesson title"
            />
          </div>
          <div className="edit-lesson-field">
            <label>Slug</label>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              placeholder="unique-slug"
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
              placeholder="Write lesson content in Markdown..."
            />
          </div>

          {/* Excalidraw 区域 */}
          <div className="edit-content-column">
            <h4>Diagram</h4>
            <div className="edit-diagram-container">
              <Excalidraw
                initialData={excaliRef.current}
                onChange={(elements) => {
                  excaliRef.current = sanitizeExcalidraw({
                    ...excaliRef.current,
                    elements,
                  });
                }}
              />
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="edit-actions">
          <button
            className="btn-save"
            onClick={handleSubmit}
            disabled={saving || !slug.trim() || !title.trim()}
          >
            {saving ? "Creating…" : "Create lesson"}
          </button>
          <button
            className="btn-cancel"
            onClick={() => router.push("/library")}
          >
            Cancel
          </button>
        </div>
      </div>
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
