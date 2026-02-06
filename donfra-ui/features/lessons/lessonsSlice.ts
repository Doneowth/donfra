import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type {
  LessonsState,
  LessonSummary,
  Lesson,
  LessonCreateData,
  LessonUpdateData,
} from "./lessonsTypes";

const initialState: LessonsState = {
  // List
  items: [],
  pagination: {
    currentPage: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  filters: {
    search: "",
    sortBy: "createdAt",
    sortDesc: true,
  },
  listLoading: false,
  listError: null,

  // Single lesson cache
  bySlug: {},
  detailLoading: false,
  detailError: null,

  // Operation states
  saving: false,
  saveError: null,
  deleting: null,
  deleteError: null,

  // Review workflow
  submittingForReview: false,
  submitReviewError: null,
  reviewing: false,
  reviewError: null,
  pendingReviewItems: [],
  pendingReviewPagination: {
    currentPage: 1,
    pageSize: 10,
    total: 0,
    totalPages: 0,
  },
  pendingReviewLoading: false,
  pendingReviewError: null,
};

const lessonsSlice = createSlice({
  name: "lessons",
  initialState,
  reducers: {
    // ============ List Actions ============
    fetchLessonsRequest(state) {
      state.listLoading = true;
      state.listError = null;
    },
    fetchLessonsSuccess(
      state,
      action: PayloadAction<{
        lessons: LessonSummary[];
        total: number;
        page: number;
        size: number;
        totalPages: number;
      }>
    ) {
      state.listLoading = false;
      state.items = action.payload.lessons;
      state.pagination.currentPage = action.payload.page;
      state.pagination.pageSize = action.payload.size;
      state.pagination.total = action.payload.total;
      state.pagination.totalPages = action.payload.totalPages;
    },
    fetchLessonsFailure(state, action: PayloadAction<string>) {
      state.listLoading = false;
      state.listError = action.payload;
    },

    // ============ Pagination & Filters ============
    setPage(state, action: PayloadAction<number>) {
      state.pagination.currentPage = action.payload;
    },
    setPageSize(state, action: PayloadAction<number>) {
      state.pagination.pageSize = action.payload;
      state.pagination.currentPage = 1; // Reset to first page
    },
    setSearch(state, action: PayloadAction<string>) {
      state.filters.search = action.payload;
      state.pagination.currentPage = 1; // Reset to first page
    },
    setSortBy(state, action: PayloadAction<{ field: string; desc: boolean }>) {
      state.filters.sortBy = action.payload.field;
      state.filters.sortDesc = action.payload.desc;
    },
    clearFilters(state) {
      state.filters = initialState.filters;
      state.pagination.currentPage = 1;
    },

    // ============ Single Lesson Actions ============
    fetchLessonRequest(state, _action: PayloadAction<string>) {
      state.detailLoading = true;
      state.detailError = null;
    },
    fetchLessonSuccess(state, action: PayloadAction<Lesson>) {
      state.detailLoading = false;
      state.bySlug[action.payload.slug] = action.payload;
    },
    fetchLessonFailure(state, action: PayloadAction<string>) {
      state.detailLoading = false;
      state.detailError = action.payload;
    },
    clearLessonDetail(state, action: PayloadAction<string>) {
      delete state.bySlug[action.payload];
    },

    // ============ Create Lesson ============
    createLessonRequest(state, _action: PayloadAction<LessonCreateData>) {
      state.saving = true;
      state.saveError = null;
    },
    createLessonSuccess(state, action: PayloadAction<Lesson>) {
      state.saving = false;
      state.bySlug[action.payload.slug] = action.payload;
    },
    createLessonFailure(state, action: PayloadAction<string>) {
      state.saving = false;
      state.saveError = action.payload;
    },

    // ============ Update Lesson ============
    updateLessonRequest(
      state,
      _action: PayloadAction<{ slug: string; data: LessonUpdateData }>
    ) {
      state.saving = true;
      state.saveError = null;
    },
    updateLessonSuccess(state, action: PayloadAction<Lesson>) {
      state.saving = false;
      state.bySlug[action.payload.slug] = action.payload;
      // Also update in list if present
      const index = state.items.findIndex(
        (item) => item.slug === action.payload.slug
      );
      if (index !== -1) {
        state.items[index] = {
          ...state.items[index],
          title: action.payload.title,
          isPublished: action.payload.isPublished,
          isVip: action.payload.isVip,
          author: action.payload.author,
          publishedDate: action.payload.publishedDate,
          updatedAt: action.payload.updatedAt,
        };
      }
    },
    updateLessonFailure(state, action: PayloadAction<string>) {
      state.saving = false;
      state.saveError = action.payload;
    },

    // ============ Delete Lesson ============
    deleteLessonRequest(state, action: PayloadAction<string>) {
      state.deleting = action.payload;
      state.deleteError = null;
    },
    deleteLessonSuccess(state, action: PayloadAction<string>) {
      state.deleting = null;
      delete state.bySlug[action.payload];
      state.items = state.items.filter((item) => item.slug !== action.payload);
      state.pagination.total = Math.max(0, state.pagination.total - 1);
    },
    deleteLessonFailure(state, action: PayloadAction<string>) {
      state.deleting = null;
      state.deleteError = action.payload;
    },

    // ============ Submit for Review ============
    submitForReviewRequest(state, _action: PayloadAction<string>) {
      state.submittingForReview = true;
      state.submitReviewError = null;
    },
    submitForReviewSuccess(
      state,
      action: PayloadAction<{ slug: string; reviewStatus: string }>
    ) {
      state.submittingForReview = false;
      if (state.bySlug[action.payload.slug]) {
        state.bySlug[action.payload.slug].reviewStatus =
          action.payload.reviewStatus as any;
      }
      const idx = state.items.findIndex(
        (i) => i.slug === action.payload.slug
      );
      if (idx !== -1) {
        state.items[idx].reviewStatus =
          action.payload.reviewStatus as any;
      }
    },
    submitForReviewFailure(state, action: PayloadAction<string>) {
      state.submittingForReview = false;
      state.submitReviewError = action.payload;
    },

    // ============ Review (Approve/Reject) ============
    reviewLessonRequest(
      state,
      _action: PayloadAction<{ slug: string; action: "approve" | "reject" }>
    ) {
      state.reviewing = true;
      state.reviewError = null;
    },
    reviewLessonSuccess(
      state,
      action: PayloadAction<{ slug: string; reviewStatus: string }>
    ) {
      state.reviewing = false;
      state.pendingReviewItems = state.pendingReviewItems.filter(
        (i) => i.slug !== action.payload.slug
      );
      if (state.bySlug[action.payload.slug]) {
        state.bySlug[action.payload.slug].reviewStatus =
          action.payload.reviewStatus as any;
      }
      const idx = state.items.findIndex(
        (i) => i.slug === action.payload.slug
      );
      if (idx !== -1) {
        state.items[idx].reviewStatus =
          action.payload.reviewStatus as any;
      }
    },
    reviewLessonFailure(state, action: PayloadAction<string>) {
      state.reviewing = false;
      state.reviewError = action.payload;
    },

    // ============ Fetch Pending Review ============
    fetchPendingReviewRequest(state) {
      state.pendingReviewLoading = true;
      state.pendingReviewError = null;
    },
    fetchPendingReviewSuccess(
      state,
      action: PayloadAction<{
        lessons: LessonSummary[];
        total: number;
        page: number;
        size: number;
        totalPages: number;
      }>
    ) {
      state.pendingReviewLoading = false;
      state.pendingReviewItems = action.payload.lessons;
      state.pendingReviewPagination = {
        currentPage: action.payload.page,
        pageSize: action.payload.size,
        total: action.payload.total,
        totalPages: action.payload.totalPages,
      };
    },
    fetchPendingReviewFailure(state, action: PayloadAction<string>) {
      state.pendingReviewLoading = false;
      state.pendingReviewError = action.payload;
    },

    // ============ Clear Errors ============
    clearListError(state) {
      state.listError = null;
    },
    clearDetailError(state) {
      state.detailError = null;
    },
    clearSaveError(state) {
      state.saveError = null;
    },
    clearDeleteError(state) {
      state.deleteError = null;
    },
  },
});

export const {
  // List
  fetchLessonsRequest,
  fetchLessonsSuccess,
  fetchLessonsFailure,
  // Pagination & Filters
  setPage,
  setPageSize,
  setSearch,
  setSortBy,
  clearFilters,
  // Single Lesson
  fetchLessonRequest,
  fetchLessonSuccess,
  fetchLessonFailure,
  clearLessonDetail,
  // Create
  createLessonRequest,
  createLessonSuccess,
  createLessonFailure,
  // Update
  updateLessonRequest,
  updateLessonSuccess,
  updateLessonFailure,
  // Delete
  deleteLessonRequest,
  deleteLessonSuccess,
  deleteLessonFailure,
  // Review workflow
  submitForReviewRequest,
  submitForReviewSuccess,
  submitForReviewFailure,
  reviewLessonRequest,
  reviewLessonSuccess,
  reviewLessonFailure,
  fetchPendingReviewRequest,
  fetchPendingReviewSuccess,
  fetchPendingReviewFailure,
  // Clear Errors
  clearListError,
  clearDetailError,
  clearSaveError,
  clearDeleteError,
} = lessonsSlice.actions;

export default lessonsSlice.reducer;
