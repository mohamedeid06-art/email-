import fs from "fs";
import os from "os";
import path from "path";
import { Pool } from "pg";
import { PGlite } from "@electric-sql/pglite";
import type {
  AliasRecord,
  DashboardStats,
  GenerationBatchRecord,
  SimpleLoginMailbox,
  SimpleLoginSuffix,
} from "./types";

interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

interface DbGlobalState {
  pgPool?: Pool;
  pglite?: PGlite;
  initPromise?: Promise<void>;
  engineLabel?: string;
}

const globalForDb = globalThis as unknown as {
  __bulkAliasDb?: DbGlobalState;
};

if (!globalForDb.__bulkAliasDb) {
  globalForDb.__bulkAliasDb = {};
}

const dbState = globalForDb.__bulkAliasDb;

const DEFAULT_SANDBOX_SUFFIXES: SimpleLoginSuffix[] = [
  {
    suffix: "@smsmraw.com",
    signed_suffix: "sl_sig_smsmraw.com.v5.verified",
    is_custom: true,
    is_premium: false,
  },
  {
    suffix: "@simplelogin.com",
    signed_suffix: "sl_sig_simplelogin.com.v5.verified",
    is_custom: false,
    is_premium: false,
  },
  {
    suffix: "@passmail.net",
    signed_suffix: "sl_sig_passmail.net.v5.verified",
    is_custom: false,
    is_premium: false,
  },
  {
    suffix: "@aleeas.com",
    signed_suffix: "sl_sig_aleeas.com.v5.verified",
    is_custom: false,
    is_premium: false,
  },
  {
    suffix: "@slmail.me",
    signed_suffix: "sl_sig_slmail.me.v5.verified",
    is_custom: false,
    is_premium: true,
  },
  {
    suffix: "@8shield.net",
    signed_suffix: "sl_sig_8shield.net.v5.verified",
    is_custom: false,
    is_premium: true,
  },
];

const DEFAULT_SANDBOX_MAILBOXES: SimpleLoginMailbox[] = [
  {
    id: 10421,
    email: "mhmdsamy112233@gmail.com",
    default: true,
    verified: true,
    nb_alias: 0,
    creation_timestamp: 1731200000,
  },
];

