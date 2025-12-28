package study

import (
	"time"

	"gorm.io/datatypes"
)

// Lesson represents an educational lesson in the system.
type Lesson struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Slug        string         `gorm:"not null" json:"slug"`
	Title       string         `gorm:"not null" json:"title"`
	Markdown    string         `gorm:"type:text;not null" json:"markdown"`
	Excalidraw  datatypes.JSON `gorm:"type:jsonb;not null" json:"excalidraw"`
	IsPublished bool           `gorm:"column:is_published;not null;default:false" json:"isPublished"`
	IsVip       bool           `gorm:"column:is_vip;not null;default:false" json:"isVip"`
	CreatedAt   time.Time      `json:"createdAt"`
	UpdatedAt   time.Time      `json:"updatedAt"`
}

// CreateLessonRequest represents a request to create a new lesson.
type CreateLessonRequest struct {
	Slug        string         `json:"slug"`
	Title       string         `json:"title"`
	Markdown    string         `json:"markdown"`
	Excalidraw  datatypes.JSON `json:"excalidraw"`
	IsPublished bool           `json:"isPublished"`
	IsVip       bool           `json:"isVip"`
}

// UpdateLessonRequest represents a request to update an existing lesson.
type UpdateLessonRequest struct {
	Title       string         `json:"title"`
	Markdown    string         `json:"markdown"`
	Excalidraw  datatypes.JSON `json:"excalidraw"`
	IsPublished *bool          `json:"isPublished"`
	IsVip       *bool          `json:"isVip"`
}

// UpdateLessonResponse represents the response after updating a lesson.
type UpdateLessonResponse struct {
	Slug    string `json:"slug"`
	Updated bool   `json:"updated"`
}
