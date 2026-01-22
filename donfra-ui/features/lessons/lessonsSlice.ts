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
  // Clear Errors
  clearListError,
  clearDetailError,
  clearSaveError,
  clearDeleteError,
} = lessonsSlice.actions;

export default lessonsSlice.reducer;
