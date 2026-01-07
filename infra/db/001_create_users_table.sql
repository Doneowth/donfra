-- Create users table for user authentication
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    password VARCHAR(255),
    username VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    google_id VARCHAR(255) UNIQUE,
    google_avatar TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL AND google_id != '';

-- Add a trigger to auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Optional: Create default test users (password: admin123)
-- Password hash generated with bcrypt cost 12
-- Hash: $2a$12$/.ZnTCSQ/htuc6xJtZmG9uyViBygcOyZzPlz2arLHRvZ27Hh7MLGS

-- Admin user
INSERT INTO users (email, password, username, role, is_active)
VALUES (
    'admin@donfra.com',
    '$2a$12$/.ZnTCSQ/htuc6xJtZmG9uyViBygcOyZzPlz2arLHRvZ27Hh7MLGS',
    'admin',
    'admin',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Regular user
INSERT INTO users (email, password, username, role, is_active)
VALUES (
    'duser@d.com',
    '$2a$12$/.ZnTCSQ/htuc6xJtZmG9uyViBygcOyZzPlz2arLHRvZ27Hh7MLGS',
    'duser',
    'user',
    true
)
ON CONFLICT (email) DO NOTHING;

-- VIP user
INSERT INTO users (email, password, username, role, is_active)
VALUES (
    'dvip@d.com',
    '$2a$12$/.ZnTCSQ/htuc6xJtZmG9uyViBygcOyZzPlz2arLHRvZ27Hh7MLGS',
    'dvip',
    'vip',
    true
)
ON CONFLICT (email) DO NOTHING;

-- Mentor user
INSERT INTO users (email, password, username, role, is_active)
VALUES (
    'dgod@d.com',
    '$2a$12$/.ZnTCSQ/htuc6xJtZmG9uyViBygcOyZzPlz2arLHRvZ27Hh7MLGS',
    'dongod',
    'god',
    true
)
ON CONFLICT (email) DO NOTHING;
