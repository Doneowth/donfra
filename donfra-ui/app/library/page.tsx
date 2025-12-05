"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";

type Lesson = {
  ID: number;
  Slug: string;
  Title: string;
  Markdown?: string;
  Excalidraw?: any;
};

const API_ROOT = API_BASE || "http://localhost/api";

export default function LibraryPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32, color: "#eee" }}>Loading…</main>}>
      <LibraryInner />
    </Suspense>
  );
}

function LibraryInner() {
  const router = useRouter();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("admin_token");
      setIsAdmin(Boolean(token));
    }
    (async () => {
      try {
        const res = await fetch(`${API_ROOT}/lessons`);
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        setLessons(data);
      } catch (err: any) {
        setListError(err?.message || "Failed to load lessons");
      } finally {
        setLoadingList(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main style={{ padding: "32px", fontFamily: "sans-serif", color: "#eee", background: "#0b0c0c", minHeight: "100vh" }}>
      <h1 style={{ marginBottom: 12 }}>Lesson Library</h1>
      <p style={{ color: "#ccc", marginBottom: 16 }}>Click a lesson to open its detail page.</p>
      {isAdmin && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => router.push("/library/create")}
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
            Create lesson
          </button>
        </div>
      )}

      <section style={{ marginBottom: 24 }}>
        {loadingList && <div>Loading lessons…</div>}
        {listError && <div style={{ color: "#f88" }}>{listError}</div>}
        {!loadingList && !listError && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1px solid #444" }}>
                <th style={{ padding: "8px 6px", width: "80px" }}>ID</th>
                <th style={{ padding: "8px 6px" }}>Title</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((lesson) => (
                <tr key={lesson.Slug} style={{ borderBottom: "1px solid #222" }}>
                  <td style={{ padding: "8px 6px", color: "#aaa" }}>{lesson.ID}</td>
                  <td style={{ padding: "8px 6px" }}>
                    <button
                      onClick={() => router.push(`/library/${lesson.Slug}`)}
                      style={{ background: "none", border: "none", color: "#f4d18c", cursor: "pointer", textDecoration: "underline", fontSize: 15 }}
                    >
                      {lesson.Title || lesson.Slug}
                    </button>
                  </td>
                </tr>
              ))}
              {lessons.length === 0 && (
                <tr>
                  <td colSpan={2} style={{ padding: "8px 6px", color: "#aaa" }}>
                    No lessons found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
