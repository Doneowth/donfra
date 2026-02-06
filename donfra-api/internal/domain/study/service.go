package study

import (
	"context"
	"errors"
	"time"

	"gorm.io/gorm"

	"donfra-api/internal/pkg/tracing"
)

// Service implements CRUD operations for lessons.
type Service struct {
	db *gorm.DB
}

func NewService(db *gorm.DB) *Service {
	return &Service{db: db}
}

// buildSortOrder builds the ORDER BY clause based on pagination params
func buildSortOrder(params PaginationParams) string {
	// Validate and default sortBy
	sortBy := params.SortBy
	validSortFields := map[string]bool{
		"created_at":     true,
		"updated_at":     true,
		"title":          true,
		"id":             true,
		"published_date": true,
	}
	if !validSortFields[sortBy] {
		sortBy = "created_at"
	}

	// Determine sort direction
	direction := "DESC"
	if !params.SortDesc {
		direction = "ASC"
	}

	// Special handling for published_date (nulls last)
	if sortBy == "published_date" {
		return sortBy + " " + direction + " NULLS LAST"
	}

	return sortBy + " " + direction
}

// applySearchFilter applies search filter to query if search term is provided
func (s *Service) applySearchFilter(query *gorm.DB, search string) *gorm.DB {
	if search == "" {
		return query
	}
	// Search in title, slug, and author (case-insensitive)
	searchPattern := "%" + search + "%"
	return query.Where(
		"LOWER(title) LIKE LOWER(?) OR LOWER(slug) LIKE LOWER(?) OR LOWER(author) LIKE LOWER(?)",
		searchPattern, searchPattern, searchPattern,
	)
}

// GetLessonBySlug retrieves a lesson by its slug.
// If hasVipAccess is false and lesson is VIP-only, returns lesson with empty markdown/excalidraw.
func (s *Service) GetLessonBySlug(ctx context.Context, slug string, hasVipAccess bool) (*Lesson, error) {
	ctx, span := tracing.StartSpan(ctx, "study.GetLessonBySlug",
		tracing.AttrDBOperation.String("SELECT"),
		tracing.AttrDBTable.String("lessons"),
		tracing.AttrLessonSlug.String(slug),
	)
	defer span.End()

	var lesson Lesson
	if err := s.db.WithContext(ctx).Where("slug = ?", slug).First(&lesson).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	// Filter VIP content if user doesn't have access
	if lesson.IsVip && !hasVipAccess {
		lesson.Markdown = ""
		lesson.Excalidraw = nil
	}

	return &lesson, nil
}

// CreateLesson inserts a lesson. Caller must ensure admin authorization (e.g., via middleware).
func (s *Service) CreateLesson(ctx context.Context, newLesson *Lesson) (*Lesson, error) {
	ctx, span := tracing.StartSpan(ctx, "study.CreateLesson",
		tracing.AttrDBOperation.String("INSERT"),
		tracing.AttrDBTable.String("lessons"),
		tracing.AttrLessonSlug.String(newLesson.Slug),
		tracing.AttrLessonIsPublished.Bool(newLesson.IsPublished),
	)
	defer span.End()

	if err := s.db.WithContext(ctx).Create(newLesson).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	return newLesson, nil
}

