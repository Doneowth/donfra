-- Create ai_conversations table for storing AI code analysis conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_content TEXT NOT NULL,
    question TEXT,
    response TEXT NOT NULL,
    model VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index for faster user queries
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id
    ON ai_conversations(user_id);

-- Create index for sorting by creation time
CREATE INDEX IF NOT EXISTS idx_ai_conversations_created_at
    ON ai_conversations(created_at DESC);
