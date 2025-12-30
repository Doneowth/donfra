package study

import (
	"context"
	"errors"

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

// ListPublishedLessons returns all lessons marked as published, ordered by newest first.
// If hasVipAccess is false, VIP lessons will have empty markdown/excalidraw.
func (s *Service) ListPublishedLessons(ctx context.Context, hasVipAccess bool) ([]Lesson, error) {
	ctx, span := tracing.StartSpan(ctx, "study.ListPublishedLessons",
		tracing.AttrDBOperation.String("SELECT"),
		tracing.AttrDBTable.String("lessons"),
	)
	defer span.End()

	var lessons []Lesson
	if err := s.db.WithContext(ctx).
		Where("is_published = ?", true).
		Order("created_at DESC").
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

	return lessons, nil
}

// ListAllLessons returns all lessons (both published and unpublished), ordered by newest first.
// If hasVipAccess is false, VIP lessons will have empty markdown/excalidraw.
func (s *Service) ListAllLessons(ctx context.Context, hasVipAccess bool) ([]Lesson, error) {
	ctx, span := tracing.StartSpan(ctx, "study.ListAllLessons",
		tracing.AttrDBOperation.String("SELECT"),
		tracing.AttrDBTable.String("lessons"),
	)
	defer span.End()

	var lessons []Lesson
	if err := s.db.WithContext(ctx).
		Order("created_at DESC").
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

	return lessons, nil
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

	// Fetch only the fields needed for list view (exclude markdown and excalidraw)
	// Sort by published_date DESC (nulls last), then created_at DESC
	var summaries []LessonSummary
	if err := s.db.WithContext(ctx).
		Model(&Lesson{}).
		Select("id, slug, title, is_published, is_vip, author, published_date, created_at, updated_at").
		Where("is_published = ?", true).
		Order("published_date DESC NULLS LAST, created_at DESC").
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

	// Fetch only the fields needed for list view (exclude markdown and excalidraw)
	// Sort by published_date DESC (nulls last), then created_at DESC
	var summaries []LessonSummary
	if err := s.db.WithContext(ctx).
		Model(&Lesson{}).
		Select("id, slug, title, is_published, is_vip, author, published_date, created_at, updated_at").
		Order("published_date DESC NULLS LAST, created_at DESC").
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
