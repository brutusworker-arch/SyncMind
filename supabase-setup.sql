-- Run this in your Supabase SQL Editor to set up the database

-- 1. Create the knowledge entries table
CREATE TABLE IF NOT EXISTS knowledge_entries (
  id UUID PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  user_id TEXT DEFAULT 'anonymous',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security (required for PowerSync)
ALTER TABLE knowledge_entries ENABLE ROW LEVEL SECURITY;

-- 3. Policy: allow anonymous reads (demo mode)
CREATE POLICY "Allow anonymous reads"
  ON knowledge_entries FOR SELECT
  USING (true);

-- 4. Policy: allow anonymous inserts (demo mode)
CREATE POLICY "Allow anonymous inserts"
  ON knowledge_entries FOR INSERT
  WITH CHECK (true);

-- 5. Enable realtime replication (required for PowerSync)
ALTER TABLE knowledge_entries REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE knowledge_entries;

-- 6. Test with sample data
INSERT INTO knowledge_entries (id, question, answer, tags, user_id)
VALUES (
  gen_random_uuid(),
  'What is PowerSync?',
  'PowerSync is a sync engine for building local-first apps. It keeps backend databases (like Postgres) in sync with on-device SQLite databases, enabling offline-capable apps that work instantly even without internet.',
  ARRAY['powersync', 'local-first', 'sync'],
  'demo'
);
