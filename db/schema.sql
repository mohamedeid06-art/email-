-- PostgreSQL Schema for Bulk Email Alias Manager

CREATE TABLE IF NOT EXISTS provider_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  api_base_url TEXT NOT NULL DEFAULT 'https://app.simplelogin.io',
  encrypted_api_key TEXT,
  api_key_Preview TEXT,
  mode TEXT NOT NULL DEFAULT 'live', -- 'live' (Official SimpleLogin API) or 'sandbox' (Simulated Provider Mode)
  primary_email TEXT NOT NULL DEFAULT '',
  default_mailbox_id INTEGER,
  default_suffix TEXT,
  default_signed_suffix TEXT,
  account_name TEXT,
  account_email TEXT,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  in_trial BOOLEAN NOT NULL DEFAULT FALSE,
  max_alias_free_plan INTEGER NOT NULL DEFAULT 10,
  can_create BOOLEAN NOT NULL DEFAULT TRUE,
  available_suffixes JSONB NOT NULL DEFAULT '[]'::jsonb,
  available_mailboxes JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_synced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT single_row CHECK (id = 1)
);

CREATE TABLE IF NOT EXISTS generation_batches (
  id TEXT PRIMARY KEY,
  requested_count INTEGER NOT NULL,
  created_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  primary_email TEXT NOT NULL,
  mailbox_id INTEGER,
  generation_mode TEXT NOT NULL, -- 'random_word', 'random_uuid', 'custom_prefix'
  prefix_pattern TEXT,
  domain_suffix TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'partial', 'failed', 'rate_limited'
  error_summary TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS aliases (
  id SERIAL PRIMARY KEY,
  remote_alias_id INTEGER UNIQUE,
  email TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  domain TEXT NOT NULL,
  primary_email TEXT NOT NULL,
  mailbox_id INTEGER,
  mailboxes JSONB NOT NULL DEFAULT '[]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  creation_status TEXT NOT NULL DEFAULT 'active', -- 'active', 'disabled', 'failed', 'rate_limited', 'pending'
  forwarding_status TEXT NOT NULL DEFAULT 'configured', -- 'configured', 'paused', 'unverified', 'error'
  note TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  batch_id TEXT REFERENCES generation_batches(id) ON DELETE SET NULL,
  nb_forward INTEGER NOT NULL DEFAULT 0,
  nb_reply INTEGER NOT NULL DEFAULT 0,
  nb_block INTEGER NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  provider_mode TEXT NOT NULL DEFAULT 'live', -- 'live' or 'sandbox'
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aliases_email ON aliases (email);
CREATE INDEX IF NOT EXISTS idx_aliases_primary_email ON aliases (primary_email);
CREATE INDEX IF NOT EXISTS idx_aliases_enabled ON aliases (enabled);
CREATE INDEX IF NOT EXISTS idx_aliases_batch_id ON aliases (batch_id);
CREATE INDEX IF NOT EXISTS idx_aliases_created_at ON aliases (created_at DESC);
