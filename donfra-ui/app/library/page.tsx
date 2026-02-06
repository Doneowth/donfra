"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  fetchLessonsRequest,
  fetchPendingReviewRequest,
  reviewLessonRequest,
  setPage,
  setSearch,
  setSortBy,
} from "@/features/lessons/lessonsSlice";
import {
  selectLessons,
  selectLessonsLoading,
  selectLessonsError,
  selectCurrentPage,
  selectTotalPages,
  selectTotal,
  selectSearch,
  selectSortBy,
  selectSortDesc,
  selectPendingReviewItems,
  selectPendingReviewLoading,
  selectReviewing,
} from "@/features/lessons/lessonsSelectors";
import ReviewStatusBadge from "@/components/ReviewStatusBadge";

export default function LibraryPage() {
  return (
    <Suspense fallback={<main style={{ padding: 32, color: "#eee" }}>Loading…</main>}>
      <LibraryInner />
    </Suspense>
  );
}

function LibraryInner() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"all" | "pending">("all");

  // Redux state
  const lessons = useAppSelector(selectLessons);
  const loading = useAppSelector(selectLessonsLoading);
  const error = useAppSelector(selectLessonsError);
  const currentPage = useAppSelector(selectCurrentPage);
  const totalPages = useAppSelector(selectTotalPages);
  const total = useAppSelector(selectTotal);
  const search = useAppSelector(selectSearch);
  const sortBy = useAppSelector(selectSortBy);
  const sortDesc = useAppSelector(selectSortDesc);
  const pendingReviewItems = useAppSelector(selectPendingReviewItems);
  const pendingReviewLoading = useAppSelector(selectPendingReviewLoading);
  const reviewing = useAppSelector(selectReviewing);

  // Check if user is admin or above via user authentication
  const isAdmin = user?.role === "admin" || user?.role === "god";

  // Fetch lessons on mount
  useEffect(() => {
    dispatch(fetchLessonsRequest());
    if (isAdmin) {
      dispatch(fetchPendingReviewRequest());
    }
  }, [dispatch, isAdmin]);

  // Handle search input
  const handleSearchChange = (value: string) => {
    dispatch(setSearch(value));
  };

  // Handle sort change
  const handleSortByChange = (field: string) => {
    dispatch(setSortBy({ field, desc: sortDesc }));
  };

  // Handle sort direction toggle
  const handleSortDescToggle = () => {
    dispatch(setSortBy({ field: sortBy, desc: !sortDesc }));
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    dispatch(setPage(page));
  };

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
          <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
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

            {/* Tab toggle: All Lessons / Pending Reviews */}
            <div className="review-tabs">
              <button
                className={`review-tab ${activeTab === "all" ? "review-tab--active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                All Lessons
              </button>
              <button
                className={`review-tab ${activeTab === "pending" ? "review-tab--active" : ""}`}
                onClick={() => {
                  setActiveTab("pending");
                  dispatch(fetchPendingReviewRequest());
                }}
              >
                Pending Reviews
                {pendingReviewItems.length > 0 && (
                  <span className="review-tab-count">{pendingReviewItems.length}</span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Search and Sort Controls */}
        <div style={{ marginBottom: 16, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          {/* Search Input */}
          <input
            type="text"
            placeholder="Search by title, slug, or author..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            style={{
              flex: "1 1 300px",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(169,142,100,0.3)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: 14,
            }}
          />

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => handleSortByChange(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(169,142,100,0.3)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <option value="created_at">Sort by: Created Date</option>
            <option value="updated_at">Sort by: Updated Date</option>
            <option value="title">Sort by: Title</option>
            <option value="published_date">Sort by: Published Date</option>
            <option value="id">Sort by: ID</option>
          </select>

          {/* Sort Direction Toggle */}
          <button
            onClick={handleSortDescToggle}
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid rgba(169,142,100,0.3)",
              background: "rgba(169,142,100,0.08)",
              color: "#f4d18c",
              cursor: "pointer",
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {sortDesc ? "↓ Desc" : "↑ Asc"}
          </button>

          {/* Clear Search */}
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                border: "1px solid rgba(255,100,100,0.3)",
                background: "rgba(255,100,100,0.08)",
                color: "#ff6464",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Clear
            </button>
          )}
        </div>

        {/* Pending Reviews Tab Content */}
        {isAdmin && activeTab === "pending" && (
          <section
            className="admin-card"
            style={{ padding: 18, backdropFilter: "blur(4px)", background: "rgba(26,33,30,0.65)", marginBottom: 20 }}
          >
            {pendingReviewLoading && <div style={{ color: "#ccc" }}>Loading pending reviews…</div>}
            {!pendingReviewLoading && pendingReviewItems.length === 0 && (
              <div style={{ color: "#aaa", padding: "20px 0", textAlign: "center" }}>
                No lessons pending your review.
              </div>
            )}
            {!pendingReviewLoading && pendingReviewItems.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(169,142,100,0.25)" }}>
                    <th style={{ padding: "10px 6px" }}>Title</th>
                    <th style={{ padding: "10px 6px", width: "150px" }}>Author</th>
                    <th style={{ padding: "10px 6px", width: "200px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReviewItems.map((lesson) => (
                    <tr key={lesson.slug} style={{ borderBottom: "1px solid rgba(169,142,100,0.1)" }}>
                      <td style={{ padding: "10px 6px" }}>
                        <button
                          onClick={() => router.push(`/library/${lesson.slug}`)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#f4d18c",
                            cursor: "pointer",
                            fontSize: 15,
                            fontWeight: 600,
                            padding: 0,
                          }}
                        >
                          {lesson.title || lesson.slug}
                        </button>
                      </td>
                      <td style={{ padding: "10px 6px", color: "#c8c1b4", fontSize: 14 }}>
                        {lesson.author || "—"}
                      </td>
                      <td style={{ padding: "10px 6px" }}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            className="review-action-btn review-action-btn--approve"
                            disabled={reviewing}
                            onClick={() =>
                              dispatch(reviewLessonRequest({ slug: lesson.slug, action: "approve" }))
                            }
                          >
                            Approve
                          </button>
                          <button
                            className="review-action-btn review-action-btn--reject"
                            disabled={reviewing}
                            onClick={() =>
                              dispatch(reviewLessonRequest({ slug: lesson.slug, action: "reject" }))
                            }
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        )}

        <section
          className="admin-card"
          style={{
            padding: 18,
            backdropFilter: "blur(4px)",
            background: "rgba(26,33,30,0.65)",
            display: activeTab === "pending" && isAdmin ? "none" : "block",
          }}
        >
          {loading && <div style={{ color: "#ccc" }}>Loading lessons…</div>}
          {error && <div style={{ color: "#f88" }}>{error}</div>}
          {!loading && !error && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(169,142,100,0.25)" }}>
                  <th style={{ padding: "10px 6px", width: "80px" }}>ID</th>
                  <th style={{ padding: "10px 6px" }}>Title</th>
                  <th style={{ padding: "10px 6px", width: "180px" }}>Author</th>
                  {isAdmin && <th style={{ padding: "10px 6px", width: "140px" }}>Review</th>}
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
                      {isAdmin && (
                        <td style={{ padding: "10px 6px" }}>
                          <ReviewStatusBadge status={lesson.reviewStatus} />
                        </td>
                      )}
                      <td style={{ padding: "10px 6px", color: isUnpublished ? "#888" : "#aaa", fontSize: 14 }}>
                        {lesson.publishedDate ? new Date(lesson.publishedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "—"}
                      </td>
                    </tr>
                  );
                })}
                {lessons.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 5 : 4} style={{ padding: "10px 6px", color: "#aaa" }}>
                      {search ? `No lessons found matching "${search}"` : "No lessons found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}

          {/* Pagination Controls */}
          {!loading && !error && totalPages > 1 && (
            <div style={{ marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ color: "#aaa", fontSize: 14 }}>
                {total} lessons total{search && ` matching "${search}"`}, page {currentPage} of {totalPages}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => handlePageChange(1)}
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
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
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
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
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
                  onClick={() => handlePageChange(totalPages)}
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
