package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"go.opentelemetry.io/otel/attribute"
	"gorm.io/gorm"

	"donfra-api/internal/domain/study"
	"donfra-api/internal/pkg/httputil"
	"donfra-api/internal/pkg/tracing"
)

// parsePaginationParam parses a query param string to int, returns defaultVal if invalid.
func parsePaginationParam(param string, defaultVal int) int {
	if param == "" {
		return defaultVal
	}
	val, err := strconv.Atoi(param)
	if err != nil || val < 1 {
		return defaultVal
	}
	return val
}

// isAdminOrAbove checks if the user has admin or god role
func isAdminOrAbove(ctx context.Context) bool {
	role, ok := ctx.Value("user_role").(string)
	return ok && (role == "admin" || role == "god")
}

// isVipOrAbove checks if the user has VIP access (vip, admin, or god role)
func isVipOrAbove(ctx context.Context) bool {
	role, ok := ctx.Value("user_role").(string)
	return ok && (role == "vip" || role == "admin" || role == "god")
}

// ListLessonsSummaryHandler handles GET /api/lessons/summary and returns lightweight lesson summaries.
// This endpoint excludes markdown and excalidraw fields to optimize for list views.
// Admin users see all lessons (published + unpublished), regular users see only published.
// Supports pagination via query params: ?page=1&size=10
// Requires OptionalAuth middleware to set context.
func (h *Handlers) ListLessonsSummaryHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.ListLessonsSummary")
	defer span.End()

	if h.studySvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "study service unavailable")
		return
	}

	// Parse pagination params from query string
	_, parseSpan := tracing.StartSpan(ctx, "handler.ParsePaginationParams")
	page := parsePaginationParam(r.URL.Query().Get("page"), 1)
	size := parsePaginationParam(r.URL.Query().Get("size"), 10)
	parseSpan.SetAttributes(
		attribute.Int("page", page),
		attribute.Int("size", size),
	)
	parseSpan.End()

	// Check admin status
	_, authSpan := tracing.StartSpan(ctx, "handler.CheckAuth")
	isAdmin := isAdminOrAbove(ctx)
	authSpan.SetAttributes(tracing.AttrIsAdmin.Bool(isAdmin))
	authSpan.End()

	// Build pagination params
	params := study.PaginationParams{
		Page: page,
		Size: size,
	}

	var response *study.PaginatedLessonsSummaryResponse
	var err error
	if isAdmin {
		response, err = h.studySvc.ListAllLessonsSummaryPaginated(ctx, params)
	} else {
		response, err = h.studySvc.ListPublishedLessonsSummaryPaginated(ctx, params)
	}

	if err != nil {
		tracing.RecordError(span, err)
		httputil.WriteError(w, http.StatusInternalServerError, "failed to load lessons")
		return
	}

	// Serialize response
	_, jsonSpan := tracing.StartSpan(ctx, "handler.SerializeJSON",
		tracing.AttrResponseCount.Int(len(response.Lessons)),
		attribute.Int64("total", response.Total),
		attribute.Int("total_pages", response.TotalPages),
	)
	httputil.WriteJSON(w, http.StatusOK, response)
	jsonSpan.End()
}

