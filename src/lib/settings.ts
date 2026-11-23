import { decryptApiKey, maskApiKey } from "./crypto";
import {
  dbQuery,
  DEFAULT_SANDBOX_MAILBOXES,
  DEFAULT_SANDBOX_SUFFIXES,
  getDatabaseEngineLabel,
} from "./db";
import type {
  ProviderQuotaInfo,
  ProviderSettingsClient,
  SimpleLoginMailbox,
  SimpleLoginSuffix,
} from "./types";

export interface ServerProviderSettings {
  clientSettings: ProviderSettingsClient;
  apiKey: string | null;
}

function parseJsonArray<T>(val: unknown, fallback: T[]): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : fallback;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

export async function getServerProviderSettings(): Promise<ServerProviderSettings> {
  const res = await dbQuery<Record<string, unknown>>(
    "SELECT * FROM provider_settings WHERE id = 1"
  );
  const row = res.rows[0] || {};

  const decryptedKey = decryptApiKey(
    row.encrypted_api_key ? String(row.encrypted_api_key) : null
  );
  const envKey = process.env.SIMPLELOGIN_API_KEY?.trim() || null;
  const activeKey = decryptedKey || envKey;

  const countRes = await dbQuery<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM aliases WHERE creation_status != 'failed'"
  );
  const currentCount = Number(countRes.rows[0]?.count || 0);

  const isPremium = Boolean(row.is_premium);
  const inTrial = Boolean(row.in_trial);
  const maxAliasFreePlan = Number(row.max_alias_free_plan || 10);
  const isUnlimitedPlan = isPremium || inTrial;

  const MAX_BATCH_PREMIUM = 50;
  const totalLimit = isUnlimitedPlan ? 500 : maxAliasFreePlan;
  const remaining = isUnlimitedPlan
    ? MAX_BATCH_PREMIUM
    : Math.max(0, maxAliasFreePlan - currentCount);
  const maxPerBatch = isUnlimitedPlan
    ? MAX_BATCH_PREMIUM
    : Math.min(remaining, maxAliasFreePlan);

  const quota: ProviderQuotaInfo = {
    totalLimit,
    currentCount,
    remaining,
    maxPerBatch,
    isUnlimitedPlan,
  };

  const suffixes = parseJsonArray<SimpleLoginSuffix>(
    row.available_suffixes,
    DEFAULT_SANDBOX_SUFFIXES
  );
  const mailboxes = parseJsonArray<SimpleLoginMailbox>(
    row.available_mailboxes,
    DEFAULT_SANDBOX_MAILBOXES
  );

  const primaryEmail =
    String(row.primary_email || "").trim() ||
    mailboxes.find((m) => m.default)?.email ||
    mailboxes[0]?.email ||
    "ops-primary@proton.me";

  const defaultSuffix =
    (row.default_suffix ? String(row.default_suffix) : null) ||
    suffixes[0]?.suffix ||
    "@simplelogin.com";

  const defaultSignedSuffix =
    (row.default_signed_suffix ? String(row.default_signed_suffix) : null) ||
    suffixes.find((s) => s.suffix === defaultSuffix)?.signed_suffix ||
    suffixes[0]?.signed_suffix ||
    null;

  const clientSettings: ProviderSettingsClient = {
    apiBaseUrl: String(row.api_base_url || "https://app.simplelogin.io"),
    hasApiKey: Boolean(activeKey),
    apiKeyPreview: activeKey
      ? row.api_key_preview
        ? String(row.api_key_preview)
        : maskApiKey(activeKey)
      : null,
    mode: (row.mode as "live" | "sandbox") || "sandbox",
    primaryEmail,
    defaultMailboxId:
      row.default_mailbox_id !== null && row.default_mailbox_id !== undefined
        ? Number(row.default_mailbox_id)
        : mailboxes[0]?.id ?? null,
    defaultSuffix,
    defaultSignedSuffix,
    accountName: row.account_name ? String(row.account_name) : "SimpleLogin Workspace",
    accountEmail: row.account_email ? String(row.account_email) : primaryEmail,
    isPremium,
    inTrial,
    maxAliasFreePlan,
    canCreate: isUnlimitedPlan ? true : remaining > 0,
    availableSuffixes: suffixes,
    availableMailboxes: mailboxes,
    lastSyncedAt: row.last_synced_at
      ? row.last_synced_at instanceof Date
        ? row.last_synced_at.toISOString()
        : String(row.last_synced_at)
      : null,
    databaseEngine: getDatabaseEngineLabel(),
    quota,
  };

  return {
    clientSettings,
    apiKey: activeKey,
  };
}

