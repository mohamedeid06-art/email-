export interface SimpleLoginSuffix {
  suffix: string;
  signed_suffix: string;
  is_custom: boolean;
  is_premium: boolean;
}

export interface SimpleLoginMailbox {
  id: number;
  email: string;
  default: boolean;
  verified?: boolean;
  nb_alias?: number;
  creation_timestamp?: number;
}

export interface SimpleLoginUserInfo {
  name: string;
  email: string;
  is_premium: boolean;
  in_trial: boolean;
  max_alias_free_plan: number;
  profile_picture_url?: string;
}

export interface ProviderQuotaInfo {
  totalLimit: number;
  currentCount: number;
  remaining: number;
  maxPerBatch: number;
  isUnlimitedPlan: boolean;
}

export interface ProviderSettingsClient {
  apiBaseUrl: string;
  hasApiKey: boolean;
  apiKeyPreview: string | null;
  hasCloudflareKey: boolean;
  cloudflareKeyPreview: string | null;
  cloudflareAuthEmail: string | null;
  cloudflareLiveCatchAll: string | null;
  cloudflareConnected: boolean;
  cloudflareError: string | null;
  mode: "live" | "sandbox";
  primaryEmail: string;
  defaultMailboxId: number | null;
  defaultSuffix: string | null;
  defaultSignedSuffix: string | null;
  accountName: string | null;
  accountEmail: string | null;
  isPremium: boolean;
  inTrial: boolean;
  maxAliasFreePlan: number;
  canCreate: boolean;
  availableSuffixes: SimpleLoginSuffix[];
  availableMailboxes: SimpleLoginMailbox[];
  lastSyncedAt: string | null;
  databaseEngine: string;
  quota: ProviderQuotaInfo;
}

export type CreationStatus =
  | "active"
  | "disabled"
  | "failed"
  | "rate_limited"
  | "pending";

export type ForwardingStatus =
  | "configured"
  | "paused"
  | "unverified"
  | "error";

export type GenerationMode =
  | "numeric_dot"
  | "realistic_name"
  | "custom_prefix"
  | "random_word";

export interface AliasMailboxRef {
  id: number;
  email: string;
}

export interface AliasRecord {
  id: number;
  remoteAliasId: number | null;
  email: string;
  prefix: string;
  domain: string;
  primaryEmail: string;
  mailboxId: number | null;
  mailboxes: AliasMailboxRef[];
  enabled: boolean;
  isUsed: boolean;
  usedAt: string | null;
  creationStatus: CreationStatus;
  forwardingStatus: ForwardingStatus;
  note: string;
  displayName: string;
  batchId: string | null;
  nbForward: number;
  nbReply: number;
  nbBlock: number;
  pinned: boolean;
  providerMode: "live" | "sandbox";
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationBatchRecord {
  id: string;
  requestedCount: number;
  createdCount: number;
  failedCount: number;
  primaryEmail: string;
  mailboxId: number | null;
  generationMode: GenerationMode;
  prefixPattern: string | null;
  domainSuffix: string | null;
  note: string | null;
  status: "running" | "completed" | "partial" | "failed" | "rate_limited";
  errorSummary: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface DashboardStats {
  totalAliases: number;
  activeAliases: number;
  unusedAliases: number;
  usedAliases: number;
  disabledAliases: number;
  failedAliases: number;
  totalForwarded: number;
  totalReplies: number;
  totalBlocked: number;
  totalBatches: number;
  uniqueDomains: number;
}
