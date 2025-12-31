package handlers_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
	"gorm.io/gorm"

	"donfra-api/internal/domain/study"
	"donfra-api/internal/http/handlers"
	"donfra-api/internal/http/middleware"
)

// MockStudyService for testing
type MockStudyService struct {
	ListPublishedLessonsFunc                func(ctx context.Context, hasVipAccess bool) ([]study.Lesson, error)
	ListAllLessonsFunc                      func(ctx context.Context, hasVipAccess bool) ([]study.Lesson, error)
	ListPublishedLessonsPaginatedFunc       func(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error)
	ListAllLessonsPaginatedFunc             func(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error)
	ListPublishedLessonsSummaryPaginatedFunc func(ctx context.Context, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error)
	ListAllLessonsSummaryPaginatedFunc      func(ctx context.Context, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error)
	GetLessonBySlugFunc                     func(ctx context.Context, slug string, hasVipAccess bool) (*study.Lesson, error)
	CreateLessonFunc                        func(ctx context.Context, lesson *study.Lesson) (*study.Lesson, error)
	UpdateLessonBySlugFunc                  func(ctx context.Context, slug string, updates map[string]any) error
	DeleteLessonBySlugFunc                  func(ctx context.Context, slug string) error
}

func (m *MockStudyService) ListPublishedLessons(ctx context.Context, hasVipAccess bool) ([]study.Lesson, error) {
	if m.ListPublishedLessonsFunc != nil {
		return m.ListPublishedLessonsFunc(ctx, hasVipAccess)
	}
	return nil, nil
}

func (m *MockStudyService) ListAllLessons(ctx context.Context, hasVipAccess bool) ([]study.Lesson, error) {
	if m.ListAllLessonsFunc != nil {
		return m.ListAllLessonsFunc(ctx, hasVipAccess)
	}
	return nil, nil
}

func (m *MockStudyService) ListPublishedLessonsPaginated(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error) {
	if m.ListPublishedLessonsPaginatedFunc != nil {
		return m.ListPublishedLessonsPaginatedFunc(ctx, hasVipAccess, params)
	}
	return &study.PaginatedLessonsResponse{Lessons: []study.Lesson{}, Total: 0, Page: 1, Size: 10, TotalPages: 0}, nil
}

func (m *MockStudyService) ListAllLessonsPaginated(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error) {
	if m.ListAllLessonsPaginatedFunc != nil {
		return m.ListAllLessonsPaginatedFunc(ctx, hasVipAccess, params)
	}
	return &study.PaginatedLessonsResponse{Lessons: []study.Lesson{}, Total: 0, Page: 1, Size: 10, TotalPages: 0}, nil
}

func (m *MockStudyService) ListPublishedLessonsSummaryPaginated(ctx context.Context, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error) {
	if m.ListPublishedLessonsSummaryPaginatedFunc != nil {
		return m.ListPublishedLessonsSummaryPaginatedFunc(ctx, params)
	}
	return &study.PaginatedLessonsSummaryResponse{Lessons: []study.LessonSummary{}, Total: 0, Page: 1, Size: 10, TotalPages: 0}, nil
}

func (m *MockStudyService) ListAllLessonsSummaryPaginated(ctx context.Context, params study.PaginationParams) (*study.PaginatedLessonsSummaryResponse, error) {
	if m.ListAllLessonsSummaryPaginatedFunc != nil {
		return m.ListAllLessonsSummaryPaginatedFunc(ctx, params)
	}
	return &study.PaginatedLessonsSummaryResponse{Lessons: []study.LessonSummary{}, Total: 0, Page: 1, Size: 10, TotalPages: 0}, nil
}

func (m *MockStudyService) GetLessonBySlug(ctx context.Context, slug string, hasVipAccess bool) (*study.Lesson, error) {
	if m.GetLessonBySlugFunc != nil {
		return m.GetLessonBySlugFunc(ctx, slug, hasVipAccess)
	}
	return nil, nil
}

func (m *MockStudyService) CreateLesson(ctx context.Context, lesson *study.Lesson) (*study.Lesson, error) {
	if m.CreateLessonFunc != nil {
		return m.CreateLessonFunc(ctx, lesson)
	}
	return lesson, nil
}

func (m *MockStudyService) UpdateLessonBySlug(ctx context.Context, slug string, updates map[string]any) error {
	if m.UpdateLessonBySlugFunc != nil {
		return m.UpdateLessonBySlugFunc(ctx, slug, updates)
	}
	return nil
}

func (m *MockStudyService) DeleteLessonBySlug(ctx context.Context, slug string) error {
	if m.DeleteLessonBySlugFunc != nil {
		return m.DeleteLessonBySlugFunc(ctx, slug)
	}
	return nil
}

