package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	"go.opentelemetry.io/otel/attribute"
	"gorm.io/gorm"

	"donfra-api/internal/domain/study"
	"donfra-api/internal/http/middleware"
	"donfra-api/internal/pkg/httputil"
	"donfra-api/internal/pkg/tracing"
)

// isAdminUser checks if the user is admin by checking both:
// 1. Admin token context (from OptionalAdmin middleware)
// 2. User role context (from OptionalAuth middleware)
func isAdminUser(ctx context.Context) bool {
	// Check admin token first
	if middleware.IsAdminFromContext(ctx) {
		return true
	}

	// Check user role
	role, ok := ctx.Value("user_role").(string)
	return ok && role == "admin"
}

// isVipUser checks if the user has VIP access (admin or vip role)
func isVipUser(ctx context.Context) bool {
	// Admins automatically have VIP access
	if isAdminUser(ctx) {
		return true
	}

	// Check user role
	role, ok := ctx.Value("user_role").(string)
	return ok && role == "vip"
}

// ListLessonsHandler handles GET /api/lessons and returns lessons based on auth status.
// Admin users see all lessons (published + unpublished), regular users see only published.
// VIP lessons show limited content to non-VIP users.
// Requires OptionalAuth middleware to set context.
func (h *Handlers) ListLessonsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.ListLessons")
	defer span.End()

	if h.studySvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "study service unavailable")
		return
	}

	// Check admin and VIP status
	_, authSpan := tracing.StartSpan(ctx, "handler.CheckAuth")
	isAdmin := isAdminUser(ctx)
	hasVipAccess := isVipUser(ctx)
	authSpan.SetAttributes(
		tracing.AttrIsAdmin.Bool(isAdmin),
		attribute.Bool("has_vip_access", hasVipAccess),
	)
	authSpan.End()

	var lessons []study.Lesson
	var err error
	if isAdmin {
		lessons, err = h.studySvc.ListAllLessons(ctx, hasVipAccess)
	} else {
		lessons, err = h.studySvc.ListPublishedLessons(ctx, hasVipAccess)
	}

	if err != nil {
		tracing.RecordError(span, err)
		httputil.WriteError(w, http.StatusInternalServerError, "failed to load lessons")
		return
	}

	// Serialize response
	_, jsonSpan := tracing.StartSpan(ctx, "handler.SerializeJSON",
		tracing.AttrResponseCount.Int(len(lessons)),
	)
	httputil.WriteJSON(w, http.StatusOK, lessons)
	jsonSpan.End()
}

// GetLessonBySlugHandler handles GET /api/lessons/{slug} and returns the lesson.
// Unpublished lessons can only be accessed by admin users.
// VIP lessons show limited content to non-VIP users (title only, no markdown/excalidraw).
// Requires OptionalAuth middleware to set context.
func (h *Handlers) GetLessonBySlugHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.GetLessonBySlug")
	defer span.End()

	if h.studySvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "study service unavailable")
		return
	}

	// Parse URL parameter
	_, parseSpan := tracing.StartSpan(ctx, "handler.ParseSlugParam")
	slug := chi.URLParam(r, "slug")
	parseSpan.SetAttributes(tracing.AttrLessonSlug.String(slug))
	parseSpan.End()

	if slug == "" {
		httputil.WriteError(w, http.StatusBadRequest, "slug is required")
		return
	}

	// Check admin and VIP status
	_, authSpan := tracing.StartSpan(ctx, "handler.CheckAccess")
	isAdmin := isAdminUser(ctx)
	hasVipAccess := isVipUser(ctx)
	authSpan.SetAttributes(
		tracing.AttrIsAdmin.Bool(isAdmin),
		attribute.Bool("has_vip_access", hasVipAccess),
	)
	authSpan.End()

	lesson, err := h.studySvc.GetLessonBySlug(ctx, slug, hasVipAccess)
	if err != nil {
		tracing.RecordError(span, err)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "lesson not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to load lesson")
		return
	}

	// If lesson is unpublished, verify admin access
	if !lesson.IsPublished && !isAdmin {
		httputil.WriteError(w, http.StatusNotFound, "lesson not found")
		return
	}

	_, jsonSpan := tracing.StartSpan(ctx, "handler.SerializeJSON")
	httputil.WriteJSON(w, http.StatusOK, lesson)
	jsonSpan.End()
}

// CreateLessonHandler handles POST /api/lesson. Requires AdminOnly middleware.
func (h *Handlers) CreateLessonHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.CreateLesson")
	defer span.End()

	if h.studySvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "study service unavailable")
		return
	}

	// Parse JSON body
	_, parseSpan := tracing.StartSpan(ctx, "handler.ParseJSONBody")
	var req study.CreateLessonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		tracing.RecordError(parseSpan, err)
		parseSpan.End()
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	parseSpan.SetAttributes(
		tracing.AttrLessonSlug.String(req.Slug),
		attribute.Bool("is_vip", req.IsVip),
	)
	parseSpan.End()

	newLesson := &study.Lesson{
		Slug:        req.Slug,
		Title:       req.Title,
		Markdown:    req.Markdown,
		Excalidraw:  req.Excalidraw,
		IsPublished: req.IsPublished,
		IsVip:       req.IsVip,
	}
	
	created, err := h.studySvc.CreateLesson(ctx, newLesson)
	if err != nil {
		tracing.RecordError(span, err)
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			httputil.WriteError(w, http.StatusConflict, "slug already exists")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to create lesson")
		return
	}

	_, jsonSpan := tracing.StartSpan(ctx, "handler.SerializeJSON")
	httputil.WriteJSON(w, http.StatusCreated, created)
	jsonSpan.End()
}

// UpdateLessonHandler handles PATCH /api/lessons/{slug}. Requires AdminOnly middleware.
func (h *Handlers) UpdateLessonHandler(w http.ResponseWriter, r *http.Request) {
	if h.studySvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "study service unavailable")
		return
	}
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		httputil.WriteError(w, http.StatusBadRequest, "slug is required")
		return
	}

	var req study.UpdateLessonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	updates := map[string]any{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Markdown != "" {
		updates["markdown"] = req.Markdown
	}
	if len(req.Excalidraw) > 0 {
		updates["excalidraw"] = req.Excalidraw
	}
	if req.IsPublished != nil {
		updates["is_published"] = *req.IsPublished
	}
	if req.IsVip != nil {
		updates["is_vip"] = *req.IsVip
	}

	if len(updates) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "no fields to update")
		return
	}

	if err := h.studySvc.UpdateLessonBySlug(r.Context(), slug, updates); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "lesson not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to update lesson")
		return
	}

	httputil.WriteJSON(w, http.StatusOK, study.UpdateLessonResponse{
		Slug:    slug,
		Updated: true,
	})
}

// DeleteLessonHandler handles DELETE /api/lessons/{slug}. Requires AdminOnly middleware.
func (h *Handlers) DeleteLessonHandler(w http.ResponseWriter, r *http.Request) {
	if h.studySvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "study service unavailable")
		return
	}
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		httputil.WriteError(w, http.StatusBadRequest, "slug is required")
		return
	}

	if err := h.studySvc.DeleteLessonBySlug(r.Context(), slug); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "lesson not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to delete lesson")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
