# SyncMind — Local-First AI Knowledge Base

> **PowerSync AI Hackathon Submission** | Deadline: March 22, 2026

A local-first AI assistant that stores everything in your device's SQLite database and syncs seamlessly across all your devices — even offline.

## What It Does

SyncMind uses **Claude AI** to answer questions and automatically organizes answers into a searchable knowledge base. The twist: all your Q&A pairs are stored **locally in SQLite** (via PowerSync), so:

- ✅ **Works offline** — past answers are always available, even without internet
- ✅ **Instant search** — full-text search directly on local SQLite
- ✅ **Cross-device sync** — open on laptop, phone, tablet — always in sync
- ✅ **Real-time** — when someone else adds to the knowledge base, you see it instantly

## Why PowerSync?

Traditional AI chat apps lose all context when the session ends. SyncMind makes AI knowledge **persistent and offline-first**:

1. Ask Claude a question → answer stored in local SQLite via PowerSync
2. Close the browser → data persists in IndexedDB
3. Open on another device → PowerSync syncs the knowledge base automatically
4. No internet? → Browse and search all previous AI answers instantly

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (React + Vite)                             │
│  ┌─────────────────┐    ┌──────────────────────┐   │
│  │  Claude API      │    │  PowerSync JS SDK    │   │
│  │  (AI answers)    │    │  (Local SQLite/IDB)  │   │
│  └────────┬────────┘    └──────────┬───────────┘   │
│           │                        │               │
│           └────────────────────────┘               │
│                      ↓                             │
│               App State (React)                     │
└─────────────────────────────────────────────────────┘
                        │
                        │ PowerSync Protocol
                        ↓
┌─────────────────────────────────────────────────────┐
│  PowerSync Service (Cloud/Self-hosted)               │
│  + Supabase (PostgreSQL backend)                    │
└─────────────────────────────────────────────────────┘
```

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Sync Engine**: `@powersync/web` (PowerSync JS SDK)
- **AI**: Anthropic Claude API (`claude-sonnet-4-6`)
- **Backend**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS + shadcn/ui
- **Search**: SQLite FTS5 (via PowerSync local DB)

## Setup

### Prerequisites
- Node.js 18+
- Supabase account (free tier works)
- PowerSync Cloud account (free tier)
- Anthropic API key

### 1. Supabase Setup

Create a new Supabase project and run this SQL:

```sql
-- Knowledge entries table
CREATE TABLE knowledge_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id TEXT DEFAULT 'anonymous'
);

-- Enable realtime
ALTER TABLE knowledge_entries REPLICA IDENTITY FULL;

-- FTS index
CREATE INDEX knowledge_entries_fts_idx
  ON knowledge_entries
  USING GIN(to_tsvector('english', question || ' ' || answer));
```

### 2. PowerSync Setup

1. Go to [app.powersync.com](https://app.powersync.com)
2. Create a new project
3. Connect to your Supabase instance
4. Add sync rules (see `powersync.yaml`)

### 3. Environment Variables

```bash
cp .env.example .env
# Fill in:
# VITE_POWERSYNC_URL=https://your-project.powersync.journeyapps.com
# VITE_SUPABASE_URL=https://your-project.supabase.co
# VITE_SUPABASE_ANON_KEY=your-anon-key
# VITE_ANTHROPIC_API_KEY=your-claude-api-key
```

### 4. Install & Run

```bash
npm install
npm run dev
```

## Demo Scenarios

### Offline-First Demo
1. Load the app and ask several questions
2. Open Chrome DevTools → Network → "Offline"
3. Search previous answers — they all still work!
4. Reconnect — any answers added while offline sync automatically

### Cross-Device Sync Demo
1. Open app in two browser tabs
2. Ask a question in Tab 1
3. Watch it appear instantly in Tab 2 (via PowerSync)

### AI-Powered Knowledge Demo
1. Ask: "Explain local-first software architecture"
2. Answer is stored with tags: `[architecture, local-first]`
3. Ask related question → Claude references previous context

## Prize Categories Targeted

- **1st Place** ($3,000) — Overall Best
- **Best Local-First** ($500) — Core PowerSync use case
- **Best Supabase** ($1,000 credits) — Uses Supabase as backend

## Submission Checklist

- [ ] Register at https://form.typeform.com/to/zzswESaj (David needs to do this)
- [ ] Deploy to Vercel/Netlify
- [ ] Record 3-min demo video
- [ ] Submit at https://form.typeform.com/to/YR9U17Sn
