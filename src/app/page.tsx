"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Copy,
  FileSpreadsheet,
  FileText,
  Layers,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Trash2,
  Wand2,
  X,
  Zap,
} from "lucide-react";
import type {
  AliasRecord,
  DashboardStats,
  GenerationMode,
  ProviderSettingsClient,
} from "@/lib/types";
import { ApiConnectionModal } from "@/components/ApiConnectionModal";
import { AliasDetailModal } from "@/components/AliasDetailModal";

const DEFAULT_SETTINGS: ProviderSettingsClient = {
  apiBaseUrl: "https://app.simplelogin.io",
  hasApiKey: false,
  apiKeyPreview: null,
  hasCloudflareKey: false,
  cloudflareKeyPreview: null,
  cloudflareAuthEmail: "mhmdsamy112233@gmail.com",
  cloudflareLiveCatchAll: null,
  cloudflareConnected: false,
  cloudflareError: null,
  mode: "sandbox",
  primaryEmail: "mhmdsamy112233@gmail.com",
  defaultMailboxId: 10421,
  defaultSuffix: "@smsmraw.com",
  defaultSignedSuffix: "sl_sig_smsmraw.com.v5.verified",
  accountName: "Cloudflare & SimpleLogin Workspace",
  accountEmail: "mhmdsamy112233@gmail.com",
  isPremium: true,
  inTrial: false,
  maxAliasFreePlan: 10,
  canCreate: true,
  availableSuffixes: [
    {
      suffix: "@smsmraw.com",
      signed_suffix: "sl_sig_smsmraw.com.v5.verified",
      is_custom: true,
      is_premium: false,
    },
  ],
  availableMailboxes: [
    {
      id: 10421,
      email: "mhmdsamy112233@gmail.com",
      default: true,
      verified: true,
    },
  ],
  lastSyncedAt: null,
  databaseEngine: "PostgreSQL 16",
  quota: {
    totalLimit: 5000,
    currentCount: 0,
    remaining: 500,
    maxPerBatch: 500,
    isUnlimitedPlan: true,
  },
};

