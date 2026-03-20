import { PowerSyncDatabase } from '@powersync/web';
import { createClient } from '@supabase/supabase-js';
import { AppSchema } from './schema';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// Supabase client for reads + writes
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// PowerSync local database (offline SQLite in browser)
export const db = new PowerSyncDatabase({
  schema: AppSchema,
  database: {
    dbFilename: 'syncmind.db',
  },
});

// Initialize — open local DB but skip remote sync for now (JWT issue)
export async function connectPowerSync() {
  await db.init();
  // Load existing entries from Supabase into local DB
  try {
    const { data } = await supabase
      .from('knowledge_entries')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (data) {
      for (const entry of data) {
        await db.execute(
          `INSERT OR REPLACE INTO knowledge_entries (id, question, answer, tags, user_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [entry.id, entry.question, entry.answer, JSON.stringify(entry.tags), entry.user_id, entry.created_at, entry.updated_at]
        );
      }
    }
  } catch (err) {
    console.warn('Could not load from Supabase, working offline:', err);
  }
}

// Query local SQLite
export async function getAllEntries() {
  return db.getAll<{
    id: string;
    question: string;
    answer: string;
    tags: string;
    created_at: string;
  }>('SELECT id, question, answer, tags, created_at FROM knowledge_entries ORDER BY created_at DESC');
}

export async function searchEntries(query: string) {
  const pattern = `%${query}%`;
  return db.getAll<{
    id: string;
    question: string;
    answer: string;
    tags: string;
    created_at: string;
  }>(
    `SELECT id, question, answer, tags, created_at
     FROM knowledge_entries
     WHERE question LIKE ? OR answer LIKE ?
     ORDER BY created_at DESC
     LIMIT 20`,
    [pattern, pattern]
  );
}

export async function insertEntry(entry: {
  id: string;
  question: string;
  answer: string;
  tags: string[];
}) {
  const now = new Date().toISOString();

  // Write to local SQLite first (instant)
  await db.execute(
    `INSERT INTO knowledge_entries (id, question, answer, tags, user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [entry.id, entry.question, entry.answer, JSON.stringify(entry.tags), 'anonymous', now, now]
  );

  // Then sync to Supabase (in background)
  supabase.from('knowledge_entries').insert({
    id: entry.id,
    question: entry.question,
    answer: entry.answer,
    tags: entry.tags,
    user_id: 'anonymous',
    created_at: now,
    updated_at: now,
  }).then(({ error }) => {
    if (error) console.warn('Supabase sync failed (data saved locally):', error.message);
  });
}
