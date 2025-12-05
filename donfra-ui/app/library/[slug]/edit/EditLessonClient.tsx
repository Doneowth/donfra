"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { API_BASE, api } from "@/lib/api";


type Lesson = {
  ID: number;
  Slug: string;
  Title: string;
  Markdown?: string;
  Excalidraw?: any;
};

const API_ROOT = API_BASE || "/api";

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw), {
  ssr: false,
  loading: () => <div style={{ color: "#aaa" }}>Loading diagram…</div>,
});

interface ExcalidrawData {
  type: "excalidraw";
  version: number;
  source: string;
  elements: readonly any[];
  appState: any;
  files: any;
}

const EMPTY_EXCALIDRAW: ExcalidrawData = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [],
  appState: { collaborators: new Map() },
  files: {},
};

export default function EditLessonClient({ slug }: { slug: string }) {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [diagram, setDiagram] = useState<ExcalidrawData>(EMPTY_EXCALIDRAW);
  const diagramRef = useRef<ExcalidrawData>(EMPTY_EXCALIDRAW);

  const sanitizeExcalidraw = (raw: any): ExcalidrawData => {
    if (!raw || typeof raw !== "object") return { ...EMPTY_EXCALIDRAW };
    const appState = raw.appState || {};
    return {
      type: "excalidraw",
      version: raw.version ?? 2,
      source: raw.source ?? "https://excalidraw.com",
      elements: Array.isArray(raw.elements) ? raw.elements : [],
      appState: {
        ...appState,
        collaborators: appState.collaborators instanceof Map ? appState.collaborators : new Map(),
      },
      files: { ...(raw.files || {}) },
    };
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("admin_token");
    setToken(saved);
    if (!saved) setError("Admin login required to edit lessons.");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        setLoading(true);
        const res = await fetch(`${API_ROOT}/lessons/${slug}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        let excaliData = data.Excalidraw ?? data.excalidraw;
        if (typeof excaliData === "string") {
          try {
            excaliData = JSON.parse(excaliData);
          } catch {
            excaliData = null;
          }
        }
        const lessonData: Lesson = {
          ID: data.ID ?? data.id,
          Slug: data.Slug ?? data.slug ?? slug,
          Title: data.Title ?? data.title ?? slug,
          Markdown: data.Markdown ?? data.markdown ?? "",
          Excalidraw: sanitizeExcalidraw(excaliData),
        };
        setLesson(lessonData);
        setTitle(data.Title ?? data.title ?? slug);
        setMarkdown(lessonData.Markdown ?? "");
        const sanitized = lessonData.Excalidraw || EMPTY_EXCALIDRAW;
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
    if (!token) {
      setError("Admin token missing. Please login.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      await api.study.update(slug, { title: title.trim(), markdown, excalidraw: diagramRef.current }, token);
      router.push(`/library/${slug}`);
    } catch (err: any) {
      setError(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
  }, []);

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
        <div
          style={{
            border: "1px solid #333",
            borderRadius: 8,
            padding: 16,
            background: "#0f1211",
            maxWidth: 640,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", color: "#ccc", marginBottom: 6 }}>Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #444",
                background: "#0b0c0c",
                color: "#eee",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "#ccc", marginBottom: 6 }}>Slug</label>
            <input
              value={lesson.Slug}
              readOnly
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #333",
                background: "#0b0c0c",
                color: "#888",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", color: "#ccc", marginBottom: 6 }}>Markdown</label>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              rows={12}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid #444",
                background: "#0b0c0c",
                color: "#eee",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas",
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <h4 style={{ margin: "0 0 8px 0", color: "#ddd" }}>Diagram</h4>
            {diagram ? (
              <div
                style={{
                  position: "relative",
                  border: "1px solid #1c1f1e",
                  borderRadius: 8,
                  overflow: "hidden",
                  background: "#1a1d1c",
                  minHeight: 320,
                  height: 400,
                }}
              >
                <Excalidraw
                  initialData={diagramRef.current}
                  onChange={(elements, appState, files) => {
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

          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: "10px 16px",
                borderRadius: 6,
                border: "1px solid #f4d18c",
                background: "#f4d18c",
                color: "#0b0c0c",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
            <button
              onClick={() => router.push(`/library/${slug}`)}
              style={{
                padding: "10px 16px",
                borderRadius: 6,
                border: "1px solid #444",
                background: "transparent",
                color: "#eee",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
