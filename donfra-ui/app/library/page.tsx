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

const API_ROOT = API_BASE || "/api";

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
    <main className="admin-shell" style={{ paddingTop: 100 }}>
      <video
        className="admin-hero-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/defender.mp4" type="video/mp4" />
      </video>
      <div className="admin-vignette" />
      <div className="admin-bg-grid" />
      <div className="admin-wrapper">
        <div className="admin-headline">
          <p className="eyebrow">Study Library</p>
          <h1>Lessons</h1>
          <p className="lede">Browse all lessons. Admins can create and edit entries.</p>
        </div>

        {isAdmin && (
          <div style={{ marginBottom: 16 }}>
            <button
              onClick={() => router.push("/library/create")}
              style={{
                padding: "10px 16px",
                borderRadius: 10,
                border: "1px solid rgba(169,142,100,0.35)",
                background: "rgba(169,142,100,0.08)",
                color: "#f4d18c",
                cursor: "pointer",
                fontWeight: 700,
              }}
            >
              Create lesson
            </button>
          </div>
        )}

        <section
          className="admin-card"
          style={{ padding: 18, backdropFilter: "blur(4px)", background: "rgba(26,33,30,0.65)" }}
        >
          {loadingList && <div style={{ color: "#ccc" }}>Loading lessons…</div>}
          {listError && <div style={{ color: "#f88" }}>{listError}</div>}
          {!loadingList && !listError && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(169,142,100,0.25)" }}>
                  <th style={{ padding: "10px 6px", width: "80px" }}>ID</th>
                  <th style={{ padding: "10px 6px" }}>Title</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((lesson) => (
                  <tr key={lesson.Slug} style={{ borderBottom: "1px solid rgba(169,142,100,0.1)" }}>
                    <td style={{ padding: "10px 6px", color: "#c8c1b4" }}>{lesson.ID}</td>
                    <td style={{ padding: "10px 6px" }}>
                      <button
                        onClick={() => router.push(`/library/${lesson.Slug}`)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#f4d18c",
                          cursor: "pointer",
                          textDecoration: "underline",
                          fontSize: 15,
                          fontWeight: 600,
                        }}
                      >
                        {lesson.Title || lesson.Slug}
                      </button>
                    </td>
                  </tr>
                ))}
                {lessons.length === 0 && (
                  <tr>
                    <td colSpan={2} style={{ padding: "10px 6px", color: "#aaa" }}>
                      No lessons found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