// UpdateLessonBySlug updates fields for the given lesson slug.
func (s *Service) UpdateLessonBySlug(ctx context.Context, slug string, updates map[string]any) error {
	if len(updates) == 0 {
		return errors.New("no updates provided")
	}
	res := s.db.WithContext(ctx).Model(&Lesson{}).Where("slug = ?", slug).Updates(updates)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// DeleteLessonBySlug deletes a lesson by slug.
func (s *Service) DeleteLessonBySlug(ctx context.Context, slug string) error {
	res := s.db.WithContext(ctx).Where("slug = ?", slug).Delete(&Lesson{})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

// ListPublishedLessonsPaginated returns published lessons with pagination support.
// If hasVipAccess is false, VIP lessons will have empty markdown/excalidraw.
func (s *Service) ListPublishedLessonsPaginated(ctx context.Context, hasVipAccess bool, params PaginationParams) (*PaginatedLessonsResponse, error) {
	ctx, span := tracing.StartSpan(ctx, "study.ListPublishedLessonsPaginated",
		tracing.AttrDBOperation.String("SELECT"),
		tracing.AttrDBTable.String("lessons"),
	)
	defer span.End()

	// Validate and set defaults
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Size < 1 || params.Size > 100 {
		params.Size = 10 // default page size
	}

	// Count total items
	var total int64
	if err := s.db.WithContext(ctx).
		Model(&Lesson{}).
		Where("is_published = ?", true).
		Count(&total).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	// Calculate offset and total pages
	offset := (params.Page - 1) * params.Size
	totalPages := int((total + int64(params.Size) - 1) / int64(params.Size))

	// Fetch paginated lessons
	// Sort by published_date DESC (nulls last), then created_at DESC
	var lessons []Lesson
	if err := s.db.WithContext(ctx).
		Where("is_published = ?", true).
		Order("published_date DESC NULLS LAST, created_at DESC").
		Limit(params.Size).
		Offset(offset).
		Find(&lessons).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	// Filter VIP content for non-VIP users
	if !hasVipAccess {
		for i := range lessons {
			if lessons[i].IsVip {
				lessons[i].Markdown = ""
				lessons[i].Excalidraw = nil
			}
		}
	}

	return &PaginatedLessonsResponse{
		Lessons:    lessons,
		Total:      total,
		Page:       params.Page,
		Size:       params.Size,
		TotalPages: totalPages,
	}, nil
}

// ListAllLessonsPaginated returns all lessons (published + unpublished) with pagination support.
// If hasVipAccess is false, VIP lessons will have empty markdown/excalidraw.
func (s *Service) ListAllLessonsPaginated(ctx context.Context, hasVipAccess bool, params PaginationParams) (*PaginatedLessonsResponse, error) {
	ctx, span := tracing.StartSpan(ctx, "study.ListAllLessonsPaginated",
		tracing.AttrDBOperation.String("SELECT"),
		tracing.AttrDBTable.String("lessons"),
	)
	defer span.End()

	// Validate and set defaults
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Size < 1 || params.Size > 100 {
		params.Size = 10 // default page size
	}

	// Count total items
	var total int64
	if err := s.db.WithContext(ctx).
		Model(&Lesson{}).
		Count(&total).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	// Calculate offset and total pages
	offset := (params.Page - 1) * params.Size
	totalPages := int((total + int64(params.Size) - 1) / int64(params.Size))

	// Fetch paginated lessons
	// Sort by published_date DESC (nulls last), then created_at DESC
	var lessons []Lesson
	if err := s.db.WithContext(ctx).
		Order("published_date DESC NULLS LAST, created_at DESC").
		Limit(params.Size).
		Offset(offset).
		Find(&lessons).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	// Filter VIP content for non-VIP users
	if !hasVipAccess {
		for i := range lessons {
			if lessons[i].IsVip {
				lessons[i].Markdown = ""
				lessons[i].Excalidraw = nil
			}
		}
	}

	return &PaginatedLessonsResponse{
		Lessons:    lessons,
		Total:      total,
		Page:       params.Page,
		Size:       params.Size,
		TotalPages: totalPages,
	}, nil
}

// ListPublishedLessonsSummaryPaginated returns lightweight lesson summaries (published only) without markdown/excalidraw.
// This is optimized for list views where full content is not needed.
func (s *Service) ListPublishedLessonsSummaryPaginated(ctx context.Context, params PaginationParams) (*PaginatedLessonsSummaryResponse, error) {
	ctx, span := tracing.StartSpan(ctx, "study.ListPublishedLessonsSummaryPaginated",
		tracing.AttrDBOperation.String("SELECT"),
		tracing.AttrDBTable.String("lessons"),
	)
	defer span.End()

	// Validate and set defaults
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Size < 1 || params.Size > 100 {
		params.Size = 10
	}

	// Build base query with search filter
	baseQuery := s.db.WithContext(ctx).Model(&Lesson{}).Where("is_published = ?", true)
	baseQuery = s.applySearchFilter(baseQuery, params.Search)

	// Count total items with filter
	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	// Calculate offset and total pages
	offset := (params.Page - 1) * params.Size
	totalPages := int((total + int64(params.Size) - 1) / int64(params.Size))

	// Build sort order
	sortOrder := buildSortOrder(params)

	// Fetch only the fields needed for list view (exclude markdown and excalidraw)
	var summaries []LessonSummary
	if err := baseQuery.
		Select("id, slug, title, is_published, is_vip, author, published_date, review_status, created_at, updated_at").
		Order(sortOrder).
		Limit(params.Size).
		Offset(offset).
		Find(&summaries).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	return &PaginatedLessonsSummaryResponse{
		Lessons:    summaries,
		Total:      total,
		Page:       params.Page,
		Size:       params.Size,
		TotalPages: totalPages,
	}, nil
}

// ListAllLessonsSummaryPaginated returns lightweight lesson summaries (all lessons) without markdown/excalidraw.
// This is optimized for admin list views where full content is not needed.
func (s *Service) ListAllLessonsSummaryPaginated(ctx context.Context, params PaginationParams) (*PaginatedLessonsSummaryResponse, error) {
	ctx, span := tracing.StartSpan(ctx, "study.ListAllLessonsSummaryPaginated",
		tracing.AttrDBOperation.String("SELECT"),
		tracing.AttrDBTable.String("lessons"),
	)
	defer span.End()

	// Validate and set defaults
	if params.Page < 1 {
		params.Page = 1
	}
	if params.Size < 1 || params.Size > 100 {
		params.Size = 10
	}

	// Build base query with search filter
	baseQuery := s.db.WithContext(ctx).Model(&Lesson{})
	baseQuery = s.applySearchFilter(baseQuery, params.Search)

	// Count total items with filter
	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	// Calculate offset and total pages
	offset := (params.Page - 1) * params.Size
	totalPages := int((total + int64(params.Size) - 1) / int64(params.Size))

	// Build sort order
	sortOrder := buildSortOrder(params)

	// Fetch only the fields needed for list view (exclude markdown and excalidraw)
	var summaries []LessonSummary
	if err := baseQuery.
		Select("id, slug, title, is_published, is_vip, author, published_date, review_status, created_at, updated_at").
		Order(sortOrder).
		Limit(params.Size).
		Offset(offset).
		Find(&summaries).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	return &PaginatedLessonsSummaryResponse{
		Lessons:    summaries,
		Total:      total,
		Page:       params.Page,
		Size:       params.Size,
		TotalPages: totalPages,
	}, nil
}

// SubmitForReview transitions a lesson from draft/rejected to pending_review.
func (s *Service) SubmitForReview(ctx context.Context, slug string, submitterUserID uint) error {
	ctx, span := tracing.StartSpan(ctx, "study.SubmitForReview",
		tracing.AttrDBOperation.String("UPDATE"),
		tracing.AttrDBTable.String("lessons"),
		tracing.AttrLessonSlug.String(slug),
	)
	defer span.End()

	var lesson Lesson
	if err := s.db.WithContext(ctx).Where("slug = ?", slug).First(&lesson).Error; err != nil {
		tracing.RecordError(span, err)
		return err
	}

	if lesson.ReviewStatus != ReviewStatusDraft && lesson.ReviewStatus != ReviewStatusRejected {
		return errors.New("lesson can only be submitted for review from draft or rejected state")
	}

	now := time.Now()
	if err := s.db.WithContext(ctx).Model(&Lesson{}).Where("slug = ?", slug).Updates(map[string]any{
		"review_status": ReviewStatusPendingReview,
		"submitted_by":  submitterUserID,
		"submitted_at":  now,
		"reviewed_by":   nil,
		"reviewed_at":   nil,
	}).Error; err != nil {
		tracing.RecordError(span, err)
		return err
	}

	return nil
}

// ReviewLesson approves or rejects a lesson that is pending review.
// The reviewer must not be the same user who submitted the lesson.
func (s *Service) ReviewLesson(ctx context.Context, slug string, reviewerUserID uint, action string) error {
	ctx, span := tracing.StartSpan(ctx, "study.ReviewLesson",
		tracing.AttrDBOperation.String("UPDATE"),
		tracing.AttrDBTable.String("lessons"),
		tracing.AttrLessonSlug.String(slug),
	)
	defer span.End()

	var lesson Lesson
	if err := s.db.WithContext(ctx).Where("slug = ?", slug).First(&lesson).Error; err != nil {
		tracing.RecordError(span, err)
		return err
	}

	if lesson.ReviewStatus != ReviewStatusPendingReview {
		return errors.New("lesson is not pending review")
	}

	if lesson.SubmittedBy != nil && *lesson.SubmittedBy == reviewerUserID {
		return errors.New("cannot review your own lesson")
	}

	if action != "approve" && action != "reject" {
		return errors.New("action must be 'approve' or 'reject'")
	}

	newStatus := ReviewStatusRejected
	if action == "approve" {
		newStatus = ReviewStatusApproved
	}

	now := time.Now()
	if err := s.db.WithContext(ctx).Model(&Lesson{}).Where("slug = ?", slug).Updates(map[string]any{
		"review_status": newStatus,
		"reviewed_by":   reviewerUserID,
		"reviewed_at":   now,
	}).Error; err != nil {
		tracing.RecordError(span, err)
		return err
	}

	return nil
}

// ListPendingReviewLessonsSummaryPaginated returns lessons pending review,
// excluding lessons submitted by the given user (admins cannot review their own submissions).
func (s *Service) ListPendingReviewLessonsSummaryPaginated(ctx context.Context, excludeUserID uint, params PaginationParams) (*PaginatedLessonsSummaryResponse, error) {
	ctx, span := tracing.StartSpan(ctx, "study.ListPendingReviewLessonsSummaryPaginated",
		tracing.AttrDBOperation.String("SELECT"),
		tracing.AttrDBTable.String("lessons"),
	)
	defer span.End()

	if params.Page < 1 {
		params.Page = 1
	}
	if params.Size < 1 || params.Size > 100 {
		params.Size = 10
	}

	baseQuery := s.db.WithContext(ctx).Model(&Lesson{}).
		Where("review_status = ?", ReviewStatusPendingReview).
		Where("submitted_by != ? OR submitted_by IS NULL", excludeUserID)
	baseQuery = s.applySearchFilter(baseQuery, params.Search)

	var total int64
	if err := baseQuery.Count(&total).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	offset := (params.Page - 1) * params.Size
	totalPages := int((total + int64(params.Size) - 1) / int64(params.Size))

	sortOrder := buildSortOrder(params)

	var summaries []LessonSummary
	if err := baseQuery.
		Select("id, slug, title, is_published, is_vip, author, published_date, review_status, created_at, updated_at").
		Order(sortOrder).
		Limit(params.Size).
		Offset(offset).
		Find(&summaries).Error; err != nil {
		tracing.RecordError(span, err)
		return nil, err
	}

	return &PaginatedLessonsSummaryResponse{
		Lessons:    summaries,
		Total:      total,
		Page:       params.Page,
		Size:       params.Size,
		TotalPages: totalPages,
	}, nil
}
