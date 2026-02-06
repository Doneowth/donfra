-- Add review workflow columns to lessons table
-- Flow: draft → pending_review → approved/rejected → published

ALTER TABLE lessons ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS submitted_by INTEGER REFERENCES users(id);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS reviewed_by INTEGER REFERENCES users(id);
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- Index for filtering by review status (admin dashboard queries)
CREATE INDEX IF NOT EXISTS idx_lessons_review_status ON lessons(review_status);

-- Set existing published lessons to 'approved' status
UPDATE lessons SET review_status = 'approved' WHERE is_published = TRUE;
