"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  ArrowUpDown,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Filter,
  Hash,
  KeyRound,
  Layers,
  Loader2,
  Mail,
  Pin,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import {
  AliasRecord,
  DashboardStats,
  GenerationBatchRecord,
  ProviderSettingsClient,
} from "@/lib/types";
import { ApiConnectionModal } from "@/components/ApiConnectionModal";
import { AliasDetailModal } from "@/components/AliasDetailModal";

const DEFAULT_SETTINGS: ProviderSettingsClient = {
  apiBaseUrl: "https://app.simplelogin.io",
  hasApiKey: false,
  apiKeyPreview: null,
  mode: "sandbox",
  primaryEmail: "ops-primary@proton.me",
  defaultMailboxId: 10421,
  defaultSuffix: "@simplelogin.com",
  defaultSignedSuffix: "sl_sig_simplelogin.com.v5.verified",
  accountName: "SimpleLogin Workspace",
  accountEmail: "ops-primary@proton.me",
  isPremium: true,
  inTrial: false,
  maxAliasFreePlan: 10,
  canCreate: true,
  availableSuffixes: [
    {
      suffix: "@simplelogin.com",
      signed_suffix: "sl_sig_simplelogin.com.v5.verified",
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
    {
      suffix: "@passmail.net",
      signed_suffix: "sl_sig_passmail.net.v5.verified",
      is_custom: false,
      is_premium: false,
    },
  ],
  availableMailboxes: [
    {
      id: 10421,
      email: "ops-primary@proton.me",
      default: true,
      verified: true,
    },
  ],
  lastSyncedAt: null,
  databaseEngine: "PostgreSQL 16",
  quota: {
    totalLimit: 500,
    currentCount: 6,
    remaining: 50,
    maxPerBatch: 50,
    isUnlimitedPlan: true,
  },
};

const DEFAULT_STATS: DashboardStats = {
  totalAliases: 0,
  activeAliases: 0,
  disabledAliases: 0,
  failedAliases: 0,
  totalForwarded: 0,
  totalReplies: 0,
  totalBlocked: 0,
  totalBatches: 0,
  uniqueDomains: 0,
};

export default function BulkEmailAliasDashboard() {
  // Data state
  const [settings, setSettings] =
    useState<ProviderSettingsClient>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<DashboardStats>(DEFAULT_STATS);
  const [aliases, setAliases] = useState<AliasRecord[]>([]);
  const [domains, setDomains] = useState<string[]>([]);
  const [recentBatches, setRecentBatches] = useState<GenerationBatchRecord[]>(
    []
  );

  // Table query & pagination state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "disabled" | "failed"
  >("all");
  const [domainFilter, setDomainFilter] = useState("all");
  const [batchFilter, setBatchFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    "createdAt" | "email" | "primaryEmail" | "status" | "nbForward" | "domain"
  >("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingTable, setLoadingTable] = useState(true);

  // Bulk generator form state
  const [primaryEmailInput, setPrimaryEmailInput] = useState(
    "ops-primary@proton.me"
  );
  const [quantity, setQuantity] = useState(5);
  const [generationMode, setGenerationMode] = useState<
    "random_word" | "random_uuid" | "custom_prefix"
  >("random_word");
  const [prefixPattern, setPrefixPattern] = useState("saas-client");
  const [domainSuffix, setDomainSuffix] = useState("@simplelogin.com");
  const [batchNote, setBatchNote] = useState("");
  const [batchDisplayName, setBatchDisplayName] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastGeneratedBatch, setLastGeneratedBatch] = useState<{
    batch: GenerationBatchRecord | null;
    aliases: AliasRecord[];
  } | null>(null);

  // Selection & modals state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeAliasModal, setActiveAliasModal] =
    useState<AliasRecord | null>(null);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [syncingRemote, setSyncingRemote] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" | "info" = "success") => {
      setToast({ text, type });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 180);
    return () => clearTimeout(timer);
  }, [search]);

  // Global keyboard shortcuts (Linear/Raycast feel)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === "g") {
        e.preventDefault();
        quantityInputRef.current?.focus();
      } else if (e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        setIsApiModalOpen(true);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Initial settings load
  useEffect(() => {
    async function loadInitialSettings() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) return;
        const data = await res.json();
        if (data.settings) {
          setSettings(data.settings);
          setPrimaryEmailInput(data.settings.primaryEmail || "");
          if (data.settings.defaultSuffix) {
            setDomainSuffix(data.settings.defaultSuffix);
          }
        }
        if (data.stats) setStats(data.stats);
        if (data.recentBatches) setRecentBatches(data.recentBatches);
      } catch {
        // Ignore initial error, handled by table fetch
      }
    }
    loadInitialSettings();
  }, []);

  const fetchAliases = useCallback(async () => {
    setLoadingTable(true);
    try {
      const params = new URLSearchParams({
        search: debouncedSearch,
        status: statusFilter,
        domain: domainFilter,
        batchId: batchFilter,
        sortBy,
        sortOrder,
        page: String(page),
        pageSize: String(pageSize),
      });

      const res = await fetch(`/api/aliases?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load aliases");
      }

      setAliases(data.aliases || []);
      setTotalItems(data.pagination?.totalItems ?? 0);
      setTotalPages(data.pagination?.totalPages ?? 1);
      if (data.domains) setDomains(data.domains);
      if (data.stats) setStats(data.stats);
      if (data.settings) setSettings(data.settings);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to fetch aliases",
        "error"
      );
    } finally {
      setLoadingTable(false);
    }
  }, [
    debouncedSearch,
    statusFilter,
    domainFilter,
    batchFilter,
    sortBy,
    sortOrder,
    page,
    pageSize,
    showToast,
  ]);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  // Clamp quantity to permitted limit whenever quota changes
  useEffect(() => {
    const maxAllowed = Math.max(1, settings.quota.maxPerBatch);
    if (quantity > maxAllowed) {
      setQuantity(maxAllowed);
    }
  }, [settings.quota.maxPerBatch, quantity]);

  // Generate Bulk Aliases Handler
  async function handleGenerateAliases(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;

    const cleanEmail = primaryEmailInput.trim();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showToast(
        "Please enter a valid primary email address for alias forwarding.",
        "error"
      );
      return;
    }

    if (settings.quota.maxPerBatch <= 0) {
      showToast(
        `Provider plan limit reached (${settings.quota.currentCount}/${settings.quota.totalLimit} aliases). Delete unused aliases or switch to Premium plan in API settings.`,
        "error"
      );
      return;
    }

    if (quantity < 1 || quantity > settings.quota.maxPerBatch) {
      showToast(
        `Quantity must be between 1 and ${settings.quota.maxPerBatch} (your permitted provider limit).`,
        "error"
      );
      return;
    }

    setGenerating(true);
    try {
      const res = await fetch("/api/aliases/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: quantity,
          primaryEmail: cleanEmail,
          generationMode,
          prefixPattern:
            generationMode === "custom_prefix" ? prefixPattern : undefined,
          domainSuffix,
          note: batchNote.trim() || undefined,
          displayName: batchDisplayName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Bulk alias generation failed");
      }

      setLastGeneratedBatch({
        batch: data.batch,
        aliases: data.createdAliases || [],
      });

      if (data.batch) {
        setRecentBatches((prev) => [data.batch, ...prev.slice(0, 7)]);
      }
      if (data.settings) setSettings(data.settings);
      if (data.stats) setStats(data.stats);

      setPage(1);
      await fetchAliases();

      if (data.failedCount > 0) {
        showToast(
          `Created ${data.createdCount} aliases (${data.failedCount} failed: ${
            data.errors?.[0] || "Check provider logs"
          })`,
          "info"
        );
      } else {
        showToast(
          `Generated ${data.createdCount} email ${
            data.createdCount === 1 ? "alias" : "aliases"
          } forwarded to ${cleanEmail}`,
          "success"
        );
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to generate aliases",
        "error"
      );
    } finally {
      setGenerating(false);
    }
  }

  // Toggle single alias
  async function handleToggleAlias(alias: AliasRecord) {
    setTogglingId(alias.id);
    try {
      const res = await fetch(`/api/aliases/${alias.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle" }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle alias");
      }
      setAliases((prev) =>
        prev.map((a) => (a.id === alias.id ? data.alias : a))
      );
      if (data.stats) setStats(data.stats);
      if (data.settings) setSettings(data.settings);
      showToast(
        `${data.alias.email} is now ${
          data.alias.enabled ? "Active (Forwarding Enabled)" : "Disabled (Paused)"
        }`,
        "info"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to toggle alias",
        "error"
      );
    } finally {
      setTogglingId(null);
    }
  }

  // Delete single alias
  async function handleDeleteAlias(alias: AliasRecord) {
    setDeletingId(alias.id);
    try {
      const res = await fetch(`/api/aliases/${alias.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete alias");
      }
      setSelectedIds((prev) => prev.filter((id) => id !== alias.id));
      if (data.stats) setStats(data.stats);
      if (data.settings) setSettings(data.settings);
      await fetchAliases();
      showToast(`Deleted alias ${alias.email}`, "info");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to delete alias",
        "error"
      );
    } finally {
      setDeletingId(null);
    }
  }

  // Bulk actions (enable, disable, delete)
  async function handleBulkAction(action: "enable" | "disable" | "delete") {
    if (selectedIds.length === 0 || bulkProcessing) return;
    setBulkProcessing(true);
    try {
      const res = await fetch("/api/aliases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedIds,
          action,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Bulk action failed");
      }
      if (action === "delete") {
        setSelectedIds([]);
      }
      if (data.stats) setStats(data.stats);
      if (data.settings) setSettings(data.settings);
      await fetchAliases();
      showToast(
        `Bulk ${action} completed for ${data.processedCount} aliases.`,
        "success"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Bulk operation failed",
        "error"
      );
    } finally {
      setBulkProcessing(false);
    }
  }

  // Sync with live SimpleLogin account
  async function handleSyncSimpleLogin() {
    if (syncingRemote) return;
    if (settings.mode !== "live" || !settings.hasApiKey) {
      setIsApiModalOpen(true);
      return;
    }
    setSyncingRemote(true);
    try {
      const res = await fetch("/api/aliases/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to sync with SimpleLogin");
      }
      if (data.settings) setSettings(data.settings);
      if (data.stats) setStats(data.stats);
      await fetchAliases();
      showToast(
        `Synced ${data.syncedCount} aliases from SimpleLogin API into PostgreSQL.`,
        "success"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Remote sync failed",
        "error"
      );
    } finally {
      setSyncingRemote(false);
    }
  }

  // Export handler (.xlsx and .csv)
  function handleExport(format: "xlsx" | "csv", onlySelected = false) {
    const params = new URLSearchParams({ format });
    if (onlySelected && selectedIds.length > 0) {
      params.set("ids", selectedIds.join(","));
    } else {
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (domainFilter !== "all") params.set("domain", domainFilter);
    }
    const url = `/api/aliases/export?${params.toString()}`;
    window.open(url, "_blank");
    showToast(
      `Exporting ${
        onlySelected && selectedIds.length > 0
          ? `${selectedIds.length} selected`
          : "filtered"
      } aliases to ${format.toUpperCase()}...`,
      "info"
    );
  }

  // Copy helper
  function handleCopyText(text: string, id: number | string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1600);
  }

  function handleCopySelectedEmails() {
    const selectedEmails = aliases
      .filter((a) => selectedIds.includes(a.id))
      .map((a) => a.email)
      .join("\n");
    if (!selectedEmails) return;
    navigator.clipboard.writeText(selectedEmails);
    showToast(
      `Copied ${selectedIds.length} alias email addresses to clipboard.`,
      "info"
    );
  }

  // Sort handler
  function toggleSort(
    column:
      | "createdAt"
      | "email"
      | "primaryEmail"
      | "status"
      | "nbForward"
      | "domain"
  ) {
    if (sortBy === column) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
    setPage(1);
  }

  const allOnPageSelected =
    aliases.length > 0 && aliases.every((a) => selectedIds.includes(a.id));

  function toggleSelectAllOnPage() {
    if (allOnPageSelected) {
      const pageIds = new Set(aliases.map((a) => a.id));
      setSelectedIds((prev) => prev.filter((id) => !pageIds.has(id)));
    } else {
      const merged = new Set([...selectedIds, ...aliases.map((a) => a.id)]);
      setSelectedIds(Array.from(merged));
    }
  }

  function toggleSelectOne(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  const maxPermittedBatch = settings.quota.maxPerBatch;
  const cleanSuffixPreview = domainSuffix.startsWith("@")
    ? domainSuffix
    : `@${domainSuffix}`;
  const previewAliasExample =
    generationMode === "custom_prefix"
      ? `${(prefixPattern || "alias")
          .toLowerCase()
          .replace(/[^a-z0-9._-]/g, "-")}-01.a8f2c${cleanSuffixPreview}`
      : generationMode === "random_uuid"
      ? `sl.49a1e0c2-7f1b-4d9a${cleanSuffixPreview}`
      : `cobalt_falcon.8f2a1${cleanSuffixPreview}`;

  return (
    <div className="relative min-h-screen bg-[#060911] text-slate-100">
      {/* Subtle Ambient Top Glows (Linear / Raycast aesthetic) */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(99,102,241,0.16),rgba(6,182,212,0.05),transparent)]" />

      {/* Toast Notification Banner */}
      {toast ? (
        <div className="fixed right-5 top-5 z-50 flex max-w-md items-center gap-3 rounded-xl border border-white/15 bg-[#0F172A]/95 px-4 py-3 text-xs shadow-2xl backdrop-blur-xl">
          {toast.type === "error" ? (
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          )}
          <span className="font-medium text-slate-100">{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {/* Top Glass Header Bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#060911]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand Identity */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-500/25 via-indigo-500/10 to-cyan-500/20 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]">
              <Layers className="h-4 w-4 text-indigo-300" />
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#060911] bg-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-semibold tracking-tight text-white">
                  Bulk Email Alias Manager
                </h1>
                <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 font-mono text-[10px] font-medium text-indigo-300">
                  SimpleLogin API v5
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                High-throughput alias provisioning, forwarding control & Excel/CSV exporter
              </p>
            </div>
          </div>

          {/* Right Status Pills & Action Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Database Pill */}
            <div className="hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-slate-300 lg:flex">
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              <span>PostgreSQL 16</span>
            </div>

            {/* Active Forwarding Mailbox Pill */}
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className="hidden items-center gap-1.5 rounded-lg border border-white/[0.07] bg-white/[0.02] px-2.5 py-1.5 text-[11px] text-slate-300 transition hover:border-white/15 hover:bg-white/[0.05] md:flex"
            >
              <Mail className="h-3.5 w-3.5 text-indigo-400" />
              <span className="text-slate-400">Primary:</span>
              <span className="font-mono font-medium text-white">
                {primaryEmailInput || settings.primaryEmail}
              </span>
            </button>

            {/* Sync Button (for Live Mode) */}
            {settings.mode === "live" && settings.hasApiKey ? (
              <button
                type="button"
                disabled={syncingRemote}
                onClick={handleSyncSimpleLogin}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/[0.08] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-cyan-400 ${
                    syncingRemote ? "animate-spin" : ""
                  }`}
                />
                Sync Remote
              </button>
            ) : null}

            {/* API Connection Settings Button */}
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                settings.mode === "live" && settings.hasApiKey
                  ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                  : "border-indigo-500/35 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  settings.mode === "live" && settings.hasApiKey
                    ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                    : "bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
                }`}
              />
              {settings.mode === "live" && settings.hasApiKey ? (
                <>
                  <span>SimpleLogin Live</span>
                  <span className="hidden font-mono text-[10px] opacity-75 sm:inline">
                    ({settings.apiKeyPreview})
                  </span>
                </>
              ) : (
                <>
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>SimpleLogin API Settings</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="relative z-10 mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
        {/* Top 4 KPI Telemetry Cards */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* Card 1: Total Managed Aliases */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0B101B]/90 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Total Managed Aliases
              </span>
              <span className="rounded-lg border border-indigo-500/25 bg-indigo-500/10 p-1.5 text-indigo-400">
                <Hash className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold tracking-tight text-white">
                {stats.totalAliases}
              </span>
              <span className="text-[11px] text-slate-400">
                across{" "}
                <strong className="font-mono text-slate-200">
                  {stats.uniqueDomains}
                </strong>{" "}
                domains
              </span>
            </div>
            <div className="mt-3 flex items-center gap-3 border-t border-white/[0.06] pt-2.5 text-[11px]">
              <span className="inline-flex items-center gap-1 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {stats.activeAliases} Active
              </span>
              <span className="inline-flex items-center gap-1 text-slate-400">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                {stats.disabledAliases} Disabled
              </span>
              {stats.failedAliases > 0 ? (
                <span className="inline-flex items-center gap-1 text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  {stats.failedAliases} Failed
                </span>
              ) : null}
            </div>
          </div>

          {/* Card 2: Provider Plan & Quota Limit */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0B101B]/90 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Provider Plan & Permitted Limit
              </span>
              <span className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 p-1.5 text-cyan-400">
                <SlidersHorizontal className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="font-mono text-2xl font-bold tracking-tight text-white">
                {settings.quota.maxPerBatch}
                <span className="ml-1.5 font-sans text-xs font-normal text-slate-400">
                  max / batch
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                  settings.quota.isUnlimitedPlan
                    ? "border border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                    : "border border-amber-500/30 bg-amber-500/10 text-amber-300"
                }`}
              >
                {settings.quota.isUnlimitedPlan
                  ? "Premium Tier"
                  : `Free Plan (${settings.quota.currentCount}/${settings.quota.totalLimit})`}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px] text-slate-400">
              <span>
                {settings.quota.isUnlimitedPlan
                  ? "Rate-paced 50 aliases/batch limit"
                  : `${settings.quota.remaining} aliases remaining in Free quota`}
              </span>
              <button
                type="button"
                onClick={() => setIsApiModalOpen(true)}
                className="font-medium text-indigo-400 hover:text-indigo-300"
              >
                Configure
              </button>
            </div>
          </div>

          {/* Card 3: Forwarding Configuration */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0B101B]/90 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Primary Forwarding Target
              </span>
              <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-1.5 text-emerald-400">
                <Mail className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 truncate font-mono text-sm font-semibold text-white">
              {primaryEmailInput || settings.primaryEmail}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Verified Mailbox #{settings.defaultMailboxId || 10421}
              </span>
              <span className="font-mono text-slate-400">
                {stats.totalForwarded} fwd • {stats.totalBlocked} blk
              </span>
            </div>
          </div>

          {/* Card 4: Server Security & Rate Limiting */}
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0B101B]/90 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                API Security & Rate Protection
              </span>
              <span className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-1.5 text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
              </span>
            </div>
            <div className="mt-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-white">
                {settings.mode === "live"
                  ? "Official SimpleLogin API"
                  : "Sandbox Provider Active"}
              </span>
              <span className="font-mono text-xs text-emerald-400">
                AES-256-GCM
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px] text-slate-400">
              <span>Server-only key vault • Auto 429 retry</span>
              <span className="font-mono text-slate-300">
                {stats.totalBatches} batches
              </span>
            </div>
          </div>
        </section>

        {/* Workspace Grid: Left Bulk Generator Studio (4 cols) + Right Searchable Alias Table (8 cols) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* LEFT PANEL: Bulk Alias Generator Studio */}
          <section className="space-y-4 lg:col-span-4">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B101B]/95 p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent" />

              <div className="flex items-center justify-between border-b border-white/[0.07] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
                    <Wand2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-white">
                      Bulk Alias Generator
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Provision routed SimpleLogin aliases in bulk
                    </p>
                  </div>
                </div>
                <span className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                  Alt+G
                </span>
              </div>

              <form onSubmit={handleGenerateAliases} className="mt-4 space-y-4">
                {/* Step 1: Primary Email Address */}
                <div>
                  <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-slate-200">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-indigo-400" />
                      1. Primary Email Address (Forwarding Target)
                    </span>
                    <span className="text-[10px] text-emerald-400">
                      Verified Route
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={primaryEmailInput}
                      onChange={(e) => setPrimaryEmailInput(e.target.value)}
                      placeholder="Enter your primary email address..."
                      className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3.5 py-2.5 font-mono text-xs text-white placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                  </div>
                  {settings.availableMailboxes.length > 1 ? (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">
                        Verified mailboxes:
                      </span>
                      {settings.availableMailboxes.map((mb) => (
                        <button
                          key={mb.id}
                          type="button"
                          onClick={() => setPrimaryEmailInput(mb.email)}
                          className={`rounded-md border px-2 py-0.5 font-mono text-[10px] transition ${
                            primaryEmailInput.toLowerCase() ===
                            mb.email.toLowerCase()
                              ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-300"
                              : "border-white/[0.06] bg-white/[0.02] text-slate-400 hover:text-white"
                          }`}
                        >
                          {mb.email}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* Step 2: Quantity within provider's permitted limits */}
                <div className="rounded-xl border border-white/[0.07] bg-[#070B14] p-3.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="alias-quantity-input"
                      className="text-xs font-medium text-slate-200"
                    >
                      2. Number of Aliases to Create
                    </label>
                    <span className="font-mono text-xs font-semibold text-indigo-300">
                      {quantity}{" "}
                      <span className="text-[11px] font-normal text-slate-400">
                        / {maxPermittedBatch} permitted
                      </span>
                    </span>
                  </div>

                  <div className="mt-2.5 flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={Math.max(1, maxPermittedBatch)}
                      value={Math.min(quantity, Math.max(1, maxPermittedBatch))}
                      onChange={(e) =>
                        setQuantity(parseInt(e.target.value, 10) || 1)
                      }
                      disabled={maxPermittedBatch <= 0}
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500"
                    />
                    <input
                      id="alias-quantity-input"
                      ref={quantityInputRef}
                      type="number"
                      min={1}
                      max={Math.max(1, maxPermittedBatch)}
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        if (isNaN(val)) {
                          setQuantity(1);
                        } else {
                          setQuantity(
                            Math.min(
                              Math.max(1, val),
                              Math.max(1, maxPermittedBatch)
                            )
                          );
                        }
                      }}
                      className="w-16 rounded-lg border border-white/10 bg-[#0C1220] px-2 py-1 text-center font-mono text-xs font-semibold text-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  {/* Quick quantity preset pills */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 5, 10, 25, 50]
                        .filter((n) => n <= Math.max(1, maxPermittedBatch))
                        .map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setQuantity(preset)}
                            className={`rounded-md border px-2 py-0.5 font-mono text-[10px] font-medium transition ${
                              quantity === preset
                                ? "border-indigo-500/50 bg-indigo-500/20 text-indigo-200"
                                : "border-white/[0.07] bg-white/[0.02] text-slate-400 hover:border-white/15 hover:text-white"
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {settings.quota.isUnlimitedPlan
                        ? "Rate-safe cap: 50/batch"
                        : `Free plan cap: ${settings.quota.remaining} left`}
                    </span>
                  </div>
                </div>

                {/* Step 3: Generation Mode */}
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-200">
                    3. Alias Generation Mode
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-white/[0.07] bg-[#070B14] p-1">
                    <button
                      type="button"
                      onClick={() => setGenerationMode("random_word")}
                      className={`rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                        generationMode === "random_word"
                          ? "bg-indigo-600 text-white shadow"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Random Words
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerationMode("custom_prefix")}
                      className={`rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                        generationMode === "custom_prefix"
                          ? "bg-indigo-600 text-white shadow"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Custom Prefix
                    </button>
                    <button
                      type="button"
                      onClick={() => setGenerationMode("random_uuid")}
                      className={`rounded-lg px-2.5 py-2 text-xs font-medium transition ${
                        generationMode === "random_uuid"
                          ? "bg-indigo-600 text-white shadow"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      UUID Token
                    </button>
                  </div>
                </div>

                {/* Custom Prefix Input (when Custom Prefix is selected) */}
                {generationMode === "custom_prefix" ? (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-200">
                      Custom Base Prefix
                    </label>
                    <input
                      type="text"
                      required
                      value={prefixPattern}
                      onChange={(e) => setPrefixPattern(e.target.value)}
                      placeholder="e.g. client-onboarding, billing, qa-user"
                      className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3.5 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                ) : null}

                {/* Step 4: Domain Suffix & Note */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-200">
                      Alias Domain Suffix
                    </label>
                    <select
                      value={domainSuffix}
                      onChange={(e) => setDomainSuffix(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {settings.availableSuffixes.map((s) => (
                        <option key={s.suffix} value={s.suffix}>
                          {s.suffix}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-200">
                      Display Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={batchDisplayName}
                      onChange={(e) => setBatchDisplayName(e.target.value)}
                      placeholder="e.g. Q4 Vendor Accounts"
                      className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-200">
                    Batch Note / Metadata (Optional)
                  </label>
                  <input
                    type="text"
                    value={batchNote}
                    onChange={(e) => setBatchNote(e.target.value)}
                    placeholder="Attached to each alias in SimpleLogin..."
                    className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Live Output Pattern Preview Box */}
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.06] p-3">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-indigo-300">
                    <span>Routing & Format Preview</span>
                    <span>
                      {generationMode === "custom_prefix"
                        ? "POST /api/v3/alias/custom/new"
                        : "POST /api/alias/random/new"}
                    </span>
                  </div>
                  <div className="mt-1.5 truncate font-mono text-xs font-medium text-white">
                    {previewAliasExample}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                    <ArrowRight className="h-3 w-3 text-emerald-400" />
                    <span>Forwards to:</span>
                    <span className="text-emerald-300">
                      {primaryEmailInput || settings.primaryEmail}
                    </span>
                  </div>
                </div>

                {/* Generate Submit Button */}
                <button
                  type="submit"
                  disabled={generating || maxPermittedBatch <= 0}
                  className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>
                        Provisioning {quantity}{" "}
                        {quantity === 1 ? "Alias" : "Aliases"} via API...
                      </span>
                    </>
                  ) : maxPermittedBatch <= 0 ? (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      <span>Provider Plan Limit Reached</span>
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      <span>
                        Generate {quantity} Email{" "}
                        {quantity === 1 ? "Alias" : "Aliases"} Now
                      </span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Latest Batch Result / Quick Copy & Export Card */}
            {lastGeneratedBatch && lastGeneratedBatch.aliases.length > 0 ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-[#0B141E]/95 p-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <h3 className="text-xs font-semibold text-white">
                      Latest Batch Provisioned (
                      {lastGeneratedBatch.aliases.length})
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleCopyText(
                        lastGeneratedBatch.aliases
                          .map((a) => a.email)
                          .join("\n"),
                        "batch_copy"
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200 transition hover:bg-emerald-500/20"
                  >
                    {copiedId === "batch_copy" ? (
                      <>
                        <Check className="h-3 w-3" /> Copied All
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" /> Copy All
                      </>
                    )}
                  </button>
                </div>

                <div className="mt-2.5 max-h-36 space-y-1 overflow-y-auto rounded-xl border border-white/[0.06] bg-[#060911] p-2.5 font-mono text-[11px]">
                  {lastGeneratedBatch.aliases.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 text-slate-200"
                    >
                      <span className="truncate">{item.email}</span>
                      <span className="shrink-0 text-[10px] text-emerald-400">
                        → {item.primaryEmail}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Recent Generation Batches Log */}
            {recentBatches.length > 0 ? (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0B101B]/90 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-300">
                    Recent Provisioning Batches
                  </h3>
                  {batchFilter !== "all" ? (
                    <button
                      type="button"
                      onClick={() => setBatchFilter("all")}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300"
                    >
                      Clear Batch Filter
                    </button>
                  ) : null}
                </div>
                <div className="mt-2.5 space-y-1.5">
                  {recentBatches.slice(0, 4).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        setBatchFilter((prev) =>
                          prev === b.id ? "all" : b.id
                        );
                        setPage(1);
                      }}
                      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-left text-xs transition ${
                        batchFilter === b.id
                          ? "border-indigo-500/50 bg-indigo-500/15 text-white"
                          : "border-white/[0.05] bg-white/[0.02] text-slate-300 hover:border-white/15"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 font-mono text-[11px]">
                          <span className="truncate font-semibold text-slate-200">
                            {b.id}
                          </span>
                          <span className="rounded bg-white/5 px-1.5 py-0.2 text-[10px] text-slate-400">
                            {b.generationMode.replace("_", " ")}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-400">
                          → {b.primaryEmail}
                        </div>
                      </div>
                      <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                        +{b.createdCount}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </section>

          {/* RIGHT PANEL: Searchable, Sortable, Paginated Alias Table + Export Suite */}
          <section className="space-y-4 lg:col-span-8">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B101B]/95 shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_0_0_rgba(255,255,255,0.08)]">
              {/* Toolbar: Search, Status Tabs, Domain Filter, and Excel/CSV Export Buttons */}
              <div className="space-y-3 border-b border-white/[0.07] p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search aliases, primary email, domain, note, or batch..."
                      className="w-full rounded-xl border border-white/10 bg-[#070B14] py-2 pl-10 pr-16 text-xs text-white placeholder-slate-500 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    />
                    {search ? (
                      <button
                        type="button"
                        onClick={() => setSearch("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    ) : (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                        ⌘K
                      </span>
                    )}
                  </div>

                  {/* Export to Excel (.xlsx) and CSV Buttons */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExport("xlsx", false)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                    >
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                      <span>Export Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("csv", false)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                    >
                      <FileText className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                {/* Filter Row: Status Pills + Domain Select */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* Status Filter Tabs */}
                  <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/[0.07] bg-[#070B14] p-1">
                    {(
                      [
                        { id: "all", label: "All Aliases", count: stats.totalAliases },
                        {
                          id: "active",
                          label: "Active",
                          count: stats.activeAliases,
                        },
                        {
                          id: "disabled",
                          label: "Disabled",
                          count: stats.disabledAliases,
                        },
                        ...(stats.failedAliases > 0
                          ? [
                              {
                                id: "failed",
                                label: "Failed",
                                count: stats.failedAliases,
                              },
                            ]
                          : []),
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(
                            tab.id as "all" | "active" | "disabled" | "failed"
                          );
                          setPage(1);
                        }}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                          statusFilter === tab.id
                            ? "bg-indigo-600/90 text-white shadow"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        <span>{tab.label}</span>
                        <span
                          className={`rounded-full px-1.5 py-0.2 font-mono text-[10px] ${
                            statusFilter === tab.id
                              ? "bg-black/25 text-indigo-100"
                              : "bg-white/5 text-slate-400"
                          }`}
                        >
                          {tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Domain Filter & Sort Selector */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#070B14] px-2.5 py-1.5 text-xs">
                      <Filter className="h-3.5 w-3.5 text-slate-400" />
                      <select
                        value={domainFilter}
                        onChange={(e) => {
                          setDomainFilter(e.target.value);
                          setPage(1);
                        }}
                        className="bg-transparent font-mono text-xs text-slate-200 focus:outline-none"
                      >
                        <option value="all" className="bg-[#0B101B]">
                          All Domains
                        </option>
                        {domains.map((d) => (
                          <option key={d} value={d} className="bg-[#0B101B]">
                            @{d}
                          </option>
                        ))}
                      </select>
                    </div>

                    {batchFilter !== "all" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/40 bg-indigo-500/15 px-2.5 py-1 font-mono text-[11px] text-indigo-200">
                        Batch: {batchFilter}
                        <button
                          type="button"
                          onClick={() => setBatchFilter("all")}
                          className="hover:text-white"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Data Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/[0.07] bg-[#070B14]/70 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="w-10 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allOnPageSelected}
                          onChange={toggleSelectAllOnPage}
                          aria-label="Select all aliases on this page"
                          className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-[#0C1220] accent-indigo-500"
                        />
                      </th>
                      <th className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort("email")}
                          className="inline-flex items-center gap-1 hover:text-white"
                        >
                          <span>Generated Email Alias</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort("status")}
                          className="inline-flex items-center gap-1 hover:text-white"
                        >
                          <span>Status</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="px-3 py-3">
                        <button
                          type="button"
                          onClick={() => toggleSort("primaryEmail")}
                          className="inline-flex items-center gap-1 hover:text-white"
                        >
                          <span>Forwarding Configuration</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="hidden px-3 py-3 md:table-cell">
                        <button
                          type="button"
                          onClick={() => toggleSort("nbForward")}
                          className="inline-flex items-center gap-1 hover:text-white"
                        >
                          <span>Activity</span>
                          <ArrowDownUp className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="hidden px-3 py-3 xl:table-cell">
                        <button
                          type="button"
                          onClick={() => toggleSort("createdAt")}
                          className="inline-flex items-center gap-1 hover:text-white"
                        >
                          <span>Created</span>
                          <ArrowUpDown className="h-3 w-3" />
                        </button>
                      </th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-white/[0.05] text-xs">
                    {loadingTable ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-16 text-center text-slate-400"
                        >
                          <div className="inline-flex items-center gap-2.5">
                            <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />
                            <span>Querying PostgreSQL alias directory...</span>
                          </div>
                        </td>
                      </tr>
                    ) : aliases.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-16 text-center text-slate-400"
                        >
                          <div className="mx-auto max-w-sm space-y-2">
                            <Mail className="mx-auto h-7 w-7 text-slate-600" />
                            <div className="text-sm font-medium text-slate-200">
                              No matching email aliases found
                            </div>
                            <p className="text-xs text-slate-500">
                              Use the Bulk Alias Generator on the left to create new SimpleLogin aliases, or clear your current search filters.
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      aliases.map((alias) => {
                        const isSelected = selectedIds.includes(alias.id);
                        const isCopied = copiedId === alias.id;
                        return (
                          <tr
                            key={alias.id}
                            className={`group transition ${
                              isSelected
                                ? "bg-indigo-500/[0.08]"
                                : "hover:bg-white/[0.025]"
                            }`}
                          >
                            {/* Checkbox */}
                            <td className="px-4 py-3.5 text-center">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleSelectOne(alias.id)}
                                aria-label={`Select ${alias.email}`}
                                className="h-3.5 w-3.5 cursor-pointer rounded border-white/20 bg-[#0C1220] accent-indigo-500"
                              />
                            </td>

                            {/* Alias Email + Note */}
                            <td className="px-3 py-3.5">
                              <div className="flex items-center gap-2">
                                {alias.pinned ? (
                                  <Pin className="h-3 w-3 shrink-0 text-amber-400" />
                                ) : null}
                                <span
                                  onClick={() => setActiveAliasModal(alias)}
                                  className="cursor-pointer font-mono text-xs font-semibold text-white transition hover:text-indigo-300"
                                >
                                  {alias.prefix}
                                  <span className="text-indigo-400">
                                    @{alias.domain}
                                  </span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopyText(alias.email, alias.id)
                                  }
                                  title="Copy alias email"
                                  className="rounded p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                                >
                                  {isCopied ? (
                                    <Check className="h-3 w-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="h-3 w-3" />
                                  )}
                                </button>
                              </div>

                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                {alias.displayName ? (
                                  <span className="rounded bg-white/[0.05] px-1.5 py-0.2 font-medium text-slate-300">
                                    {alias.displayName}
                                  </span>
                                ) : null}
                                {alias.note ? (
                                  <span className="max-w-[260px] truncate text-slate-500">
                                    {alias.note}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Creation & Active Status */}
                            <td className="px-3 py-3.5">
                              {alias.enabled &&
                              alias.creationStatus === "active" ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                                  Active
                                </span>
                              ) : alias.creationStatus === "failed" ||
                                alias.creationStatus === "rate_limited" ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-300">
                                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                                  {alias.creationStatus === "rate_limited"
                                    ? "Rate Limited"
                                    : "Failed"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/50 bg-slate-800/60 px-2.5 py-0.5 text-[11px] font-medium text-slate-400">
                                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                                  Disabled
                                </span>
                              )}
                            </td>

                            {/* Forwarding Configuration */}
                            <td className="px-3 py-3.5">
                              <div className="flex items-center gap-1.5 font-mono text-xs text-slate-200">
                                <ArrowRight
                                  className={`h-3.5 w-3.5 shrink-0 ${
                                    alias.enabled
                                      ? "text-emerald-400"
                                      : "text-slate-600"
                                  }`}
                                />
                                <span className="truncate">
                                  {alias.primaryEmail}
                                </span>
                              </div>
                              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-500">
                                <span>
                                  {alias.enabled
                                    ? "Forwarding Enabled"
                                    : "Forwarding Paused"}
                                </span>
                                {alias.mailboxId ? (
                                  <span className="font-mono">
                                    • MB #{alias.mailboxId}
                                  </span>
                                ) : null}
                              </div>
                            </td>

                            {/* Traffic Stats */}
                            <td className="hidden px-3 py-3.5 md:table-cell">
                              <div className="flex items-center gap-2 font-mono text-[11px]">
                                <span
                                  title="Forwarded emails"
                                  className="rounded border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-emerald-300"
                                >
                                  {alias.nbForward}F
                                </span>
                                <span
                                  title="Replies sent"
                                  className="rounded border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-indigo-300"
                                >
                                  {alias.nbReply}R
                                </span>
                                <span
                                  title="Blocked emails"
                                  className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-slate-400"
                                >
                                  {alias.nbBlock}B
                                </span>
                              </div>
                            </td>

                            {/* Created Timestamp */}
                            <td className="hidden px-3 py-3.5 font-mono text-[11px] text-slate-400 xl:table-cell">
                              {new Date(alias.createdAt).toLocaleDateString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </td>

                            {/* Actions: Enable/Disable Toggle, Edit, Delete */}
                            <td className="px-4 py-3.5 text-right">
                              <div className="inline-flex items-center justify-end gap-1.5">
                                {/* Enable / Disable Toggle Switch */}
                                <button
                                  type="button"
                                  disabled={togglingId === alias.id}
                                  onClick={() => handleToggleAlias(alias)}
                                  title={
                                    alias.enabled
                                      ? "Disable alias forwarding"
                                      : "Enable alias forwarding"
                                  }
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition ${
                                    alias.enabled
                                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:bg-white/10 hover:text-white"
                                  }`}
                                >
                                  {togglingId === alias.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : alias.enabled ? (
                                    <Power className="h-3 w-3" />
                                  ) : (
                                    <PowerOff className="h-3 w-3" />
                                  )}
                                  <span className="hidden sm:inline">
                                    {alias.enabled ? "Disable" : "Enable"}
                                  </span>
                                </button>

                                {/* Inspect / Edit */}
                                <button
                                  type="button"
                                  onClick={() => setActiveAliasModal(alias)}
                                  title="Configure forwarding & notes"
                                  className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-slate-300 transition hover:bg-white/10 hover:text-white"
                                >
                                  <Settings2 className="h-3.5 w-3.5" />
                                </button>

                                {/* Delete */}
                                <button
                                  type="button"
                                  disabled={deletingId === alias.id}
                                  onClick={() => handleDeleteAlias(alias)}
                                  title="Delete alias"
                                  className="rounded-lg border border-rose-500/25 bg-rose-500/10 p-1.5 text-rose-300 transition hover:bg-rose-500/25 disabled:opacity-50"
                                >
                                  {deletingId === alias.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] bg-[#070B14]/80 px-4 py-3.5 text-xs text-slate-400 sm:px-5">
                <div className="flex items-center gap-3">
                  <span>
                    Showing{" "}
                    <strong className="font-mono text-white">
                      {totalItems === 0 ? 0 : (page - 1) * pageSize + 1}
                    </strong>{" "}
                    to{" "}
                    <strong className="font-mono text-white">
                      {Math.min(page * pageSize, totalItems)}
                    </strong>{" "}
                    of{" "}
                    <strong className="font-mono text-white">
                      {totalItems}
                    </strong>{" "}
                    aliases
                  </span>

                  <div className="flex items-center gap-1.5">
                    <span>Rows:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="rounded-lg border border-white/10 bg-[#0C1220] px-2 py-1 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Page Navigation Buttons */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Prev
                  </button>

                  <span className="px-2 font-mono text-xs text-slate-300">
                    Page <strong className="text-white">{page}</strong> of{" "}
                    <strong className="text-white">{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Raycast / Linear Floating Bulk Management Command Bar */}
      {selectedIds.length > 0 ? (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-indigo-500/40 bg-[#0D1322]/95 px-4 py-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_25px_rgba(99,102,241,0.2)] backdrop-blur-xl">
            <div className="flex items-center gap-2 border-r border-white/10 pr-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-indigo-600 font-mono text-[11px] font-bold text-white">
                {selectedIds.length}
              </span>
              <span className="text-xs font-medium text-white">
                Selected
              </span>
            </div>

            <button
              type="button"
              disabled={bulkProcessing}
              onClick={() => handleBulkAction("enable")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
              <Power className="h-3.5 w-3.5" />
              Enable
            </button>

            <button
              type="button"
              disabled={bulkProcessing}
              onClick={() => handleBulkAction("disable")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-medium text-amber-200 transition hover:bg-amber-500/25 disabled:opacity-50"
            >
              <PowerOff className="h-3.5 w-3.5" />
              Disable
            </button>

            <button
              type="button"
              onClick={handleCopySelectedEmails}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy Emails
            </button>

            <button
              type="button"
              onClick={() => handleExport("xlsx", true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              .XLSX
            </button>

            <button
              type="button"
              onClick={() => handleExport("csv", true)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
            >
              <Download className="h-3.5 w-3.5 text-cyan-400" />
              .CSV
            </button>

            <button
              type="button"
              disabled={bulkProcessing}
              onClick={() => handleBulkAction("delete")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-50"
            >
              {bulkProcessing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="ml-1 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* SimpleLogin API & Security Modal */}
      <ApiConnectionModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        settings={settings}
        onUpdated={(newSettings, msg) => {
          setSettings(newSettings);
          setPrimaryEmailInput(newSettings.primaryEmail);
          if (newSettings.defaultSuffix) {
            setDomainSuffix(newSettings.defaultSuffix);
          }
          if (msg) showToast(msg, "success");
          fetchAliases();
        }}
      />

      {/* Single Alias Detail & Forwarding Modal */}
      <AliasDetailModal
        alias={activeAliasModal}
        mailboxes={settings.availableMailboxes}
        onClose={() => setActiveAliasModal(null)}
        onUpdated={(updated) => {
          setAliases((prev) =>
            prev.map((a) => (a.id === updated.id ? updated : a))
          );
          showToast(`Updated alias ${updated.email}`, "success");
          fetchAliases();
        }}
        onDeleted={(deletedId) => {
          setSelectedIds((prev) => prev.filter((id) => id !== deletedId));
          showToast(`Deleted alias #${deletedId}`, "info");
          fetchAliases();
        }}
      />
    </div>
  );
}