async function initializeDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (databaseUrl) {
    try {
      const pool = new Pool({
        connectionString: databaseUrl,
        connectionTimeoutMillis: 4000,
      });
      await pool.query("SELECT 1");
      dbState.pgPool = pool;
      dbState.engineLabel = "PostgreSQL (External Server via pg.Pool)";
    } catch (err) {
      console.warn(
        "External DATABASE_URL unreachable, falling back to embedded PostgreSQL 16 (PGlite):",
        err
      );
    }
  }

  if (!dbState.pgPool && !dbState.pglite) {
    try {
      const baseDir = process.env.VERCEL
        ? path.join(os.tmpdir(), "bulk-alias-manager")
        : path.join(process.cwd(), "data");
      const dataDir = path.join(baseDir, "postgres");
      fs.mkdirSync(dataDir, { recursive: true });
      dbState.pglite = new PGlite(dataDir);
      await dbState.pglite.waitReady;
      dbState.engineLabel = "PostgreSQL 16 (Persistent Cluster)";
    } catch {
      dbState.pglite = new PGlite();
      await dbState.pglite.waitReady;
      dbState.engineLabel = "PostgreSQL 16 (Serverless Cluster)";
    }
  }

  const schemaPath = path.join(process.cwd(), "db", "schema.sql");
  const schemaSql = fs.existsSync(schemaPath)
    ? fs.readFileSync(schemaPath, "utf8")
    : `
CREATE TABLE IF NOT EXISTS provider_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  api_base_url TEXT NOT NULL DEFAULT 'https://app.simplelogin.io',
  encrypted_api_key TEXT,
  api_key_preview TEXT,
  mode TEXT NOT NULL DEFAULT 'live',
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
  generation_mode TEXT NOT NULL,
  prefix_pattern TEXT,
  domain_suffix TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'running',
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
  creation_status TEXT NOT NULL DEFAULT 'active',
  forwarding_status TEXT NOT NULL DEFAULT 'configured',
  note TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  batch_id TEXT REFERENCES generation_batches(id) ON DELETE SET NULL,
  nb_forward INTEGER NOT NULL DEFAULT 0,
  nb_reply INTEGER NOT NULL DEFAULT 0,
  nb_block INTEGER NOT NULL DEFAULT 0,
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  provider_mode TEXT NOT NULL DEFAULT 'live',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_aliases_email ON aliases (email);
CREATE INDEX IF NOT EXISTS idx_aliases_primary_email ON aliases (primary_email);
CREATE INDEX IF NOT EXISTS idx_aliases_enabled ON aliases (enabled);
CREATE INDEX IF NOT EXISTS idx_aliases_batch_id ON aliases (batch_id);
CREATE INDEX IF NOT EXISTS idx_aliases_created_at ON aliases (created_at DESC);
`;

  if (dbState.pgPool) {
    await dbState.pgPool.query(schemaSql);
  } else if (dbState.pglite) {
    await dbState.pglite.exec(schemaSql);
  }

  // Ensure singleton row in provider_settings exists
  const existing = await rawQuery<{ id: number }>(
    "SELECT id FROM provider_settings WHERE id = 1"
  );

  if (existing.rows.length === 0) {
    const envApiUrl =
      process.env.SIMPLELOGIN_API_URL?.trim() || "https://app.simplelogin.io";
    await rawQuery(
      `INSERT INTO provider_settings (
        id, api_base_url, mode, primary_email, default_mailbox_id,
        default_suffix, default_signed_suffix, account_name, account_email,
        is_premium, in_trial, max_alias_free_plan, can_create,
        available_suffixes, available_mailboxes
      ) VALUES (
        1, $1, $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13::jsonb, $14::jsonb
      ) ON CONFLICT (id) DO NOTHING`,
      [
        envApiUrl,
        process.env.SIMPLELOGIN_API_KEY ? "live" : "sandbox",
        "ops-primary@proton.me",
        10421,
        "@simplelogin.com",
        "sl_sig_simplelogin.com.v5.verified",
        "SimpleLogin Workspace",
        "ops-primary@proton.me",
        true,
        false,
        10,
        true,
        JSON.stringify(DEFAULT_SANDBOX_SUFFIXES),
        JSON.stringify(DEFAULT_SANDBOX_MAILBOXES),
      ]
    );
  }
}

async function rawQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  if (dbState.pgPool) {
    const res = await dbState.pgPool.query(sql, params);
    return {
      rows: res.rows as T[],
      rowCount: res.rowCount ?? res.rows.length,
    };
  }
  if (dbState.pglite) {
    const res = await dbState.pglite.query<T>(sql, params);
    return {
      rows: res.rows,
      rowCount: res.affectedRows ?? res.rows.length,
    };
  }
  throw new Error("PostgreSQL engine not initialized");
}

export async function ensureDb(): Promise<void> {
  if (!dbState.initPromise) {
    dbState.initPromise = initializeDatabase();
  }
  await dbState.initPromise;
}

export async function dbQuery<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  await ensureDb();
  return rawQuery<T>(sql, params);
}

export function getDatabaseEngineLabel(): string {
  return dbState.engineLabel || "PostgreSQL 16";
}

