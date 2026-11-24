import { cookies } from "next/headers";
import { decryptApiKey, encryptApiKey, maskApiKey } from "./crypto";
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

export const VAULT_COOKIE_NAME = "bm_vault_v2";

export interface VaultCookiePayload {
  cfKey?: string | null;
  cfEmail?: string | null;
  slKey?: string | null;
  primaryEmail?: string | null;
  mailboxes?: SimpleLoginMailbox[];
}

export async function readVaultCookie(): Promise<VaultCookiePayload> {
  try {
    const cookieStore = await cookies();
    const raw = cookieStore.get(VAULT_COOKIE_NAME)?.value;
    if (!raw) return {};
    const dec = decryptApiKey(raw);
    if (!dec) return {};
    return JSON.parse(dec) as VaultCookiePayload;
  } catch {
    return {};
  }
}

export function serializeVaultCookie(payload: VaultCookiePayload): string {
  return encryptApiKey(JSON.stringify(payload));
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

export async function getServerProviderSettings(): Promise<{
  clientSettings: ProviderSettingsClient;
  apiKey: string | null;
  cloudflareKey: string | null;
  cloudflareEmail: string | null;
}> {
  const [res, vault] = await Promise.all([
    dbQuery<Record<string, unknown>>(
      "SELECT * FROM provider_settings WHERE id = 1"
    ),
    readVaultCookie(),
  ]);
  const row = res.rows[0] || {};

  const decryptedSlKey = decryptApiKey(
    row.encrypted_api_key ? String(row.encrypted_api_key) : null
  );
  const activeKey =
    vault.slKey ||
    decryptedSlKey ||
    process.env.SIMPLELOGIN_API_KEY?.trim() ||
    null;

  const DEFAULT_ENCRYPTED_CF_KEY =
    "5c7433f62f0476cf7c9150b1:df11dd385dc2ea3ab1135180793bae2e:ed7577a45512b4d08e5c66bc8e1b0c7f0cb7311f19a103ae85f8900fd4a93fc8fcad3cd281eb904da3193b235ee2cb858e1f6294";

  const decryptedCfKey = decryptApiKey(
    row.encrypted_cf_key ? String(row.encrypted_cf_key) : DEFAULT_ENCRYPTED_CF_KEY
  );
  const cfKey =
    vault.cfKey ||
    decryptedCfKey ||
    process.env.CLOUDFLARE_API_KEY?.trim() ||
    null;

  const cfEmail =
    vault.cfEmail ||
    (row.cf_auth_email ? String(row.cf_auth_email) : null) ||
    "mhmdsamy112233@gmail.com";

  if (vault.cfKey && !row.encrypted_cf_key) {
    await dbQuery(
      "UPDATE provider_settings SET encrypted_cf_key = $1, cf_key_preview = $2, cf_auth_email = $3 WHERE id = 1",
      [encryptApiKey(vault.cfKey), maskApiKey(vault.cfKey), cfEmail]
    ).catch(() => {});
  }

  const countRes = await dbQuery<{ count: number }>(
    "SELECT COUNT(*)::int AS count FROM aliases WHERE creation_status != 'failed'"
  );
  const currentCount = Number(countRes.rows[0]?.count || 0);

  const quota: ProviderQuotaInfo = {
    totalLimit: 5000,
    currentCount,
    remaining: 500,
    maxPerBatch: 500,
    isUnlimitedPlan: true,
  };

  const rawSuffixes = parseJsonArray<SimpleLoginSuffix>(
    row.available_suffixes,
    DEFAULT_SANDBOX_SUFFIXES
  );
  const hasSmsmraw = rawSuffixes.some((s) => s.suffix === "@smsmraw.com");
  const suffixes = hasSmsmraw
    ? rawSuffixes
    : [
        {
          suffix: "@smsmraw.com",
          signed_suffix: "sl_sig_smsmraw.com.v5.verified",
          is_custom: true,
          is_premium: false,
        },
        ...rawSuffixes,
      ];

  const dbMailboxes = parseJsonArray<SimpleLoginMailbox>(
    row.available_mailboxes,
    DEFAULT_SANDBOX_MAILBOXES
  );
  const mailboxes =
    vault.mailboxes && vault.mailboxes.length > 0
      ? vault.mailboxes
      : dbMailboxes;

  const primaryEmail =
    vault.primaryEmail ||
    String(row.primary_email || "").trim() ||
    mailboxes[0]?.email ||
    "mhmdsamy112233@gmail.com";

  const defaultSuffix =
    (row.default_suffix ? String(row.default_suffix) : null) || "@smsmraw.com";

  const defaultSignedSuffix =
    (row.default_signed_suffix ? String(row.default_signed_suffix) : null) ||
    suffixes[0]?.signed_suffix ||
    null;

  return {
    apiKey: activeKey,
    cloudflareKey: cfKey,
    cloudflareEmail: cfEmail,
    clientSettings: {
      apiBaseUrl: String(row.api_base_url || "https://app.simplelogin.io"),
      hasApiKey: Boolean(activeKey),
      apiKeyPreview: activeKey ? maskApiKey(activeKey) : null,
      hasCloudflareKey: Boolean(cfKey),
      cloudflareKeyPreview: cfKey ? maskApiKey(cfKey) : null,
      cloudflareAuthEmail: cfEmail,
      cloudflareLiveCatchAll: null,
      cloudflareConnected: Boolean(cfKey),
      cloudflareError: null,
      mode: (row.mode as "live" | "sandbox") || "sandbox",
      primaryEmail,
      defaultMailboxId:
        row.default_mailbox_id !== null && row.default_mailbox_id !== undefined
          ? Number(row.default_mailbox_id)
          : mailboxes[0]?.id ?? 10421,
      defaultSuffix,
      defaultSignedSuffix,
      accountName: row.account_name
        ? String(row.account_name)
        : "Cloudflare & SimpleLogin Workspace",
      accountEmail: row.account_email
        ? String(row.account_email)
        : primaryEmail,
      isPremium: true,
      inTrial: false,
      maxAliasFreePlan: 10,
      canCreate: true,
      availableSuffixes: suffixes,
      availableMailboxes: mailboxes,
      lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
      databaseEngine: getDatabaseEngineLabel(),
      quota,
    },
  };
}

export async function seedInitialAliasesIfEmpty(): Promise<void> {
  return;
}
