-- Create lessons table if it doesn't exist (compatible with GORM defaults)
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    markdown TEXT NOT NULL,
    excalidraw JSONB NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    is_vip BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure slug is unique so ON CONFLICT works
CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_slug ON lessons (slug);

-- Create index for VIP filtering
CREATE INDEX IF NOT EXISTS idx_lessons_is_vip ON lessons(is_vip);

INSERT INTO lessons (slug, title, markdown, excalidraw, is_published, is_vip)
VALUES
    ('intro-to-donfra', 'Intro to Donfra', '# Welcome\n\nThis is a sample lesson for testing.', $json$
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor",
  "elements": [],
  "appState": {
    "gridSize": 20,
    "gridStep": 5,
    "gridModeEnabled": false,
    "viewBackgroundColor": "#ffffff"
  },
  "files": {}
}
$json$::jsonb, TRUE, FALSE),
    ('advanced-collab', 'Advanced Collaboration', '## Collaboration\n\nTesting collaborative editing features.', $json$
{
  "type": "excalidraw",
  "version": 2,
  "source": "https://marketplace.visualstudio.com/items?itemName=pomdtr.excalidraw-editor",
  "elements": [
    {
      "type": "rectangle",
      "version": 141,
      "versionNonce": 361174001,
      "isDeleted": false,
      "id": "oDVXy8D6rom3H1-LLH2-f",
      "fillStyle": "hachure",
      "strokeWidth": 1,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "angle": 0,
      "x": 100.50390625,
      "y": 93.67578125,
      "strokeColor": "#000000",
      "backgroundColor": "transparent",
      "width": 186.47265625,
      "height": 141.9765625,
      "seed": 1968410350,
      "groupIds": []
    }
  ],
  "appState": {
    "zenModeEnabled": true,
    "viewBackgroundColor": "#a5d8ff"
  },
  "scrollToContent": true,
  "files": {}
}
$json$::jsonb, TRUE, FALSE)
ON CONFLICT (slug) DO NOTHING;
