import crypto from "crypto";
import type {
  GenerationMode,
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

const FIRST_NAMES = [
  "mohamed",
  "ahmed",
  "mahmoud",
  "mostafa",
  "youssef",
  "ibrahim",
  "hassan",
  "hussein",
  "omar",
  "ali",
  "khaled",
  "tarek",
  "amr",
  "karim",
  "rami",
  "samy",
  "ziad",
  "marwan",
  "walid",
  "adel",
  "islam",
  "sherif",
  "tamer",
  "hazem",
  "essam",
  "hossam",
  "ayman",
  "bassem",
  "nabil",
  "sameh",
];

const LAST_NAMES = [
  "samy",
  "hassan",
  "kamal",
  "ibrahim",
  "mansour",
  "farouk",
  "salem",
  "maher",
  "fawzy",
  "nasser",
  "hamdy",
  "شوقي",
  "soliman",
  "osman",
  "amer",
  "gaber",
  "helmy",
  "zaki",
  "lotfy",
  "shawky",
  "radwan",
  "kamel",
  "fouad",
  "gamal",
  "anwar",
  "fahmy",
  "saad",
  "eid",
  "badawy",
  "ashraf",
].filter((n) => /^[a-z]+$/.test(n));

const WORD_ADJECTIVES = [
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

const WORD_NOUNS = [
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
          `SimpleLogin API rate limit reached (HTTP 429). Please wait ${retryAfterSec}s.`,
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
    return this.request<SimpleLoginUserInfo>("/api/user_info", { method: "GET" });
  }

  async getAliasOptions(hostname?: string): Promise<SimpleLoginOptionsResponse> {
    const query = hostname ? `?hostname=${encodeURIComponent(hostname)}` : "";
    return this.request<SimpleLoginOptionsResponse>(`/api/v5/alias/options${query}`, { method: "GET" });
  }

  async getMailboxes(): Promise<{ mailboxes: SimpleLoginMailbox[] }> {
    return this.request<{ mailboxes: SimpleLoginMailbox[] }>("/api/v2/mailboxes", { method: "GET" });
  }

  async listAliases(pageId = 0): Promise<{ aliases: SimpleLoginAliasResponse[] }> {
    return this.request<{ aliases: SimpleLoginAliasResponse[] }>(`/api/v2/aliases?page_id=${pageId}`, { method: "GET" });
  }

  async createRandomAlias(params: { mode: "word" | "uuid"; note?: string }): Promise<SimpleLoginAliasResponse> {
    return this.request<SimpleLoginAliasResponse>(`/api/alias/random/new?mode=${params.mode}`, {
      method: "POST",
      body: JSON.stringify({ note: params.note || "" }),
    });
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

  async toggleAlias(remoteAliasId: number): Promise<{ enabled: boolean }> {
    return this.request<{ enabled: boolean }>(`/api/aliases/${remoteAliasId}/toggle`, { method: "POST" });
  }

  async deleteAlias(remoteAliasId: number): Promise<{ deleted: boolean }> {
    return this.request<{ deleted: boolean }>(`/api/aliases/${remoteAliasId}`, { method: "DELETE" });
  }
}

export function generateSandboxAliasAddress(params: {
  mode: GenerationMode;
  prefixPattern?: string;
  domainSuffix: string;
  index: number;
}): { email: string; prefix: string; domain: string } {
  const cleanSuffix =
    params.domainSuffix.startsWith("@") || params.domainSuffix.startsWith(".")
      ? params.domainSuffix.trim()
      : `@${params.domainSuffix.trim()}`;

  const atIndex = cleanSuffix.indexOf("@");
  const domainOnly = atIndex >= 0 ? cleanSuffix.slice(atIndex + 1) : cleanSuffix;

  let prefix = "";

  if (params.mode === "numeric_dot") {
    // Format: a45286444.6171425682@smsmraw.com
    const p1 = crypto.randomInt(100000000, 999999999);
    const p2 = crypto.randomInt(1000000000, 9999999999);
    prefix = `a${p1}.${p2}`;
  } else if (params.mode === "realistic_name") {
    // Format: mohamed.samy4821@smsmraw.com
    const fn = FIRST_NAMES[crypto.randomInt(0, FIRST_NAMES.length)];
    const ln = LAST_NAMES[crypto.randomInt(0, LAST_NAMES.length)];
    const num = crypto.randomInt(1000, 99999);
    prefix = `${fn}.${ln}${num}`;
  } else if (params.mode === "custom_prefix" && params.prefixPattern?.trim()) {
    const base = params.prefixPattern
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const seq = String(params.index + 1).padStart(2, "0");
    const randDigits = crypto.randomInt(1000, 9999);
    prefix = `${base || "user"}${seq}.${randDigits}`;
  } else {
    const adj = WORD_ADJECTIVES[crypto.randomInt(0, WORD_ADJECTIVES.length)];
    const noun = WORD_NOUNS[crypto.randomInt(0, WORD_NOUNS.length)];
    const randToken = crypto.randomBytes(3).toString("hex").slice(0, 5);
    prefix = `${adj}_${noun}.${randToken}`;
  }

  const fullEmail = cleanSuffix.startsWith(".")
    ? `${prefix}${cleanSuffix}`
    : `${prefix}@${domainOnly}`;
  const [finalPrefix, finalDomain] = fullEmail.split("@");

  return {
    email: fullEmail,
    prefix: finalPrefix,
    domain: finalDomain || domainOnly,
  };
}
