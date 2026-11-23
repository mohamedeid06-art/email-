import crypto from "crypto";
import type {
  SimpleLoginMailbox,
  SimpleLoginSuffix,
  SimpleLoginUserInfo,
} from "./types";

export class SimpleLoginApiError extends Error {
  status: number;
  isRateLimit: boolean;
  retryAfterSeconds?: number;

  constructor(
    message: string,
    status: number,
    isRateLimit = false,
    retryAfterSeconds?: number
  ) {
    super(message);
    this.name = "SimpleLoginApiError";
    this.status = status;
    this.isRateLimit = isRateLimit;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface SimpleLoginAliasResponse {
  id: number;
  email: string;
  name?: string | null;
  enabled: boolean;
  creation_date?: string;
  creation_timestamp?: number;
  note?: string | null;
  nb_block?: number;
  nb_forward?: number;
  nb_reply?: number;
  pinned?: boolean;
  mailbox?: { id: number; email: string };
  mailboxes?: { id: number; email: string }[];
}

export interface SimpleLoginOptionsResponse {
  can_create: boolean;
  prefix_suggestion?: string;
  suffixes: SimpleLoginSuffix[];
}

const WORD_BANK_ADJECTIVES = [
  "lunar",
  "cobalt",
  "velvet",
  "arctic",
  "quantum",
  "obsidian",
  "silent",
  "prism",
  "solar",
  "stellar",
  "cipher",
  "amber",
  "vortex",
  "zenith",
  "aurora",
  "chrono",
  "nebula",
  "aether",
  "onyx",
  "quartz",
];

const WORD_BANK_NOUNS = [
  "falcon",
  "relay",
  "shield",
  "beacon",
  "harbor",
  "matrix",
  "vector",
  "horizon",
  "anchor",
  "circuit",
  "summit",
  "conduit",
  "vault",
  "signal",
  "orbit",
  "compass",
  "atlas",
  "pulse",
  "bastion",
  "nexus",
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class SimpleLoginClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(apiKey: string, baseUrl = "https://app.simplelogin.io") {
    this.apiKey = apiKey.trim();
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    maxRetries = 3
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    let attempt = 0;

    while (true) {
      attempt++;
      const headers: Record<string, string> = {
        Authentication: this.apiKey,
        Accept: "application/json",
        ...((options.headers as Record<string, string>) || {}),
      };

      if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
      }

      let response: Response;
      try {
        response = await fetch(url, {
          ...options,
          headers,
          cache: "no-store",
        });
      } catch (err) {
        if (attempt <= maxRetries) {
          await sleep(400 * Math.pow(2, attempt - 1));
          continue;
        }
        throw new SimpleLoginApiError(
          `Network error connecting to SimpleLogin API (${this.baseUrl}): ${
            err instanceof Error ? err.message : String(err)
          }`,
          503
        );
      }

      if (response.status === 429) {
        const retryHeader = response.headers.get("Retry-After");
        const retryAfterSec = retryHeader
          ? Math.max(1, parseInt(retryHeader, 10) || 2)
          : Math.min(8, Math.pow(2, attempt));

        if (attempt <= maxRetries) {
          await sleep(retryAfterSec * 1000 + Math.floor(Math.random() * 250));
          continue;
        }

        throw new SimpleLoginApiError(
          `SimpleLogin API rate limit reached (HTTP 429). Please wait ${retryAfterSec}s before generating another batch.`,
          429,
          true,
          retryAfterSec
        );
      }

      const rawText = await response.text();
      let jsonData: Record<string, unknown> = {};
      if (rawText) {
        try {
          jsonData = JSON.parse(rawText);
        } catch {
          jsonData = { error: rawText };
        }
      }

      if (!response.ok) {
        const errorMsg =
          (typeof jsonData.error === "string" && jsonData.error) ||
          (typeof jsonData.message === "string" && jsonData.message) ||
          `SimpleLogin API returned HTTP ${response.status}`;

        throw new SimpleLoginApiError(errorMsg, response.status);
      }

      return jsonData as T;
    }
  }

  async getUserInfo(): Promise<SimpleLoginUserInfo> {
    return this.request<SimpleLoginUserInfo>("/api/user_info", {
      method: "GET",
    });
  }

  async getAliasOptions(hostname?: string): Promise<SimpleLoginOptionsResponse> {
    const query = hostname
      ? `?hostname=${encodeURIComponent(hostname)}`
      : "";
    return this.request<SimpleLoginOptionsResponse>(
      `/api/v5/alias/options${query}`,
      { method: "GET" }
    );
  }

  async getMailboxes(): Promise<{ mailboxes: SimpleLoginMailbox[] }> {
    return this.request<{ mailboxes: SimpleLoginMailbox[] }>(
      "/api/v2/mailboxes",
      { method: "GET" }
    );
  }

  async createMailbox(email: string): Promise<SimpleLoginMailbox> {
    return this.request<SimpleLoginMailbox>("/api/mailboxes", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async listAliases(
    pageId = 0,
    query?: string
  ): Promise<{ aliases: SimpleLoginAliasResponse[] }> {
    const params = new URLSearchParams({ page_id: String(pageId) });
    return this.request<{ aliases: SimpleLoginAliasResponse[] }>(
      `/api/v2/aliases?${params.toString()}`,
      {
        method: query ? "POST" : "GET",
        body: query ? JSON.stringify({ query }) : undefined,
      }
    );
  }

  async createRandomAlias(params: {
    mode: "word" | "uuid";
    note?: string;
    hostname?: string;
  }): Promise<SimpleLoginAliasResponse> {
    const query = new URLSearchParams({ mode: params.mode });
    if (params.hostname) {
      query.set("hostname", params.hostname);
    }
    return this.request<SimpleLoginAliasResponse>(
      `/api/alias/random/new?${query.toString()}`,
      {
        method: "POST",
        body: JSON.stringify({
          note: params.note || "",
        }),
      }
    );
  }

  async createCustomAlias(params: {
    aliasPrefix: string;
    signedSuffix: string;
    mailboxIds: number[];
    note?: string;
    name?: string;
  }): Promise<SimpleLoginAliasResponse> {
    return this.request<SimpleLoginAliasResponse>("/api/v3/alias/custom/new", {
      method: "POST",
      body: JSON.stringify({
        alias_prefix: params.aliasPrefix,
        signed_suffix: params.signedSuffix,
        mailbox_ids: params.mailboxIds,
        note: params.note || "",
        name: params.name || "",
      }),
    });
  }

  async toggleAlias(
    remoteAliasId: number
  ): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>(
      `/api/aliases/${remoteAliasId}/toggle`,
      {
        method: "POST",
      }
    );
  }

  async deleteAlias(
    remoteAliasId: number
  ): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(
      `/api/aliases/${remoteAliasId}`,
      {
        method: "DELETE",
      }
    );
  }

  async updateAlias(
    remoteAliasId: number,
    payload: {
      note?: string;
      name?: string;
      mailbox_ids?: number[];
      pinned?: boolean;
    }
  ): Promise<{ ok?: boolean }> {
    return this.request<{ ok?: boolean }>(
      `/api/aliases/${remoteAliasId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      }
    );
  }
}

/**
 * Generates a realistic SimpleLogin-formatted alias in Sandbox mode
 * while honoring exact SimpleLogin suffix and prefix conventions.
 */
export function generateSandboxAliasAddress(params: {
  mode: "random_word" | "random_uuid" | "custom_prefix" | "numeric_dot";
  prefixPattern?: string;
  domainSuffix: string;
  index: number;
}): { email: string; prefix: string; domain: string; remoteId: number } {
  const cleanDomain = params.domainSuffix.startsWith("@")
    ? params.domainSuffix.slice(1)
    : params.domainSuffix;

  const randToken = crypto.randomBytes(3).toString("hex").slice(0, 5);
  let prefix = "";

  if (params.mode === "numeric_dot" || params.mode === "random_uuid") {
    // Format: a45286444.6171425682@smsmraw.com (letter + 8-9 digits + . + 10 digits)
    const part1 = Math.floor(10000000 + Math.random() * 90000000);
    const part2 = Math.floor(1000000000 + Math.random() * 9000000000);
    prefix = `a${part1}.${part2}`;
  } else if (params.mode === "custom_prefix" && params.prefixPattern?.trim()) {
    const sanitizedBase = params.prefixPattern
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const seq = String(params.index + 1).padStart(2, "0");
    prefix = `${sanitizedBase || "alias"}-${seq}.${randToken}`;
  } else {
    const adj =
      WORD_BANK_ADJECTIVES[
        Math.floor(Math.random() * WORD_BANK_ADJECTIVES.length)
      ];
    const noun =
      WORD_BANK_NOUNS[Math.floor(Math.random() * WORD_BANK_NOUNS.length)];
    prefix = `${adj}_${noun}.${randToken}`;
  }

  const remoteId =
    Math.floor(Date.now() / 100) % 90000000 +
    params.index * 17 +
    Math.floor(Math.random() * 1000);

  return {
    email: `${prefix}@${cleanDomain}`,
    prefix,
    domain: cleanDomain,
    remoteId,
  };
}
