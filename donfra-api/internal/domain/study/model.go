package study

import (
	"time"

	"gorm.io/datatypes"
)

// Lesson represents an educational lesson in the system.
type Lesson struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	Slug          string         `gorm:"not null" json:"slug"`
	Title         string         `gorm:"not null" json:"title"`
	Markdown      string         `gorm:"type:text;not null" json:"markdown"`
	Excalidraw    datatypes.JSON `gorm:"type:jsonb;not null" json:"excalidraw"`
	VideoURL      string         `gorm:"type:text" json:"videoUrl,omitempty"` // S3/CDN URL for video
	CodeTemplate  datatypes.JSON `gorm:"type:jsonb" json:"codeTemplate,omitempty"` // Code template for interactive coding
	IsPublished   bool           `gorm:"column:is_published;not null;default:false" json:"isPublished"`
	IsVip         bool           `gorm:"column:is_vip;not null;default:false" json:"isVip"`
	Author        string         `gorm:"type:text" json:"author,omitempty"`
	PublishedDate *Date          `gorm:"type:date" json:"publishedDate,omitempty"`
	CreatedAt     time.Time      `json:"createdAt"`
	UpdatedAt     time.Time      `json:"updatedAt"`
}

// CreateLessonRequest represents a request to create a new lesson.
type CreateLessonRequest struct {
	Slug          string         `json:"slug"`
	Title         string         `json:"title"`
	Markdown      string         `json:"markdown"`
	Excalidraw    datatypes.JSON `json:"excalidraw"`
	VideoURL      string         `json:"videoUrl"`
	CodeTemplate  datatypes.JSON `json:"codeTemplate"`
	IsPublished   bool           `json:"isPublished"`
	IsVip         bool           `json:"isVip"`
	Author        string         `json:"author"`
	PublishedDate *Date          `json:"publishedDate"`
}

// UpdateLessonRequest represents a request to update an existing lesson.
type UpdateLessonRequest struct {
	Title         string         `json:"title"`
	Markdown      string         `json:"markdown"`
	Excalidraw    datatypes.JSON `json:"excalidraw"`
	VideoURL      string         `json:"videoUrl"`
	CodeTemplate  datatypes.JSON `json:"codeTemplate"`
	IsPublished   *bool          `json:"isPublished"`
	IsVip         *bool          `json:"isVip"`
	Author        string         `json:"author"`
	PublishedDate *Date          `json:"publishedDate"`
}

// UpdateLessonResponse represents the response after updating a lesson.
type UpdateLessonResponse struct {
	Slug    string `json:"slug"`
	Updated bool   `json:"updated"`
}

// PaginationParams represents pagination parameters for listing lessons.
type PaginationParams struct {
	Page     int    // 1-based page number
	Size     int    // number of items per page
	SortBy   string // Field to sort by: "created_at", "updated_at", "title", "id" (default: "created_at")
	SortDesc bool   // Sort descending (default: true for dates, false for title)
	Search   string // Search query for title/slug/author
}

// LessonSummary is a lightweight version of Lesson for list views.
// It excludes heavy fields like markdown and excalidraw to reduce payload size.
type LessonSummary struct {
	ID            uint   `json:"id"`
	Slug          string `json:"slug"`
	Title         string `json:"title"`
	IsPublished   bool   `json:"isPublished"`
	IsVip         bool   `json:"isVip"`
	Author        string `json:"author,omitempty"`
	PublishedDate *Date  `json:"publishedDate,omitempty"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

// PaginatedLessonsResponse represents a paginated list of lessons.
type PaginatedLessonsResponse struct {
	Lessons    []Lesson `json:"lessons"`
	Total      int64    `json:"total"`      // total number of items
	Page       int      `json:"page"`       // current page (1-based)
	Size       int      `json:"size"`       // items per page
	TotalPages int      `json:"totalPages"` // total number of pages
}

// PaginatedLessonsSummaryResponse represents a paginated list of lesson summaries.
type PaginatedLessonsSummaryResponse struct {
	Lessons    []LessonSummary `json:"lessons"`
	Total      int64           `json:"total"`      // total number of items
	Page       int             `json:"page"`       // current page (1-based)
	Size       int             `json:"size"`       // items per page
	TotalPages int             `json:"totalPages"` // total number of pages
}