export default function BulkEmailAliasDashboard() {
  const [settings, setSettings] =
    useState<ProviderSettingsClient>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<DashboardStats>({
    totalAliases: 0,
    activeAliases: 0,
    unusedAliases: 0,
    usedAliases: 0,
    disabledAliases: 0,
    failedAliases: 0,
    totalForwarded: 0,
    totalReplies: 0,
    totalBlocked: 0,
    totalBatches: 0,
    uniqueDomains: 0,
  });
  const [aliases, setAliases] = useState<AliasRecord[]>([]);
  const [nextUnusedAlias, setNextUnusedAlias] = useState<AliasRecord | null>(
    null
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unused" | "used"
  >("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingTable, setLoadingTable] = useState(true);

  const [primaryEmailInput, setPrimaryEmailInput] = useState(
    "mhmdsamy112233@gmail.com"
  );
  const [newReceiverInput, setNewReceiverInput] = useState("");
  const [switchingReceiver, setSwitchingReceiver] = useState(false);
  const [quantity, setQuantity] = useState(25);
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("numeric_dot");
  const [prefixPattern, setPrefixPattern] = useState("rawda");
  const [domainSuffix, setDomainSuffix] = useState("@smsmraw.com");
  const [batchNote, setBatchNote] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lastCopiedEmail, setLastCopiedEmail] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeAliasModal, setActiveAliasModal] =
    useState<AliasRecord | null>(null);
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" | "info" = "success") => {
      setToast({ text, type });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(t);
  }, [toast]);

  const loadSettings = useCallback(async () => {
    try {
      const r = await fetch("/api/settings");
      const d = await r.json();
      if (d.settings) {
        setSettings(d.settings);
        if (d.settings.primaryEmail) {
          setPrimaryEmailInput(d.settings.primaryEmail);
        }
        if (d.settings.defaultSuffix) {
          setDomainSuffix(d.settings.defaultSuffix);
        }
      }
      if (d.stats) setStats(d.stats);
    } catch {}
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const fetchAliases = useCallback(async () => {
    setLoadingTable(true);
    try {
      const q = new URLSearchParams({
        search,
        status: statusFilter,
        page: String(page),
        pageSize: String(pageSize),
      });
      const res = await fetch(`/api/aliases?${q.toString()}`);
      const d = await res.json();
      if (res.ok) {
        setAliases(d.aliases || []);
        setNextUnusedAlias(d.nextUnusedAlias || null);
        setTotalItems(d.pagination?.totalItems ?? 0);
        setTotalPages(d.pagination?.totalPages ?? 1);
        if (d.stats) setStats(d.stats);
      }
    } finally {
      setLoadingTable(false);
    }
  }, [search, statusFilter, page, pageSize]);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  // 1-Click: Copy Next Unused Email & automatically mark it as Used!
  async function handleCopyNextUnused() {
    const candidate =
      nextUnusedAlias || aliases.find((a) => !a.isUsed && a.enabled);
    if (!candidate) {
      showToast(
        "لا توجد إيميلات جديدة غير مستخدمة حالياً! اضغط على زر (توليد الإيميلات) على اليمين لإنشاء دفعة جديدة.",
        "error"
      );
      return;
    }

    await navigator.clipboard.writeText(candidate.email);
    setLastCopiedEmail(candidate.email);
    setCopiedId("next_unused_btn");
    setTimeout(() => setCopiedId(null), 1800);

    // Optimistic UI update
    setAliases((prev) =>
      prev.map((a) =>
        a.id === candidate.id
          ? { ...a, isUsed: true, usedAt: new Date().toISOString() }
          : a
      )
    );

    await fetch(`/api/aliases/${candidate.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mark_used" }),
    });
    await fetchAliases();
    showToast(
      `✅ تم نسخ (${candidate.email}) وتحديده كمستخدَم! جاهز للصق فوراً.`
    );
  }

  // Copy a specific row & automatically mark it as Used
  async function handleCopyAndMarkUsed(alias: AliasRecord) {
    await navigator.clipboard.writeText(alias.email);
    setLastCopiedEmail(alias.email);
    setCopiedId(alias.id);
    setTimeout(() => setCopiedId(null), 1600);

    if (!alias.isUsed) {
      setAliases((prev) =>
        prev.map((a) =>
          a.id === alias.id
            ? { ...a, isUsed: true, usedAt: new Date().toISOString() }
            : a
        )
      );
      await fetch(`/api/aliases/${alias.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_used" }),
      });
      await fetchAliases();
    }
    showToast(`📋 تم نسخ ${alias.email} وتحديده كمستخدَم`);
  }

  async function handleToggleUsedStatus(alias: AliasRecord) {
    setAliases((prev) =>
      prev.map((a) =>
        a.id === alias.id ? { ...a, isUsed: !a.isUsed } : a
      )
    );
    await fetch(`/api/aliases/${alias.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_used" }),
    });
    await fetchAliases();
  }

  async function handleSwitchReceiver(targetEmail: string) {
    if (!settings.hasCloudflareKey) {
      setIsApiModalOpen(true);
      showToast(
        "يرجى لصق مفتاح Cloudflare Global API Key أولاً في نافذة الإعدادات حتى يقوم الموقع بالتبديل داخل Cloudflare تلقائياً!",
        "error"
      );
      return;
    }
    setSwitchingReceiver(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          switchActiveReceiver: targetEmail,
          updateExistingAliasesToReceiver: true,
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.requireCloudflareKey) setIsApiModalOpen(true);
        throw new Error(d.error || "تعذر تبديل الإيميل في Cloudflare");
      }
      setPrimaryEmailInput(targetEmail);
      if (d.settings) setSettings(d.settings);
      await fetchAliases();
      showToast(
        d.message ||
          `✅ تم تحويل استقبال الـ OTP في Cloudflare إلى ${targetEmail}`
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل التبديل", "error");
    } finally {
      setSwitchingReceiver(false);
    }
  }

  async function handleAddReceiverEmail(e: React.FormEvent) {
    e.preventDefault();
    const clean = newReceiverInput.trim();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      showToast("يرجى كتابة عنوان بريد إلكتروني صحيح.", "error");
      return;
    }
    if (!settings.hasCloudflareKey) {
      setIsApiModalOpen(true);
      showToast(
        "يرجى لصق مفتاح Cloudflare Global API Key أولاً حتى يضيف الموقع الإيميل في Cloudflare ويرسل له رابط التفعيل!",
        "error"
      );
      return;
    }
    setSwitchingReceiver(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addReceiverEmail: clean }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.requireCloudflareKey) setIsApiModalOpen(true);
        throw new Error(d.error || "فشل إضافة الإيميل");
      }
      if (d.settings) {
        setSettings(d.settings);
        setPrimaryEmailInput(d.settings.primaryEmail);
      }
      setNewReceiverInput("");
      await fetchAliases();
      showToast(d.message || `تمت إضافة ${clean}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل الإضافة", "error");
    } finally {
      setSwitchingReceiver(false);
    }
  }

  async function handleRemoveReceiverEmail(emailToRemove: string) {
    setSwitchingReceiver(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removeReceiverEmail: emailToRemove }),
      });
      const d = await res.json();
      if (res.ok && d.settings) {
        setSettings(d.settings);
        setPrimaryEmailInput(d.settings.primaryEmail);
      }
    } finally {
      setSwitchingReceiver(false);
    }
  }

  async function handleGenerateAliases(e: React.FormEvent) {
    e.preventDefault();
    if (generating) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/aliases/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: quantity,
          primaryEmail: primaryEmailInput.trim(),
          generationMode,
          prefixPattern,
          domainSuffix,
          note: batchNote.trim() || undefined,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "فشل توليد الإيميلات");
      if (d.settings) setSettings(d.settings);
      if (d.stats) setStats(d.stats);
      setPage(1);
      await fetchAliases();
      showToast(
        `🎉 تم توليد ${d.createdCount} إيميل جديد جاهز للاستخدام على ${domainSuffix}!`
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "فشل توليد الإيميلات",
        "error"
      );
    } finally {
      setGenerating(false);
    }
  }

  async function handleDeleteAlias(a: AliasRecord) {
    setAliases((p) => p.filter((x) => x.id !== a.id));
    setSelectedIds((p) => p.filter((x) => x !== a.id));
    await fetch(`/api/aliases/${a.id}`, { method: "DELETE" });
    await fetchAliases();
  }

  async function handleBulkAction(
    action:
      | "enable"
      | "disable"
      | "delete"
      | "clear_all"
      | "clear_used"
      | "mark_used"
      | "mark_unused"
  ) {
    if (
      action !== "clear_all" &&
      action !== "clear_used" &&
      !selectedIds.length
    )
      return;
    if (action === "clear_all") {
      setAliases([]);
      setSelectedIds([]);
    } else if (action === "delete") {
      setAliases((p) => p.filter((x) => !selectedIds.includes(x.id)));
      setSelectedIds([]);
    }
    await fetch("/api/aliases/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds, action }),
    });
    await fetchAliases();
    showToast(
      action === "clear_all"
        ? "تم مسح كل الإيميلات من الجدول."
        : action === "clear_used"
        ? "تم مسح الإيميلات المستخدمة والإبقاء على الجديد فقط."
        : "تم تنفيذ الأمر بنجاح."
    );
  }

  function handleExport(
    format: "xlsx" | "csv",
    filterMode: "all" | "unused" | "selected" = "all"
  ) {
    const q = new URLSearchParams({ format });
    if (filterMode === "selected" && selectedIds.length) {
      q.set("ids", selectedIds.join(","));
    } else if (filterMode === "unused") {
      q.set("status", "unused");
    }
    window.open(`/api/aliases/export?${q.toString()}`, "_blank");
    showToast(
      `جاري تحميل ملف ${
        format === "xlsx" ? "Excel (.xlsx)" : "CSV"
      }...`
    );
  }

  const allSelected =
    aliases.length > 0 && aliases.every((a) => selectedIds.includes(a.id));

  return (
    <div dir="rtl" className="relative min-h-screen bg-[#060911] text-right text-slate-100">
      <div className="pointer-events-none fixed inset-x-0 top-0 z-0 h-[420px] bg-[radial-gradient(ellipse_80%_50%_at_50%_-15%,rgba(99,102,241,0.16),rgba(16,185,129,0.06),transparent)]" />

      {/* Toast Notification */}
      {toast ? (
        <div className="fixed left-5 top-5 z-50 flex max-w-lg items-center gap-3 rounded-2xl border border-white/15 bg-[#0F172A]/95 px-4 py-3.5 text-xs shadow-2xl backdrop-blur-xl">
          {toast.type === "error" ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          )}
          <span className="font-medium leading-relaxed">{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="mr-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/[0.08] bg-[#060911]/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-indigo-500/40 bg-indigo-500/15 text-indigo-300">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold text-white">
                  مدير ومولّد الإيميلات الذكي
                </h1>
                <span
                  dir="ltr"
                  className="rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-emerald-300"
                >
                  @smsmraw.com
                </span>
              </div>
              <p className="text-xs text-slate-400">
                توليد فوري، تتبع الإيميلات المستخدمة، وتبديل إيميل استقبال الـ OTP مباشرة مع Cloudflare
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                setSwitchingReceiver(true);
                loadSettings().finally(() => setSwitchingReceiver(false));
              }}
              title="تحديث حالة التفعيل من Cloudflare"
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 text-cyan-400 ${
                  switchingReceiver ? "animate-spin" : ""
                }`}
              />
              <span>تحديث حالة Cloudflare</span>
            </button>

            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-xs font-bold transition ${
                settings.hasCloudflareKey
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                  : "animate-pulse border-amber-500/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
              }`}
            >
              <Cloud className="h-4 w-4" />
              <span>
                {settings.hasCloudflareKey
                  ? "✅ إعدادات Cloudflare متصلة"
                  : "⚠️ اضغط هنا لربط مفتاح Cloudflare API"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
        {/* SECTION 1: LIVE CLOUDFLARE OTP RECEIVER SWITCHER */}
        <section className="rounded-2xl border border-emerald-500/30 bg-gradient-to-l from-[#0B1520] via-[#0B101B] to-[#0B1520] p-5 shadow-xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                <h2 className="text-sm font-bold text-white">
                  1. إيميل استقبال كود الـ OTP الحالي (تبديل مباشر بضغطة زر)
                </h2>
                {settings.hasCloudflareKey ? (
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                    ✅ مربوط بـ Cloudflare مباشر
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsApiModalOpen(true)}
                    className="rounded-full border border-amber-500/50 bg-amber-500/20 px-3 py-0.5 text-[11px] font-bold text-amber-200 hover:bg-amber-500/30"
                  >
                    ⚡ اضغط هنا لإدخال Cloudflare Global API Key لتشغيل التبديل التلقائي
                  </button>
                )}
                {switchingReceiver ? (
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                اضغط على أي إيميل بالأسفل لتحويل كل رسائل الـ OTP القادمة على{" "}
                <strong dir="ltr" className="font-mono text-emerald-300">
                  @smsmraw.com
                </strong>{" "}
                إليه فوراً، أو أضف إيميل جيميل جديد:
              </p>
            </div>

            {/* Add New Receiver Gmail Form */}
            <form
              onSubmit={handleAddReceiverEmail}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                dir="ltr"
                type="email"
                value={newReceiverInput}
                onChange={(e) => setNewReceiverInput(e.target.value)}
                placeholder="new-email@gmail.com"
                className="w-64 rounded-xl border border-white/15 bg-[#060911] px-3.5 py-2 text-left font-mono text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={switchingReceiver}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة إيميل استقبال جديد</span>
              </button>
            </form>
          </div>

          {/* Receiver Email Pills */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5 border-t border-white/[0.08] pt-4">
            {settings.availableMailboxes.map((mb) => {
              const isCurrent =
                primaryEmailInput.toLowerCase() === mb.email.toLowerCase();
              const isVerified = mb.verified !== false;
              return (
                <div
                  key={mb.email}
                  className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 transition ${
                    isCurrent
                      ? "border-emerald-500/70 bg-emerald-500/20 text-white shadow-[0_0_25px_rgba(16,185,129,0.2)]"
                      : "border-white/10 bg-[#070B14] text-slate-300 hover:border-white/25"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSwitchReceiver(mb.email)}
                    className="flex items-center gap-2.5"
                  >
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isCurrent
                          ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                          : isVerified
                          ? "bg-slate-400"
                          : "bg-amber-400"
                      }`}
                    />
                    <span dir="ltr" className="font-mono text-xs font-bold">
                      {mb.email}
                    </span>
                    {!isVerified ? (
                      <span className="rounded-full bg-amber-500/25 px-2.5 py-0.5 text-[11px] font-bold text-amber-200">
                        ⏳ افتح Gmail واضغط Verify أولاً
                      </span>
                    ) : isCurrent ? (
                      <span className="rounded-full bg-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-200">
                        ● يستقبل الـ OTP الآن
                      </span>
                    ) : (
                      <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-medium text-slate-300 hover:bg-white/20 hover:text-white">
                        اضغط لتحويل الـ OTP إليه
                      </span>
                    )}
                  </button>
                  {settings.availableMailboxes.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleRemoveReceiverEmail(mb.email)}
                      title="حذف من القائمة"
                      className="mr-1 text-slate-500 hover:text-rose-400"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION 2: HERO "COPY NEXT UNUSED EMAIL" BAR */}
        <section className="rounded-2xl border border-indigo-500/40 bg-gradient-to-l from-indigo-950/50 via-[#0B101B] to-cyan-950/30 p-5 shadow-xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="rounded-lg bg-indigo-500/20 px-2.5 py-1 text-xs font-bold text-indigo-300">
                  ⚡ النسخ السريع بدون تكرار
                </span>
                <span className="text-xs text-slate-300">
                  متاح للتسجيل:{" "}
                  <strong className="font-mono text-sm text-emerald-400">
                    {stats.unusedAliases}
                  </strong>{" "}
                  إيميل جديد
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-xs text-slate-400">
                  تم استخدامه:{" "}
                  <strong className="font-mono text-sm text-amber-300">
                    {stats.usedAliases}
                  </strong>{" "}
                  إيميل
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-xs text-slate-400">
                  الإيميل التالي الجاهز للنسخ:
                </span>
                {nextUnusedAlias ? (
                  <code
                    dir="ltr"
                    className="rounded-lg border border-indigo-500/30 bg-[#060911] px-3 py-1.5 font-mono text-sm font-bold text-white"
                  >
                    {nextUnusedAlias.email}
                  </code>
                ) : (
                  <span className="text-xs font-medium text-amber-300">
                    لا يوجد إيميلات جديدة حالياً — ولّد دفعة جديدة من القائمة اليمنى
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {lastCopiedEmail ? (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs">
                  <div className="text-[10px] text-emerald-300">
                    آخر إيميل قمت بنسخه الآن:
                  </div>
                  <div
                    dir="ltr"
                    className="font-mono text-xs font-bold text-white"
                  >
                    {lastCopiedEmail}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                disabled={!nextUnusedAlias}
                onClick={handleCopyNextUnused}
                className="inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-l from-indigo-600 to-cyan-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copiedId === "next_unused_btn" ? (
                  <>
                    <Check className="h-5 w-5 text-emerald-300" />
                    <span>تم النسخ وتحديده كمستخدَم!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-5 w-5" />
                    <span>نسخ الإيميل التالي غير المستخدم</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* WORKSPACE GRID: Generator (4 cols) + Table (8 cols) */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Generator Panel */}
          <section className="space-y-4 lg:col-span-4">
            <div className="rounded-2xl border border-white/[0.08] bg-[#0B101B]/95 p-5 shadow-xl">
              <div className="flex items-center gap-3 border-b border-white/[0.08] pb-3.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/15 text-indigo-300">
                  <Wand2 className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-white">
                    توليد دفعة إيميلات جديدة
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    إنشاء فوري حتى 500 إيميل في الضغطة الواحدة
                  </p>
                </div>
              </div>

              <form onSubmit={handleGenerateAliases} className="mt-4 space-y-4">
                {/* Quantity */}
                <div className="rounded-xl border border-white/[0.08] bg-[#070B14] p-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-200">
                      عدد الإيميلات المطلوب توليدها
                    </span>
                    <span className="font-mono text-sm font-bold text-indigo-300">
                      {quantity} إيميل
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {[10, 25, 50, 100, 250, 500].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setQuantity(n)}
                        className={`flex-1 rounded-lg border py-1.5 font-mono text-xs font-bold transition ${
                          quantity === n
                            ? "border-indigo-500 bg-indigo-600 text-white shadow"
                            : "border-white/10 bg-white/[0.02] text-slate-400 hover:text-white"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Format Strategy */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-200">
                    شكل وصيغة الإيميلات
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setGenerationMode("numeric_dot")}
                      className={`flex items-center justify-between rounded-xl border p-3 text-right transition ${
                        generationMode === "numeric_dot"
                          ? "border-indigo-500 bg-indigo-500/15 text-white"
                          : "border-white/10 bg-[#070B14] text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-bold">
                        صيغة أرقام روضة (الأضمن للتسجيل)
                      </span>
                      <code
                        dir="ltr"
                        className="font-mono text-[11px] text-emerald-300"
                      >
                        a45286444.617...@smsmraw.com
                      </code>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGenerationMode("realistic_name")}
                      className={`flex items-center justify-between rounded-xl border p-3 text-right transition ${
                        generationMode === "realistic_name"
                          ? "border-indigo-500 bg-indigo-500/15 text-white"
                          : "border-white/10 bg-[#070B14] text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-bold">
                        أسماء أشخاص طبيعية
                      </span>
                      <code
                        dir="ltr"
                        className="font-mono text-[11px] text-emerald-300"
                      >
                        mohamed.samy4821@smsmraw.com
                      </code>
                    </button>

                    <button
                      type="button"
                      onClick={() => setGenerationMode("custom_prefix")}
                      className={`flex items-center justify-between rounded-xl border p-3 text-right transition ${
                        generationMode === "custom_prefix"
                          ? "border-indigo-500 bg-indigo-500/15 text-white"
                          : "border-white/10 bg-[#070B14] text-slate-400"
                      }`}
                    >
                      <span className="text-xs font-bold">
                        كلمة من اختيارك + ترقيم متسلسل
                      </span>
                      <code
                        dir="ltr"
                        className="font-mono text-[11px] text-emerald-300"
                      >
                        {prefixPattern || "rawda"}01.4821@smsmraw.com
                      </code>
                    </button>
                  </div>
                </div>

                {generationMode === "custom_prefix" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-300">
                      اكتب الكلمة التي تريدها في بداية الإيميل:
                    </label>
                    <input
                      dir="ltr"
                      type="text"
                      required
                      value={prefixPattern}
                      onChange={(e) => setPrefixPattern(e.target.value)}
                      placeholder="rawda"
                      className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3.5 py-2 text-left font-mono text-xs text-white"
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    نطاق الدومين (Domain Suffix)
                  </label>
                  <input
                    dir="ltr"
                    type="text"
                    value={domainSuffix}
                    onChange={(e) => setDomainSuffix(e.target.value)}
                    className="w-full rounded-xl border border-emerald-500/40 bg-[#070B14] px-3.5 py-2 text-left font-mono text-xs font-bold text-emerald-300"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-300">
                    ملاحظة على هذه الدفعة (اختياري)
                  </label>
                  <input
                    type="text"
                    value={batchNote}
                    onChange={(e) => setBatchNote(e.target.value)}
                    placeholder="مثلاً: دفعة تسجيل يوم الثلاثاء..."
                    className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3.5 py-2 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-emerald-600 to-teal-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-110 disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  <span>
                    {generating
                      ? "جاري التوليد الفوري..."
                      : `توليد ${quantity} إيميل جديد الآن`}
                  </span>
                </button>
              </form>
            </div>
          </section>

          {/* Table & Export Panel */}
          <section className="space-y-4 lg:col-span-8">
            <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0B101B]/95 shadow-xl">
              {/* Top Toolbar */}
              <div className="space-y-3 border-b border-white/[0.08] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setPage(1);
                      }}
                      placeholder="ابحث عن أي إيميل أو ملاحظة..."
                      className="w-full rounded-xl border border-white/10 bg-[#070B14] py-2.5 pl-4 pr-10 text-xs text-white"
                    />
                  </div>

                  {/* Excel & CSV Export Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleExport("xlsx", "unused")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                      <span>تصدير المتاح فقط Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("xlsx", "all")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.05] px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                    >
                      <FileSpreadsheet className="h-4 w-4 text-cyan-400" />
                      <span>تصدير الكل Excel</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExport("csv", "all")}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-medium text-slate-300 hover:bg-white/10"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>CSV</span>
                    </button>
                  </div>
                </div>

                {/* Filter Tabs + Quick Cleanup Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex gap-1 rounded-xl border border-white/[0.08] bg-[#070B14] p-1">
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("all");
                        setPage(1);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        statusFilter === "all"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      الكل ({stats.totalAliases})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("unused");
                        setPage(1);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        statusFilter === "unused"
                          ? "bg-emerald-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      ✨ جديد غير مستخدم ({stats.unusedAliases})
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("used");
                        setPage(1);
                      }}
                      className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                        statusFilter === "used"
                          ? "bg-amber-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      ✅ تم استخدامه ({stats.usedAliases})
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    {stats.usedAliases > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleBulkAction("clear_used")}
                        className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>حذف المستخدَم فقط ({stats.usedAliases})</span>
                      </button>
                    ) : null}
                    {stats.totalAliases > 0 ? (
                      <button
                        type="button"
                        onClick={() => handleBulkAction("clear_all")}
                        className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>مسح الجدول بالكامل</span>
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-right">
                  <thead>
                    <tr className="border-b border-white/[0.08] bg-[#070B14]/80 text-xs font-bold text-slate-400">
                      <th className="w-10 px-4 py-3 text-center">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={() =>
                            setSelectedIds(
                              allSelected ? [] : aliases.map((a) => a.id)
                            )
                          }
                          className="h-3.5 w-3.5 accent-indigo-500"
                        />
                      </th>
                      <th className="px-3 py-3">الإيميل المولّد (Alias Email)</th>
                      <th className="px-3 py-3">حالة الاستخدام</th>
                      <th className="px-3 py-3">يستقبل الـ OTP على</th>
                      <th className="px-4 py-3 text-left">إجراءات سريعة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.06] text-xs">
                    {loadingTable ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-16 text-center text-slate-400"
                        >
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-400" />
                        </td>
                      </tr>
                    ) : aliases.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-16 text-center text-slate-400"
                        >
                          <Mail className="mx-auto mb-2 h-8 w-8 text-slate-600" />
                          <div className="text-sm font-bold text-slate-200">
                            الجدول فارغ وجاهز
                          </div>
                          <p className="mt-1 text-xs text-slate-500">
                            اضغط على زر (توليد إيميلات جديدة الآن) في اللوحة اليمنى لإنشاء دفعتك الأولى.
                          </p>
                        </td>
                      </tr>
                    ) : (
                      aliases.map((a) => {
                        const isCopied = copiedId === a.id;
                        return (
                          <tr
                            key={a.id}
                            className={`transition ${
                              a.isUsed
                                ? "bg-white/[0.01] opacity-65"
                                : "hover:bg-white/[0.03]"
                            }`}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedIds.includes(a.id)}
                                onChange={() =>
                                  setSelectedIds((p) =>
                                    p.includes(a.id)
                                      ? p.filter((x) => x !== a.id)
                                      : [...p, a.id]
                                  )
                                }
                                className="h-3.5 w-3.5 accent-indigo-500"
                              />
                            </td>

                            {/* Email Address */}
                            <td className="px-3 py-3">
                              <div className="flex items-center gap-2">
                                <span
                                  dir="ltr"
                                  onClick={() => handleCopyAndMarkUsed(a)}
                                  className={`cursor-pointer font-mono text-xs font-bold transition ${
                                    a.isUsed
                                      ? "text-slate-400 line-through"
                                      : "text-white hover:text-emerald-300"
                                  }`}
                                >
                                  {a.prefix}
                                  <span className="text-emerald-400">
                                    @{a.domain}
                                  </span>
                                </span>
                              </div>
                              {a.note ? (
                                <div className="mt-0.5 text-[11px] text-slate-500">
                                  {a.note}
                                </div>
                              ) : null}
                            </td>

                            {/* Used / Unused Status Badge (Clickable to toggle) */}
                            <td className="px-3 py-3">
                              <button
                                type="button"
                                onClick={() => handleToggleUsedStatus(a)}
                                title="اضغط لتغيير الحالة بين جديد ومستخدَم"
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition ${
                                  a.isUsed
                                    ? "border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
                                    : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25"
                                }`}
                              >
                                {a.isUsed ? (
                                  <>
                                    <Check className="h-3 w-3" />
                                    <span>تم استخدامه</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="h-3 w-3" />
                                    <span>جديد متاح</span>
                                  </>
                                )}
                              </button>
                            </td>

                            {/* OTP Receiver */}
                            <td className="px-3 py-3">
                              <div
                                dir="ltr"
                                className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-300"
                              >
                                <ArrowLeft className="h-3.5 w-3.5 text-emerald-400" />
                                <span>{a.primaryEmail}</span>
                              </div>
                            </td>

                            {/* Quick Actions */}
                            <td className="px-4 py-3 text-left">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleCopyAndMarkUsed(a)}
                                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                                    isCopied
                                      ? "border-emerald-500 bg-emerald-600 text-white"
                                      : a.isUsed
                                      ? "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                      : "border-indigo-500/40 bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30"
                                  }`}
                                >
                                  {isCopied ? (
                                    <>
                                      <Check className="h-3.5 w-3.5" />
                                      <span>تم النسخ!</span>
                                    </>
                                  ) : (
                                    <>
                                      <Copy className="h-3.5 w-3.5" />
                                      <span>
                                        {a.isUsed ? "نسخ مرة أخرى" : "نسخ واستخدام"}
                                      </span>
                                    </>
                                  )}
                                </button>

                                {a.isUsed ? (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUsedStatus(a)}
                                    title="إعادته كجديد غير مستخدم"
                                    className="rounded-xl border border-white/10 bg-white/[0.03] p-1.5 text-slate-400 hover:text-white"
                                  >
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}

                                <button
                                  type="button"
                                  onClick={() => setActiveAliasModal(a)}
                                  title="تفاصيل وملاحظات"
                                  className="rounded-xl border border-white/10 bg-white/[0.03] p-1.5 text-slate-300 hover:text-white"
                                >
                                  <Settings2 className="h-3.5 w-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteAlias(a)}
                                  title="حذف"
                                  className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] bg-[#070B14]/80 px-4 py-3 text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span>
                    إجمالي المعروض:{" "}
                    <strong className="font-mono text-white">
                      {totalItems}
                    </strong>{" "}
                    إيميل
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="rounded-lg border border-white/10 bg-[#0C1220] px-2.5 py-1 font-mono text-xs text-white"
                  >
                    {[25, 50, 100, 250].map((s) => (
                      <option key={s} value={s}>
                        {s} في الصفحة
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="rounded-lg border border-white/10 px-3 py-1 text-slate-200 disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <span className="font-mono">
                    صفحة {page} من {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="rounded-lg border border-white/10 px-3 py-1 text-slate-200 disabled:opacity-40"
                  >
                    التالي
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Floating Bulk Management Bar */}
      {selectedIds.length > 0 ? (
        <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2">
          <div className="flex flex-wrap items-center gap-2.5 rounded-2xl border border-indigo-500/40 bg-[#0D1322]/95 px-5 py-3 shadow-2xl backdrop-blur-xl">
            <span className="text-xs font-bold text-indigo-300">
              تم تحديد {selectedIds.length} إيميل
            </span>
            <button
              type="button"
              onClick={() => handleBulkAction("mark_used")}
              className="rounded-xl border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-bold text-amber-200"
            >
              تحديد كمستخدَم
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction("mark_unused")}
              className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-bold text-emerald-200"
            >
              إعادة كجديد
            </button>
            <button
              type="button"
              onClick={() => handleExport("xlsx", "selected")}
              className="rounded-xl border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-bold text-white"
            >
              تصدير المحدد Excel
            </button>
            <button
              type="button"
              onClick={() => handleBulkAction("delete")}
              className="rounded-xl border border-rose-500/35 bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-200"
            >
              حذف المحدد
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}

      <ApiConnectionModal
        isOpen={isApiModalOpen}
        onClose={() => setIsApiModalOpen(false)}
        settings={settings}
        onUpdated={(s, m) => {
          setSettings(s);
          setPrimaryEmailInput(s.primaryEmail);
          if (m) showToast(m);
          fetchAliases();
        }}
      />

      <AliasDetailModal
        alias={activeAliasModal}
        mailboxes={settings.availableMailboxes}
        onClose={() => setActiveAliasModal(null)}
        onUpdated={() => fetchAliases()}
        onDeleted={() => fetchAliases()}
      />
    </div>
  );
}
