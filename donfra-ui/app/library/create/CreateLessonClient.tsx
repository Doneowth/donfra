"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { API_BASE, api } from "@/lib/api";

type LessonPayload = {
  slug: string;
  title: string;
  markdown: string;
  excalidraw: any;
  isPublished: boolean;
};

const Excalidraw = dynamic(() => import("@excalidraw/excalidraw").then((mod) => mod.Excalidraw), {
  ssr: false,
  loading: () => <div style={{ color: "#aaa" }}>Loading diagram…</div>,
});

const EMPTY_EXCALIDRAW = {
  type: "excalidraw",
  version: 2,
  source: "https://excalidraw.com",
  elements: [] as any[],
  appState: { collaborators: new Map() },
  files: {},
};

export default function CreateLessonClient() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [markdown, setMarkdown] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const excaliRef = useRef<any>(EMPTY_EXCALIDRAW);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("admin_token");
    setToken(saved);
    if (!saved) setError("Admin login required to create lessons.");
  }, []);

  const sanitizeExcalidraw = (raw: any) => {
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

  const handleSubmit = async () => {
    if (!token) {
      setError("Admin token missing. Please login.");
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
        isPublished,
      };
      await api.study.create(payload, token);
      router.push(`/library/${payload.slug}`);
    } catch (err: any) {
      setError(err?.message || "Failed to create lesson");
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

      <div
        style={{
          border: "1px solid #333",
          borderRadius: 8,
          padding: 20,
          background: "#0f1211",
          width: "100%",
          flex: 1,
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: 14,
        }}
      >
        <div>
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

        <div>
          <label style={{ display: "block", color: "#ccc", marginBottom: 6 }}>Slug</label>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
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

        <div>
          <label style={{ display: "block", color: "#ccc", marginBottom: 6 }}>Markdown</label>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            rows={18}
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

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            id="isPublished"
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          <label htmlFor="isPublished" style={{ color: "#ccc" }}>Published</label>
        </div>

        <div>
          <h4 style={{ margin: "0 0 8px 0", color: "#ddd" }}>Diagram</h4>
          <div
            style={{
              position: "relative",
              border: "1px solid #1c1f1e",
              borderRadius: 8,
              overflow: "hidden",
              background: "#1a1d1c",
              minHeight: 320,
              height: 520,
            }}
          >
            <Excalidraw
              initialData={excaliRef.current}
              onChange={(elements, appState, files) => {
                excaliRef.current = sanitizeExcalidraw({
                  ...excaliRef.current,
                  elements,
                  appState,
                  files,
                });
              }}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button
            onClick={handleSubmit}
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
            {saving ? "Submitting…" : "Create lesson"}
          </button>
          <button
            onClick={() => router.push("/library")}
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
    </main>
  );
}
