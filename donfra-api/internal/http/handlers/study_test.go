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
	ListPublishedLessonsFunc func(ctx context.Context) ([]study.Lesson, error)
	ListAllLessonsFunc       func(ctx context.Context) ([]study.Lesson, error)
	GetLessonBySlugFunc      func(ctx context.Context, slug string) (*study.Lesson, error)
	CreateLessonFunc         func(ctx context.Context, lesson *study.Lesson) (*study.Lesson, error)
	UpdateLessonBySlugFunc   func(ctx context.Context, slug string, updates map[string]any) error
	DeleteLessonBySlugFunc   func(ctx context.Context, slug string) error
}

func (m *MockStudyService) ListPublishedLessons(ctx context.Context) ([]study.Lesson, error) {
	if m.ListPublishedLessonsFunc != nil {
		return m.ListPublishedLessonsFunc(ctx)
	}
	return nil, nil
}

func (m *MockStudyService) ListAllLessons(ctx context.Context) ([]study.Lesson, error) {
	if m.ListAllLessonsFunc != nil {
		return m.ListAllLessonsFunc(ctx)
	}
	return nil, nil
}

func (m *MockStudyService) GetLessonBySlug(ctx context.Context, slug string) (*study.Lesson, error) {
	if m.GetLessonBySlugFunc != nil {
		return m.GetLessonBySlugFunc(ctx, slug)
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
		ListAllLessonsFunc: func(ctx context.Context) ([]study.Lesson, error) {
			return allLessons, nil
		},
	}

	h := handlers.New(nil, mockStudy, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons", nil)
	// Simulate OptionalAdmin middleware setting admin context
	ctx := context.WithValue(req.Context(), middleware.IsAdminContextKey, true)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()

	h.ListLessonsHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var lessons []study.Lesson
	json.NewDecoder(w.Body).Decode(&lessons)

	if len(lessons) != 2 {
		t.Errorf("admin should see all 2 lessons, got %d", len(lessons))
	}
}

// TestListLessons_AsRegularUser tests that regular users only see published lessons
func TestListLessons_AsRegularUser(t *testing.T) {
	publishedLessons := []study.Lesson{
		{Slug: "lesson-1", IsPublished: true},
	}

	mockStudy := &MockStudyService{
		ListPublishedLessonsFunc: func(ctx context.Context) ([]study.Lesson, error) {
			return publishedLessons, nil
		},
	}

	h := handlers.New(nil, mockStudy, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons", nil)
	// No admin flag in context (regular user)
	w := httptest.NewRecorder()

	h.ListLessonsHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var lessons []study.Lesson
	json.NewDecoder(w.Body).Decode(&lessons)

	if len(lessons) != 1 {
		t.Errorf("regular user should see only 1 published lesson, got %d", len(lessons))
	}

	if lessons[0].IsPublished != true {
		t.Error("regular user should only see published lessons")
	}
}

// TestListLessons_DatabaseError tests error handling
func TestListLessons_DatabaseError(t *testing.T) {
	mockStudy := &MockStudyService{
		ListPublishedLessonsFunc: func(ctx context.Context) ([]study.Lesson, error) {
			return nil, errors.New("database connection failed")
		},
	}

	h := handlers.New(nil, mockStudy, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons", nil)
	w := httptest.NewRecorder()

	h.ListLessonsHandler(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", w.Code)
	}
}

// TestGetLessonBySlug_Published tests getting a published lesson
func TestGetLessonBySlug_Published(t *testing.T) {
	lesson := &study.Lesson{
		Slug:        "test-lesson",
		Title:       "Test Lesson",
		IsPublished: true,
	}

	mockStudy := &MockStudyService{
		GetLessonBySlugFunc: func(ctx context.Context, slug string) (*study.Lesson, error) {
			if slug == "test-lesson" {
				return lesson, nil
			}
			return nil, errors.New("not found")
		},
	}

	h := handlers.New(nil, mockStudy, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons/test-lesson", nil)

	// Set URL parameter using chi's context
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "test-lesson")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	h.GetLessonBySlugHandler(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", w.Code)
	}

	var result study.Lesson
	json.NewDecoder(w.Body).Decode(&result)

	if result.Slug != "test-lesson" {
		t.Errorf("expected slug 'test-lesson', got '%s'", result.Slug)
	}
}

// TestGetLessonBySlug_UnpublishedAsRegularUser tests access control
func TestGetLessonBySlug_UnpublishedAsRegularUser(t *testing.T) {
	lesson := &study.Lesson{
		Slug:        "unpublished",
		IsPublished: false,
	}

	mockStudy := &MockStudyService{
		GetLessonBySlugFunc: func(ctx context.Context, slug string) (*study.Lesson, error) {
			return lesson, nil
		},
	}

	h := handlers.New(nil, mockStudy, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons/unpublished", nil)

	// Set URL parameter
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "unpublished")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	// No admin flag (regular user)
	w := httptest.NewRecorder()

	h.GetLessonBySlugHandler(w, req)

	// Regular user should get 404 for unpublished lessons
	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404 for unpublished lesson, got %d", w.Code)
	}
}

// TestGetLessonBySlug_UnpublishedAsAdmin tests admin can access unpublished
func TestGetLessonBySlug_UnpublishedAsAdmin(t *testing.T) {
	lesson := &study.Lesson{
		Slug:        "unpublished",
		IsPublished: false,
	}

	mockStudy := &MockStudyService{
		GetLessonBySlugFunc: func(ctx context.Context, slug string) (*study.Lesson, error) {
			return lesson, nil
		},
	}

	h := handlers.New(nil, mockStudy, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons/unpublished", nil)

	// Set URL parameter and admin flag
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "unpublished")
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	ctx = context.WithValue(ctx, middleware.IsAdminContextKey, true)
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()

	h.GetLessonBySlugHandler(w, req)

	// Admin should be able to access unpublished lessons
	if w.Code != http.StatusOK {
		t.Errorf("admin should access unpublished lesson, got status %d", w.Code)
	}
}

// TestGetLessonBySlug_NotFound tests 404 handling
func TestGetLessonBySlug_NotFound(t *testing.T) {
	mockStudy := &MockStudyService{
		GetLessonBySlugFunc: func(ctx context.Context, slug string) (*study.Lesson, error) {
			// Return GORM's ErrRecordNotFound to match handler's error check
			return nil, gorm.ErrRecordNotFound
		},
	}

	h := handlers.New(nil, mockStudy, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/lessons/nonexistent", nil)

	// Set URL parameter
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add("slug", "nonexistent")
	req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, rctx))

	w := httptest.NewRecorder()

	h.GetLessonBySlugHandler(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404, got %d", w.Code)
	}
}
