"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchLessonRequest,
  updateLessonRequest,
  clearSaveError,
} from "@/features/lessons/lessonsSlice";
import {
  selectLessonBySlug,
  selectDetailLoading,
  selectDetailError,
  selectSaving,
  selectSaveError,
} from "@/features/lessons/lessonsSelectors";
import type { LessonUpdateData } from "@/features/lessons/lessonsTypes";
import { EMPTY_EXCALIDRAW, sanitizeExcalidraw, type ExcalidrawData } from "@/lib/utils/excalidraw";
import Toast from "@/components/Toast";
import "./edit-lesson.css";

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw), {
  ssr: false,
  loading: () => <div style={{ color: "#aaa" }}>Loading diagram…</div>,
});

export default function EditLessonClient({ slug }: { slug: string }) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAuth();

  // Redux state
  const lesson = useAppSelector(selectLessonBySlug(slug));
  const loading = useAppSelector(selectDetailLoading);
  const detailError = useAppSelector(selectDetailError);
  const saving = useAppSelector(selectSaving);
  const saveError = useAppSelector(selectSaveError);

  // Local form state
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [isVip, setIsVip] = useState(false);
  const [author, setAuthor] = useState("");
  const [publishedDate, setPublishedDate] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [codeUrl, setCodeUrl] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [diagram, setDiagram] = useState<ExcalidrawData>(EMPTY_EXCALIDRAW);
  const diagramRef = useRef<ExcalidrawData>(EMPTY_EXCALIDRAW);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formInitialized, setFormInitialized] = useState(false);

  // Check if user is admin or above via user authentication
  const isAdmin = user?.role === "admin" || user?.role === "god";

  useEffect(() => {
    if (!isAdmin) {
      setLocalError("Admin login required to edit lessons.");
    }
  }, [isAdmin]);

  // Fetch lesson on mount
  useEffect(() => {
    dispatch(fetchLessonRequest(slug));
  }, [dispatch, slug]);

  // Initialize form when lesson loads
  useEffect(() => {
    if (lesson && !formInitialized) {
      setTitle(lesson.title || slug);
      setMarkdown(lesson.markdown || "");
      setIsPublished(lesson.isPublished ?? true);
      setIsVip(lesson.isVip ?? false);
      setAuthor(lesson.author || "");
      setPublishedDate(lesson.publishedDate || "");
      setVideoUrl(lesson.videoUrl || "");
      setCodeUrl(lesson.codeTemplate?.externalUrl || "");

      let excaliData = lesson.excalidraw;
      if (typeof excaliData === "string") {
        try {
          excaliData = JSON.parse(excaliData);
        } catch {
          excaliData = null;
        }
      }
      const sanitized = sanitizeExcalidraw(excaliData) || EMPTY_EXCALIDRAW;
      diagramRef.current = sanitized;
      setDiagram(sanitized);
      setFormInitialized(true);
    }
  }, [lesson, slug, formInitialized]);

  // Clear Redux error on unmount
  useEffect(() => {
    return () => {
      dispatch(clearSaveError());
    };
  }, [dispatch]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
      setToast({ message: "Please upload a .md or .markdown file", type: "error" });
      return;
    }

    try {
      const text = await file.text();
      setMarkdown(text);
      setToast({ message: `Loaded ${file.name} successfully!`, type: "success" });
    } catch (err: any) {
      setToast({ message: `Failed to read file: ${err.message}`, type: "error" });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSave = () => {
    if (!isAdmin) {
      setLocalError("Admin authentication required. Please login.");
      return;
    }

    setLocalError(null);
    const data: LessonUpdateData = {
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
    };

    dispatch(updateLessonRequest({ slug, data }));
    setToast({ message: "Saving changes...", type: "success" });

    setTimeout(() => {
      router.push(`/library/${slug}`);
    }, 1500);
  };

  const error = localError || detailError || saveError;

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

          {/* Horizontal layout: Markdown editor on left, Diagram on right */}
          <div className="edit-content-grid">
            {/* Markdown editor */}
            <div className="edit-content-column">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <h4 style={{ margin: 0 }}>Markdown</h4>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md,.markdown"
                    onChange={handleFileUpload}
                    style={{ display: "none" }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      border: "1px solid rgba(169,142,100,0.4)",
                      background: "rgba(169,142,100,0.1)",
                      color: "#f4d18c",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    Upload .md file
                  </button>
                </div>
              </div>
              <textarea
                className="edit-markdown-editor"
                value={markdown}
                onChange={(e) => setMarkdown(e.target.value)}
              />
            </div>

            {/* Excalidraw area */}
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
