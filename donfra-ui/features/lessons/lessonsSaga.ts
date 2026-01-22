import { call, put, select, takeLatest, takeEvery } from "redux-saga/effects";
import { PayloadAction } from "@reduxjs/toolkit";
import { api } from "@/lib/api";
import type { RootState } from "@/store";
import type { LessonCreateData, LessonUpdateData, Lesson } from "./lessonsTypes";
import {
  fetchLessonsRequest,
  fetchLessonsSuccess,
  fetchLessonsFailure,
  fetchLessonRequest,
  fetchLessonSuccess,
  fetchLessonFailure,
  createLessonRequest,
  createLessonSuccess,
  createLessonFailure,
  updateLessonRequest,
  updateLessonSuccess,
  updateLessonFailure,
  deleteLessonRequest,
  deleteLessonSuccess,
  deleteLessonFailure,
  setPage,
  setPageSize,
  setSearch,
  setSortBy,
} from "./lessonsSlice";

// ============ Fetch List ============
function* fetchLessonsSaga() {
  try {
    const state: RootState = yield select();
    const { currentPage, pageSize } = state.lessons.pagination;
    const { search, sortBy, sortDesc } = state.lessons.filters;

    const result: Awaited<ReturnType<typeof api.study.listSummary>> = yield call(
      api.study.listSummary,
      currentPage,
      pageSize,
      sortBy,
      sortDesc,
      search || undefined
    );

    yield put(fetchLessonsSuccess(result));
  } catch (error) {
    yield put(
      fetchLessonsFailure(
        error instanceof Error ? error.message : "Failed to fetch lessons"
      )
    );
  }
}

// ============ Fetch Single Lesson ============
function* fetchLessonSaga(action: PayloadAction<string>) {
  try {
    const slug = action.payload;

    // Check cache first
    const state: RootState = yield select();
    const cached = state.lessons.bySlug[slug];
    if (cached) {
      // Still dispatch success to ensure loading state is cleared
      yield put(fetchLessonSuccess(cached));
      return;
    }

    const lesson: Lesson = yield call(api.study.get, slug);
    yield put(fetchLessonSuccess(lesson));
  } catch (error) {
    yield put(
      fetchLessonFailure(
        error instanceof Error ? error.message : "Failed to fetch lesson"
      )
    );
  }
}

// ============ Create Lesson ============
function* createLessonSaga(action: PayloadAction<LessonCreateData>) {
  try {
    const data = action.payload;
    yield call(api.study.create, data);

    // Fetch the created lesson to get full data
    const lesson: Lesson = yield call(api.study.get, data.slug);
    yield put(createLessonSuccess(lesson));

    // Refresh list to include new lesson
    yield put(fetchLessonsRequest());
  } catch (error) {
    yield put(
      createLessonFailure(
        error instanceof Error ? error.message : "Failed to create lesson"
      )
    );
  }
}

// ============ Update Lesson ============
function* updateLessonSaga(
  action: PayloadAction<{ slug: string; data: LessonUpdateData }>
) {
  try {
    const { slug, data } = action.payload;
    yield call(api.study.update, slug, data);

    // Fetch updated lesson to get full data
    const lesson: Lesson = yield call(api.study.get, slug);
    yield put(updateLessonSuccess(lesson));
  } catch (error) {
    yield put(
      updateLessonFailure(
        error instanceof Error ? error.message : "Failed to update lesson"
      )
    );
  }
}

// ============ Delete Lesson ============
function* deleteLessonSaga(action: PayloadAction<string>) {
  try {
    const slug = action.payload;
    yield call(api.study.delete, slug);
    yield put(deleteLessonSuccess(slug));
  } catch (error) {
    yield put(
      deleteLessonFailure(
        error instanceof Error ? error.message : "Failed to delete lesson"
      )
    );
  }
}

// ============ Refetch on Filter/Pagination Change ============
function* refetchOnChangeSaga() {
  yield put(fetchLessonsRequest());
}

// ============ Root Saga ============
export default function* lessonsSaga() {
  // Fetch list
  yield takeLatest(fetchLessonsRequest.type, fetchLessonsSaga);

  // Fetch single lesson
  yield takeLatest(fetchLessonRequest.type, fetchLessonSaga);

  // CRUD operations
  yield takeEvery(createLessonRequest.type, createLessonSaga);
  yield takeEvery(updateLessonRequest.type, updateLessonSaga);
  yield takeEvery(deleteLessonRequest.type, deleteLessonSaga);

  // Refetch on pagination/filter changes
  yield takeLatest(setPage.type, refetchOnChangeSaga);
  yield takeLatest(setPageSize.type, refetchOnChangeSaga);
  yield takeLatest(setSearch.type, refetchOnChangeSaga);
  yield takeLatest(setSortBy.type, refetchOnChangeSaga);
}