// ListLessonsHandler handles GET /api/lessons and returns lessons based on auth status.
// Admin users see all lessons (published + unpublished), regular users see only published.
// VIP lessons show limited content to non-VIP users.
// Supports pagination via query params: ?page=1&size=10
// Requires OptionalAuth middleware to set context.
func (h *Handlers) ListLessonsHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.ListLessons")
	defer span.End()

	if h.studySvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "study service unavailable")
		return
	}

	// Parse pagination params from query string
	_, parseSpan := tracing.StartSpan(ctx, "handler.ParsePaginationParams")
	page := parsePaginationParam(r.URL.Query().Get("page"), 1)
	size := parsePaginationParam(r.URL.Query().Get("size"), 10)
	parseSpan.SetAttributes(
		attribute.Int("page", page),
		attribute.Int("size", size),
	)
	parseSpan.End()

	// Check admin and VIP status
	_, authSpan := tracing.StartSpan(ctx, "handler.CheckAuth")
	isAdmin := isAdminOrAbove(ctx)
	hasVipAccess := isVipOrAbove(ctx)
	authSpan.SetAttributes(
		tracing.AttrIsAdmin.Bool(isAdmin),
		attribute.Bool("has_vip_access", hasVipAccess),
	)
	authSpan.End()

	// Build pagination params
	params := study.PaginationParams{
		Page: page,
		Size: size,
	}

	var response *study.PaginatedLessonsResponse
	var err error
	if isAdmin {
		response, err = h.studySvc.ListAllLessonsPaginated(ctx, hasVipAccess, params)
	} else {
		response, err = h.studySvc.ListPublishedLessonsPaginated(ctx, hasVipAccess, params)
	}

	if err != nil {
		tracing.RecordError(span, err)
		httputil.WriteError(w, http.StatusInternalServerError, "failed to load lessons")
		return
	}

	// Serialize response
	_, jsonSpan := tracing.StartSpan(ctx, "handler.SerializeJSON",
		tracing.AttrResponseCount.Int(len(response.Lessons)),
		attribute.Int64("total", response.Total),
		attribute.Int("total_pages", response.TotalPages),
	)
	httputil.WriteJSON(w, http.StatusOK, response)
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
	isAdmin := isAdminOrAbove(ctx)
	hasVipAccess := isVipOrAbove(ctx)
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
	_, decodeSpan := tracing.StartSpan(ctx, "handler.DecodeJSONBody")
	var req study.CreateLessonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		tracing.RecordError(decodeSpan, err)
		decodeSpan.End()
		// Return detailed error message to help debug JSON parsing issues
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}
	decodeSpan.SetAttributes(
		tracing.AttrLessonSlug.String(req.Slug),
		attribute.Bool("is_vip", req.IsVip),
	)
	decodeSpan.End()

	_, buildSpan := tracing.StartSpan(ctx, "handler.BuildLessonModel")
	newLesson := &study.Lesson{
		Slug:          req.Slug,
		Title:         req.Title,
		Markdown:      req.Markdown,
		Excalidraw:    req.Excalidraw,
		VideoURL:      req.VideoURL,
		CodeTemplate:  req.CodeTemplate,
		IsPublished:   req.IsPublished,
		IsVip:         req.IsVip,
		Author:        req.Author,
		PublishedDate: req.PublishedDate,
	}
	buildSpan.End()

	created, err := h.studySvc.CreateLesson(ctx, newLesson)
	if err != nil {
		tracing.RecordError(span, err)
		if errors.Is(err, gorm.ErrDuplicatedKey) {
			httputil.WriteError(w, http.StatusConflict, "slug already exists")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to create lesson: "+err.Error())
		return
	}

	_, jsonSpan := tracing.StartSpan(ctx, "handler.SerializeJSON")
	httputil.WriteJSON(w, http.StatusCreated, created)
	jsonSpan.End()
}

// UpdateLessonHandler handles PATCH /api/lessons/{slug}. Requires AdminOnly middleware.
func (h *Handlers) UpdateLessonHandler(w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.StartSpan(r.Context(), "handler.UpdateLesson")
	defer span.End()

	if h.studySvc == nil {
		httputil.WriteError(w, http.StatusInternalServerError, "study service unavailable")
		return
	}

	_, parseSpan := tracing.StartSpan(ctx, "handler.ParseSlugParam")
	slug := chi.URLParam(r, "slug")
	parseSpan.SetAttributes(tracing.AttrLessonSlug.String(slug))
	parseSpan.End()

	if slug == "" {
		httputil.WriteError(w, http.StatusBadRequest, "slug is required")
		return
	}

	_, decodeSpan := tracing.StartSpan(ctx, "handler.DecodeJSONBody")
	var req study.UpdateLessonRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		tracing.RecordError(decodeSpan, err)
		decodeSpan.End()
		// Return detailed error message to help debug JSON parsing issues
		httputil.WriteError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}
	decodeSpan.End()

	_, buildSpan := tracing.StartSpan(ctx, "handler.BuildUpdateMap")
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
	if req.VideoURL != "" {
		updates["video_url"] = req.VideoURL
	}
	if len(req.CodeTemplate) > 0 {
		updates["code_template"] = req.CodeTemplate
	}
	if req.IsPublished != nil {
		updates["is_published"] = *req.IsPublished
	}
	if req.IsVip != nil {
		updates["is_vip"] = *req.IsVip
	}
	if req.Author != "" {
		updates["author"] = req.Author
	}
	if req.PublishedDate != nil {
		updates["published_date"] = req.PublishedDate
	}
	buildSpan.SetAttributes(attribute.Int("update_fields_count", len(updates)))
	buildSpan.End()

	if len(updates) == 0 {
		httputil.WriteError(w, http.StatusBadRequest, "no fields to update")
		return
	}

	if err := h.studySvc.UpdateLessonBySlug(ctx, slug, updates); err != nil {
		tracing.RecordError(span, err)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			httputil.WriteError(w, http.StatusNotFound, "lesson not found")
			return
		}
		httputil.WriteError(w, http.StatusInternalServerError, "failed to update lesson: "+err.Error())
		return
	}

	_, jsonSpan := tracing.StartSpan(ctx, "handler.SerializeJSON")
	httputil.WriteJSON(w, http.StatusOK, study.UpdateLessonResponse{
		Slug:    slug,
		Updated: true,
	})
	jsonSpan.End()
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