export function mapAliasRow(row: Record<string, unknown>): AliasRecord {
  let mailboxes: { id: number; email: string }[] = [];
  if (Array.isArray(row.mailboxes)) {
    mailboxes = row.mailboxes as { id: number; email: string }[];
  } else if (typeof row.mailboxes === "string") {
    try {
      mailboxes = JSON.parse(row.mailboxes);
    } catch {
      mailboxes = [];
    }
  }

  return {
    id: Number(row.id),
    remoteAliasId:
      row.remote_alias_id !== null && row.remote_alias_id !== undefined
        ? Number(row.remote_alias_id)
        : null,
    email: String(row.email),
    prefix: String(row.prefix),
    domain: String(row.domain),
    primaryEmail: String(row.primary_email),
    mailboxId:
      row.mailbox_id !== null && row.mailbox_id !== undefined
        ? Number(row.mailbox_id)
        : null,
    mailboxes,
    enabled: Boolean(row.enabled),
    creationStatus: (row.creation_status as AliasRecord["creationStatus"]) || "active",
    forwardingStatus:
      (row.forwarding_status as AliasRecord["forwardingStatus"]) || "configured",
    note: String(row.note || ""),
    displayName: String(row.display_name || ""),
    batchId: row.batch_id ? String(row.batch_id) : null,
    nbForward: Number(row.nb_forward || 0),
    nbReply: Number(row.nb_reply || 0),
    nbBlock: Number(row.nb_block || 0),
    pinned: Boolean(row.pinned),
    providerMode: (row.provider_mode as "live" | "sandbox") || "live",
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

export function mapBatchRow(
  row: Record<string, unknown>
): GenerationBatchRecord {
  return {
    id: String(row.id),
    requestedCount: Number(row.requested_count),
    createdCount: Number(row.created_count),
    failedCount: Number(row.failed_count),
    primaryEmail: String(row.primary_email),
    mailboxId:
      row.mailbox_id !== null && row.mailbox_id !== undefined
        ? Number(row.mailbox_id)
        : null,
    generationMode:
      (row.generation_mode as GenerationBatchRecord["generationMode"]) ||
      "random_word",
    prefixPattern: row.prefix_pattern ? String(row.prefix_pattern) : null,
    domainSuffix: row.domain_suffix ? String(row.domain_suffix) : null,
    note: row.note ? String(row.note) : null,
    status: (row.status as GenerationBatchRecord["status"]) || "completed",
    errorSummary: row.error_summary ? String(row.error_summary) : null,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
    completedAt: row.completed_at
      ? row.completed_at instanceof Date
        ? row.completed_at.toISOString()
        : String(row.completed_at)
      : null,
  };
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await dbQuery<Record<string, unknown>>(`
    SELECT
      COUNT(*)::int AS total_aliases,
      COUNT(*) FILTER (WHERE enabled = TRUE AND creation_status = 'active')::int AS active_aliases,
      COUNT(*) FILTER (WHERE enabled = FALSE OR creation_status = 'disabled')::int AS disabled_aliases,
      COUNT(*) FILTER (WHERE creation_status IN ('failed', 'rate_limited'))::int AS failed_aliases,
      COALESCE(SUM(nb_forward), 0)::int AS total_forwarded,
      COALESCE(SUM(nb_reply), 0)::int AS total_replies,
      COALESCE(SUM(nb_block), 0)::int AS total_blocked,
      COUNT(DISTINCT domain)::int AS unique_domains
    FROM aliases
  `);

  const batchRes = await dbQuery<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM generation_batches`
  );

  const row = res.rows[0] || {};
  return {
    totalAliases: Number(row.total_aliases || 0),
    activeAliases: Number(row.active_aliases || 0),
    disabledAliases: Number(row.disabled_aliases || 0),
    failedAliases: Number(row.failed_aliases || 0),
    totalForwarded: Number(row.total_forwarded || 0),
    totalReplies: Number(row.total_replies || 0),
    totalBlocked: Number(row.total_blocked || 0),
    totalBatches: Number(batchRes.rows[0]?.count || 0),
    uniqueDomains: Number(row.unique_domains || 0),
  };
}

export { DEFAULT_SANDBOX_MAILBOXES, DEFAULT_SANDBOX_SUFFIXES };
