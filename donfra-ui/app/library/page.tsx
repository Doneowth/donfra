"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Lesson = {
  id: number;
  slug: string;
  title: string;
  markdown?: string;
  excalidraw?: any;
  isPublished?: boolean;
  isVip?: boolean;
  createdAt?: string;
  updatedAt?: string;
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
  const { user } = useAuth();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Check if user is admin via user authentication OR admin token
  const isUserAdmin = user?.role === "admin";
  const isAdmin = isUserAdmin || Boolean(adminToken);
  const isVip = user?.role === "vip" || isAdmin;

  // Initialize admin token from localStorage on client side only
  useEffect(() => {
    if (typeof window !== "undefined") {
      setAdminToken(localStorage.getItem("admin_token"));
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const headers: HeadersInit = {};
        if (adminToken) {
          headers.Authorization = `Bearer ${adminToken}`;
        }

        const res = await fetch(`${API_ROOT}/lessons`, { headers, credentials: 'include' });
        const data = await res.json();
        if (!Array.isArray(data)) throw new Error("Unexpected response");
        setLessons(data);
      } catch (err: any) {
        setListError(err?.message || "Failed to load lessons");
      } finally {
        setLoadingList(false);
      }
    })();
  }, [adminToken]);

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
                {lessons.map((lesson) => {
                  const isUnpublished = lesson.isPublished === false;
                  const isVipOnly = lesson.isVip === true;
                  return (
                    <tr key={lesson.slug} style={{ borderBottom: "1px solid rgba(169,142,100,0.1)" }}>
                      <td style={{ padding: "10px 6px", color: isUnpublished ? "#666" : "#c8c1b4" }}>
                        {lesson.id}
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        <button
                          onClick={() => router.push(`/library/${lesson.slug}`)}
                          style={{
                            background: "none",
                            border: "none",
                            color: isUnpublished ? "#888" : "#f4d18c",
                            cursor: "pointer",
                            textDecoration: "underline",
                            fontSize: 15,
                            fontWeight: 600,
                          }}
                        >
                          {lesson.title || lesson.slug}
                          {isUnpublished && (
                            <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>(unpublished)</span>
                          )}
                          {isVipOnly && (
                            <span style={{ 
                              marginLeft: 8, 
                              fontSize: 11, 
                              color: "#ffd700",
                              fontWeight: 700,
                              background: "rgba(255,215,0,0.15)",
                              padding: "2px 6px",
                              borderRadius: 4,
                            }}>
                              VIP
                            </span>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
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
