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