export async function seedInitialAliasesIfEmpty(): Promise<void> {
  // No-op: Do not auto-seed demo aliases so the table starts clean and deleted aliases never reappear.
  return;
}

  const batchId = "batch_seed_initial";
  await dbQuery(
    `INSERT INTO generation_batches (
      id, requested_count, created_count, failed_count,
      primary_email, mailbox_id, generation_mode, prefix_pattern,
      domain_suffix, note, status, completed_at
    ) VALUES (
      $1, 6, 6, 0,
      'ops-primary@proton.me', 10421, 'custom_prefix', 'saas-ops',
      '@simplelogin.com', 'Initial infrastructure & SaaS vendor aliases', 'completed', NOW()
    ) ON CONFLICT (id) DO NOTHING`,
    [batchId]
  );

  const starterAliases = [
    {
      remoteId: 84019201,
      email: "saas-ops-01.a8f2c@simplelogin.com",
      prefix: "saas-ops-01.a8f2c",
      domain: "simplelogin.com",
      primaryEmail: "ops-primary@proton.me",
      mailboxId: 10421,
      enabled: true,
      creationStatus: "active",
      forwardingStatus: "configured",
      note: "AWS Production Root Notifications",
      displayName: "Cloud Infrastructure",
      nbForward: 48,
      nbReply: 6,
      nbBlock: 2,
      pinned: true,
    },
    {
      remoteId: 84019202,
      email: "cobalt_relay.71d9e@simplelogin.com",
      prefix: "cobalt_relay.71d9e",
      domain: "simplelogin.com",
      primaryEmail: "ops-primary@proton.me",
      mailboxId: 10421,
      enabled: true,
      creationStatus: "active",
      forwardingStatus: "configured",
      note: "Stripe Billing & Webhook Alerts",
      displayName: "Finance Relay",
      nbForward: 112,
      nbReply: 14,
      nbBlock: 0,
      pinned: true,
    },
    {
      remoteId: 84019203,
      email: "quantum_shield.3c4b1@aleeas.com",
      prefix: "quantum_shield.3c4b1",
      domain: "aleeas.com",
      primaryEmail: "ops-primary@proton.me",
      mailboxId: 10421,
      enabled: true,
      creationStatus: "active",
      forwardingStatus: "configured",
      note: "GitHub Enterprise Organization Audit Feed",
      displayName: "SecOps GitHub",
      nbForward: 29,
      nbReply: 1,
      nbBlock: 5,
      pinned: false,
    },
    {
      remoteId: 84019204,
      email: "vendor-intake-04.9e01a@slmail.me",
      prefix: "vendor-intake-04.9e01a",
      domain: "slmail.me",
      primaryEmail: "security-team@company.io",
      mailboxId: 10422,
      enabled: true,
      creationStatus: "active",
      forwardingStatus: "configured",
      note: "SOC2 Third-Party Vendor Portal",
      displayName: "Vendor Compliance",
      nbForward: 19,
      nbReply: 3,
      nbBlock: 0,
      pinned: false,
    },
    {
      remoteId: 84019205,
      email: "lunar_beacon.5f82d@8shield.net",
      prefix: "lunar_beacon.5f82d",
      domain: "8shield.net",
      primaryEmail: "ops-primary@proton.me",
      mailboxId: 10421,
      enabled: false,
      creationStatus: "disabled",
      forwardingStatus: "paused",
      note: "Paused Marketing Campaign Signups Q3",
      displayName: "Campaign Sandbox",
      nbForward: 7,
      nbReply: 0,
      nbBlock: 34,
      pinned: false,
    },
    {
      remoteId: 84019206,
      email: "sl.49a1e0c2-7f1b-4d9a@passmail.net",
      prefix: "sl.49a1e0c2-7f1b-4d9a",
      domain: "passmail.net",
      primaryEmail: "security-team@company.io",
      mailboxId: 10422,
      enabled: true,
      creationStatus: "active",
      forwardingStatus: "configured",
      note: "Automated QA Regression Test Account",
      displayName: "QA Automation",
      nbForward: 64,
      nbReply: 0,
      nbBlock: 1,
      pinned: false,
    },
  ];

  for (const item of starterAliases) {
    await dbQuery(
      `INSERT INTO aliases (
        remote_alias_id, email, prefix, domain, primary_email,
        mailbox_id, mailboxes, enabled, creation_status, forwarding_status,
        note, display_name, batch_id, nb_forward, nb_reply, nb_block,
        pinned, provider_mode
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7::jsonb, $8, $9, $10,
        $11, $12, $13, $14, $15, $16,
        $17, 'sandbox'
      ) ON CONFLICT (email) DO NOTHING`,
      [
        item.remoteId,
        item.email,
        item.prefix,
        item.domain,
        item.primaryEmail,
        item.mailboxId,
        JSON.stringify([{ id: item.mailboxId, email: item.primaryEmail }]),
        item.enabled,
        item.creationStatus,
        item.forwardingStatus,
        item.note,
        item.displayName,
        batchId,
        item.nbForward,
        item.nbReply,
        item.nbBlock,
        item.pinned,
      ]
    );
  }
}
