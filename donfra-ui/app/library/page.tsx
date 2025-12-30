"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type LessonSummary = {
  id: number;
  slug: string;
  title: string;
  isPublished: boolean;
  isVip: boolean;
  author?: string;
  publishedDate?: string;
  createdAt: string;
  updatedAt: string;
};

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

  const [lessons, setLessons] = useState<LessonSummary[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [adminToken, setAdminToken] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);

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
        setLoadingList(true);
        const response = await api.study.listSummary(currentPage, pageSize);
        setLessons(response.lessons);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      } catch (err: any) {
        setListError(err?.message || "Failed to load lessons");
      } finally {
        setLoadingList(false);
      }
    })();
  }, [currentPage, pageSize]);

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
                  <th style={{ padding: "10px 6px", width: "180px" }}>Author</th>
                  <th style={{ padding: "10px 6px", width: "120px" }}>Published</th>
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
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <button
                            onClick={() => router.push(`/library/${lesson.slug}`)}
                            style={{
                              background: "none",
                              border: "none",
                              color: isUnpublished ? "#888" : "#f4d18c",
                              cursor: "pointer",
                              textDecoration: "none",
                              fontSize: 15,
                              fontWeight: 600,
                              padding: 0,
                            }}
                          >
                            {lesson.title || lesson.slug}
                            {isUnpublished && (
                              <span style={{ marginLeft: 8, fontSize: 12, color: "#666" }}>(unpublished)</span>
                            )}
                          </button>
                          {isVipOnly && (
                            <span style={{
                              fontSize: 12,
                              color: "#ffd700",
                              fontWeight: 700,
                              background: "linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,215,0,0.1) 100%)",
                              padding: "3px 8px",
                              borderRadius: 8,
                              border: "1px solid rgba(255,215,0,0.3)",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              boxShadow: "0 2px 4px rgba(255,215,0,0.1)",
                            }}>
                              <span style={{ fontSize: 14 }}>👑</span>
                              VIP
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 6px", color: isUnpublished ? "#888" : "#c8c1b4", fontSize: 14 }}>
                        {lesson.author || "—"}
                      </td>
                      <td style={{ padding: "10px 6px", color: isUnpublished ? "#888" : "#aaa", fontSize: 14 }}>
                        {lesson.publishedDate ? new Date(lesson.publishedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {lessons.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "10px 6px", color: "#aaa" }}>
                      No lessons found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Pagination Controls */}
          {!loadingList && !listError && totalPages > 1 && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#aaa", fontSize: 14 }}>
                {total} lessons total, page {currentPage} of {totalPages}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(169,142,100,0.3)",
                    background: currentPage === 1 ? "rgba(169,142,100,0.05)" : "rgba(169,142,100,0.15)",
                    color: currentPage === 1 ? "#666" : "#f4d18c",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  First
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(169,142,100,0.3)",
                    background: currentPage === 1 ? "rgba(169,142,100,0.05)" : "rgba(169,142,100,0.15)",
                    color: currentPage === 1 ? "#666" : "#f4d18c",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(169,142,100,0.3)",
                    background: currentPage === totalPages ? "rgba(169,142,100,0.05)" : "rgba(169,142,100,0.15)",
                    color: currentPage === totalPages ? "#666" : "#f4d18c",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid rgba(169,142,100,0.3)",
                    background: currentPage === totalPages ? "rgba(169,142,100,0.05)" : "rgba(169,142,100,0.15)",
                    color: currentPage === totalPages ? "#666" : "#f4d18c",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    fontSize: 13,
                  }}
                >
                  Last
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
