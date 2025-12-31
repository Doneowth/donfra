-- Create lessons table if it doesn't exist (compatible with GORM defaults)
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    markdown TEXT NOT NULL,
    excalidraw JSONB NOT NULL,
    video_url TEXT,
    code_template JSONB,  -- Now stores { "externalUrl": "https://codesandbox.io/...", "language": "Python" }
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    author TEXT,
    published_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure slug is unique so ON CONFLICT works
CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_slug ON lessons (slug);

-- Create index for VIP filtering
CREATE INDEX IF NOT EXISTS idx_lessons_is_vip ON lessons(is_vip);

-- Create index for author filtering
CREATE INDEX IF NOT EXISTS idx_lessons_author ON lessons(author);

-- Create index for published date sorting
CREATE INDEX IF NOT EXISTS idx_lessons_published_date ON lessons(published_date);

INSERT INTO lessons (slug, title, markdown, excalidraw, video_url, code_template, is_published, is_vip, author, published_date)
VALUES
    -- Python Hello World lesson with external code sandbox
    ('python-hello-world',
     'Python: Hello World 🐍',
     '# Welcome to Python!

This is your first Python lesson. Let''s write our first program!

## The Classic "Hello, World!"

Every programmer starts here. It''s a simple program that displays text.

## Your Task

1. Click the **Code** tab
2. You''ll be redirected to an interactive coding environment
3. Read the code and run it
4. Try changing the message!

## Learn More

- `print()` is a function that displays text
- Strings use quotes: `"text"` or `''text''`
- Comments start with `#`',
     '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{},"files":{}}'::jsonb,
     'https://videos.ctfassets.net/x7j9qwvpvr5s/3wmfimlMtoXq9xvgl7Uw5Q/e977b09400bbe9e0559ed22550be7377/V23BHERO1.mp4',
     '{
       "language": "Python",
       "externalUrl": "https://codesandbox.io/p/devbox/k5f42n"
     }'::jsonb,
     TRUE,
     FALSE,
     'Donfra Team',
     '2025-12-30'),

    -- Python Basics lesson
    ('python-basics',
     'Python Basics',
     '# Python Basics

Learn Python fundamentals through interactive exercises.

## What You''ll Learn

1. Variables and data types
2. String formatting
3. Basic input/output

## Instructions

Click the **Code** tab to open the interactive coding environment!',
     '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{},"files":{}}'::jsonb,
     NULL,
     '{
       "language": "Python",
       "externalUrl": "https://codesandbox.io/p/devbox/k5f42n"
     }'::jsonb,
     TRUE,
     FALSE,
     'Donfra Team',
     '2025-12-30'),

    -- Python Functions lesson
    ('python-functions',
     'Python Functions',
     '# Python Functions

Learn how to write reusable functions in Python.

## Concepts

- Function definition with `def`
- Parameters and return values
- Function calls

## Exercise

Complete the function to calculate the area of a rectangle.',
     '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{},"files":{}}'::jsonb,
     NULL,
     '{
       "language": "Python",
       "externalUrl": "https://codesandbox.io/p/devbox/k5f42n"
     }'::jsonb,
     TRUE,
     FALSE,
     'Donfra Team',
     '2025-12-30'),

    -- Python Lists and Loops lesson
    ('python-lists',
     'Python Lists and Loops',
     '# Python Lists and Loops

Master Python lists and iteration.

## Topics

- Creating lists
- Accessing elements
- Looping with `for`
- List methods

## Challenge

Modify the code to add more fruits and print them!',
     '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{},"files":{}}'::jsonb,
     NULL,
     '{
       "language": "Python",
       "externalUrl": "https://codesandbox.io/p/devbox/k5f42n"
     }'::jsonb,
     TRUE,
     FALSE,
     'Donfra Team',
     '2025-12-30'),

    -- Python Dictionaries lesson
    ('python-dictionaries',
     'Python Dictionaries',
     '# Python Dictionaries

Learn to work with key-value pairs in Python.

## What are Dictionaries?

Dictionaries store data as key-value pairs, perfect for structured data.

## Example

Run the code to see how dictionaries work!',
     '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{},"files":{}}'::jsonb,
     NULL,
     '{
       "language": "Python",
       "externalUrl": "https://codesandbox.io/p/devbox/k5f42n"
     }'::jsonb,
     TRUE,
     FALSE,
     'Donfra Team',
     '2025-12-30'),

    -- Python Conditionals lesson
    ('python-conditionals',
     'Python Conditionals (If/Else)',
     '# Python Conditionals

Learn to make decisions in your code with if/else statements.

## Control Flow

- `if` statements
- `elif` (else if)
- `else` clauses
- Comparison operators

## Exercise

Modify the temperature value and see different messages!',
     '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{},"files":{}}'::jsonb,
     NULL,
     '{
       "language": "Python",
       "externalUrl": "https://codesandbox.io/p/devbox/k5f42n"
     }'::jsonb,
     TRUE,
     FALSE,
     'Donfra Team',
     '2025-12-30'),

    -- Python Math Operations lesson
    ('python-math',
     'Python Math and Operators',
     '# Python Math Operations

Learn arithmetic operations and math functions in Python.

## Operators

- Addition (+), Subtraction (-)
- Multiplication (*), Division (/)
- Exponentiation (**), Modulo (%)

## Try It

Experiment with different numbers and operations!',
     '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{},"files":{}}'::jsonb,
     NULL,
     '{
       "language": "Python",
       "externalUrl": "https://codesandbox.io/p/devbox/k5f42n"
     }'::jsonb,
     TRUE,
     FALSE,
     'Donfra Team',
     '2025-12-30'),

    -- Sample lessons without code
    ('intro-to-donfra', 'Intro to Donfra', '# Welcome\n\nThis is a sample lesson for testing.',
     '{"type":"excalidraw","version":2,"source":"","elements":[],"appState":{},"files":{}}'::jsonb,
     NULL, NULL, TRUE, FALSE, 'Donfra Team', '2025-01-15'),

    ('advanced-collab', 'Advanced Collaboration', '## Collaboration\n\nTesting collaborative editing features.',
     '{"type":"excalidraw","version":2,"source":"","elements":[{"type":"rectangle","version":141,"versionNonce":361174001,"isDeleted":false,"id":"oDVXy8D6rom3H1-LLH2-f","fillStyle":"hachure","strokeWidth":1,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":100.50390625,"y":93.67578125,"strokeColor":"#000000","backgroundColor":"transparent","width":186.47265625,"height":141.9765625,"seed":1968410350,"groupIds":[]}],"appState":{"zenModeEnabled":true,"viewBackgroundColor":"#a5d8ff"},"scrollToContent":true,"files":{}}'::jsonb,
     NULL, NULL, TRUE, FALSE, 'Donfra Team', '2025-01-20')
ON CONFLICT (slug) DO UPDATE
SET
    code_template = EXCLUDED.code_template,
    markdown = EXCLUDED.markdown,
    title = EXCLUDED.title,
    updated_at = NOW();