// TestListLessons_AsAdmin tests that admin sees all lessons
func TestListLessons_AsAdmin(t *testing.T) {
	allLessons := []study.Lesson{
		{Slug: "lesson-1", IsPublished: true},
		{Slug: "lesson-2", IsPublished: false}, // unpublished
	}

	mockStudy := &MockStudyService{
		ListAllLessonsPaginatedFunc: func(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error) {
			return &study.PaginatedLessonsResponse{
				Lessons:    allLessons,
				Total:      int64(len(allLessons)),
				Page:       params.Page,
				Size:       params.Size,
				TotalPages: 1,
			}, nil
		},
	}

	h := handlers.New(nil, mockStudy, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons", nil)
	// Simulate OptionalAdmin middleware setting admin context
	ctx := context.WithValue(req.Context(), middleware.IsAdminContextKey, true)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.ListLessonsHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var response study.PaginatedLessonsResponse
	json.NewDecoder(w.Body).Decode(&response)

	if len(response.Lessons) != 2 {
		t.Errorf("expected 2 lessons, got %d", len(response.Lessons))
	}
}

// TestListLessons_AsRegularUser tests that regular users see only published lessons
func TestListLessons_AsRegularUser(t *testing.T) {
	publishedLessons := []study.Lesson{
		{Slug: "lesson-1", IsPublished: true},
	}

	mockStudy := &MockStudyService{
		ListPublishedLessonsPaginatedFunc: func(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error) {
			return &study.PaginatedLessonsResponse{
				Lessons:    publishedLessons,
				Total:      int64(len(publishedLessons)),
				Page:       params.Page,
				Size:       params.Size,
				TotalPages: 1,
			}, nil
		},
	}

	h := handlers.New(nil, mockStudy, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons", nil)
	w := httptest.NewRecorder()

	h.ListLessonsHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var response study.PaginatedLessonsResponse
	json.NewDecoder(w.Body).Decode(&response)

	if len(response.Lessons) != 1 {
		t.Errorf("expected 1 lesson, got %d", len(response.Lessons))
	}
}

// TestListLessons_DatabaseError tests error handling
func TestListLessons_DatabaseError(t *testing.T) {
	mockStudy := &MockStudyService{
		ListPublishedLessonsPaginatedFunc: func(ctx context.Context, hasVipAccess bool, params study.PaginationParams) (*study.PaginatedLessonsResponse, error) {
			return nil, errors.New("database error")
		},
	}

	h := handlers.New(nil, mockStudy, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons", nil)
	w := httptest.NewRecorder()

	h.ListLessonsHandler(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}
}

// TestGetLessonBySlug_Published tests retrieving a published lesson
func TestGetLessonBySlug_Published(t *testing.T) {
	publishedLesson := &study.Lesson{
		Slug:        "test-lesson",
		Title:       "Test Lesson",
		IsPublished: true,
	}

	mockStudy := &MockStudyService{
		GetLessonBySlugFunc: func(ctx context.Context, slug string, hasVipAccess bool) (*study.Lesson, error) {
			if slug == "test-lesson" {
				return publishedLesson, nil
			}
			return nil, gorm.ErrRecordNotFound
		},
	}

	h := handlers.New(nil, mockStudy, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons/test-lesson", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "test-lesson")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.GetLessonBySlugHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var lesson study.Lesson
	json.NewDecoder(w.Body).Decode(&lesson)

	if lesson.Slug != "test-lesson" {
		t.Errorf("expected slug 'test-lesson', got '%s'", lesson.Slug)
	}
}

// TestGetLessonBySlug_UnpublishedAsRegularUser tests that regular users cannot access unpublished lessons
func TestGetLessonBySlug_UnpublishedAsRegularUser(t *testing.T) {
	unpublishedLesson := &study.Lesson{
		Slug:        "unpublished-lesson",
		Title:       "Unpublished",
		IsPublished: false,
	}

	mockStudy := &MockStudyService{
		GetLessonBySlugFunc: func(ctx context.Context, slug string, hasVipAccess bool) (*study.Lesson, error) {
			return unpublishedLesson, nil
		},
	}

	h := handlers.New(nil, mockStudy, nil, nil, nil, nil,)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons/unpublished-lesson", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "unpublished-lesson")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.GetLessonBySlugHandler(w, req)

	// Regular users should get 404 for unpublished lessons
	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", w.Code)
	}
}

// TestGetLessonBySlug_UnpublishedAsAdmin tests that admin can access unpublished lessons
func TestGetLessonBySlug_UnpublishedAsAdmin(t *testing.T) {
	unpublishedLesson := &study.Lesson{
		Slug:        "unpublished-lesson",
		Title:       "Unpublished",
		IsPublished: false,
	}

	mockStudy := &MockStudyService{
		GetLessonBySlugFunc: func(ctx context.Context, slug string, hasVipAccess bool) (*study.Lesson, error) {
			return unpublishedLesson, nil
		},
	}

	h := handlers.New(nil, mockStudy, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons/unpublished-lesson", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "unpublished-lesson")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	// Simulate admin context
	ctx = context.WithValue(ctx, middleware.IsAdminContextKey, true)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.GetLessonBySlugHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200 for admin, got %d", w.Code)
	}
}

// TestGetLessonBySlug_NotFound tests 404 handling
func TestGetLessonBySlug_NotFound(t *testing.T) {
	mockStudy := &MockStudyService{
		GetLessonBySlugFunc: func(ctx context.Context, slug string, hasVipAccess bool) (*study.Lesson, error) {
			return nil, gorm.ErrRecordNotFound
		},
	}

	h := handlers.New(nil, mockStudy, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons/nonexistent", nil)
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "nonexistent")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))
	w := httptest.NewRecorder()

	h.GetLessonBySlugHandler(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", w.Code)
	}
}
