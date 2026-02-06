import type { RootState } from "@/store";

// ============ List Selectors ============
export const selectLessons = (state: RootState) => state.lessons.items;
export const selectLessonsLoading = (state: RootState) => state.lessons.listLoading;
export const selectLessonsError = (state: RootState) => state.lessons.listError;

// ============ Pagination Selectors ============
export const selectPagination = (state: RootState) => state.lessons.pagination;
export const selectCurrentPage = (state: RootState) =>
  state.lessons.pagination.currentPage;
export const selectPageSize = (state: RootState) =>
  state.lessons.pagination.pageSize;
export const selectTotalPages = (state: RootState) =>
  state.lessons.pagination.totalPages;
export const selectTotal = (state: RootState) => state.lessons.pagination.total;

// ============ Filter Selectors ============
export const selectFilters = (state: RootState) => state.lessons.filters;
export const selectSearch = (state: RootState) => state.lessons.filters.search;
export const selectSortBy = (state: RootState) => state.lessons.filters.sortBy;
export const selectSortDesc = (state: RootState) => state.lessons.filters.sortDesc;

// ============ Single Lesson Selectors ============
export const selectLessonBySlug = (slug: string) => (state: RootState) =>
  state.lessons.bySlug[slug];
export const selectDetailLoading = (state: RootState) =>
  state.lessons.detailLoading;
export const selectDetailError = (state: RootState) => state.lessons.detailError;

// ============ Operation State Selectors ============
export const selectSaving = (state: RootState) => state.lessons.saving;
export const selectSaveError = (state: RootState) => state.lessons.saveError;
export const selectDeleting = (state: RootState) => state.lessons.deleting;
export const selectDeleteError = (state: RootState) => state.lessons.deleteError;

// ============ Review Workflow Selectors ============
export const selectSubmittingForReview = (state: RootState) =>
  state.lessons.submittingForReview;
export const selectSubmitReviewError = (state: RootState) =>
  state.lessons.submitReviewError;
export const selectReviewing = (state: RootState) => state.lessons.reviewing;
export const selectReviewError = (state: RootState) =>
  state.lessons.reviewError;
export const selectPendingReviewItems = (state: RootState) =>
  state.lessons.pendingReviewItems;
export const selectPendingReviewLoading = (state: RootState) =>
  state.lessons.pendingReviewLoading;
export const selectPendingReviewPagination = (state: RootState) =>
  state.lessons.pendingReviewPagination;

// ============ Computed Selectors ============
export const selectHasLessons = (state: RootState) =>
  state.lessons.items.length > 0;
export const selectIsFirstPage = (state: RootState) =>
  state.lessons.pagination.currentPage === 1;
export const selectIsLastPage = (state: RootState) =>
  state.lessons.pagination.currentPage >= state.lessons.pagination.totalPages;
