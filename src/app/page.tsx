"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Cloud,
  Copy,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
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
  const [statusFilter, setStatusFilter] = useState<"all" | "unused" | "used">(
    "all"
  );
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
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
  const [generating, setGenerating] = useState(false);
  const [lastCopiedEmail, setLastCopiedEmail] = useState<string | null>(null);

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const showToast = useCallback(
    (text: string, type: "success" | "error" | "info" = "success") => {
      setToast({ text, type });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
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

  async function handleCopyNextUnused() {
    const candidate =
      nextUnusedAlias || aliases.find((a) => !a.isUsed && a.enabled);
    if (!candidate) {
      showToast(
        "لا توجد إيميلات جديدة حالياً! اضغط على زر (توليد إيميلات جديدة) لإنشاء دفعة فورية.",
        "error"
      );
      return;
    }

    await navigator.clipboard.writeText(candidate.email);
    setLastCopiedEmail(candidate.email);
    setCopiedId("next_unused_btn");
    setTimeout(() => setCopiedId(null), 1800);

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
    showToast(`✅ تم نسخ (${candidate.email}) وتحديده كمستخدَم!`);
  }

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
    showToast(`📋 تم نسخ ${alias.email}`);
  }

  async function handleToggleUsedStatus(alias: AliasRecord) {
    setAliases((prev) =>
      prev.map((a) => (a.id === alias.id ? { ...a, isUsed: !a.isUsed } : a))
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
        "يرجى لصق مفتاح Cloudflare Global API Key أولاً في نافذة الإعدادات لتشغيل التبديل المباشر!",
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
    await fetch(`/api/aliases/${a.id}`, { method: "DELETE" });
    await fetchAliases();
  }

  async function handleBulkAction(action: "clear_all" | "clear_used") {
    if (action === "clear_all") setAliases([]);
    await fetch("/api/aliases/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await fetchAliases();
    showToast(
      action === "clear_all"
        ? "تم مسح الجدول بالكامل."
        : "تم حذف الإيميلات المستخدمة والإبقاء على الجديد فقط."
    );
  }

  function handleExport(
    format: "xlsx" | "csv",
    filterMode: "all" | "unused" = "all"
  ) {
    const q = new URLSearchParams({ format });
    if (filterMode === "unused") q.set("status", "unused");
    window.open(`/api/aliases/export?${q.toString()}`, "_blank");
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#070B14] text-right text-slate-100"
    >
      {/* Top Toast */}
      {toast ? (
        <div className="fixed left-6 top-6 z-50 flex max-w-lg items-center gap-3 rounded-2xl border border-white/20 bg-[#0F172A] px-5 py-4 text-sm font-semibold shadow-2xl">
          {toast.type === "error" ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          )}
          <span className="leading-relaxed">{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="mr-2 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Clean Modern Top Navigation */}
      <header className="border-b border-white/10 bg-[#0B1120]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-600/25">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-lg font-extrabold text-white">
                  منصة توليد وإدارة إيميلات التسجيل
                </h1>
                <span
                  dir="ltr"
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-xs font-bold text-emerald-300"
                >
                  @smsmraw.com
                </span>
              </div>
              <p className="text-xs text-slate-400">
                توليد دفعات إيميلات فورية • نسخ ذكي بدون تكرار • تبديل مستلم الـ OTP بضغطة زر
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
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition hover:bg-white/10"
            >
              <RefreshCw
                className={`h-4 w-4 text-cyan-400 ${
                  switchingReceiver ? "animate-spin" : ""
                }`}
              />
              <span>تحديث حالة التفعيل</span>
            </button>

            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
                settings.hasCloudflareKey
                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25"
                  : "border-amber-500/60 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
              }`}
            >
              <Cloud className="h-4 w-4" />
              <span>
                {settings.hasCloudflareKey
                  ? "🟢 Cloudflare متصل"
                  : "🟠 ربط مفتاح Cloudflare API"}
              </span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6">
        {/* CARD 1: HERO NEXT UNUSED EMAIL COPIER (BIG & EFFORTLESS) */}
        <section className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-l from-emerald-950/40 via-[#0C1322] to-[#0C1322] p-6 shadow-2xl">
          <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-xl bg-emerald-500/20 px-3 py-1 text-xs font-extrabold text-emerald-300">
                  الخطوة السريعة: انسخ وسجّل فوراً
                </span>
                <span className="text-sm font-bold text-slate-200">
                  المتاح الآن:{" "}
                  <strong className="font-mono text-base text-emerald-400">
                    {stats.unusedAliases}
                  </strong>{" "}
                  إيميل جديد
                </span>
                <span className="text-slate-600">•</span>
                <span className="text-sm font-medium text-slate-400">
                  تم استخدامه:{" "}
                  <strong className="font-mono text-base text-amber-300">
                    {stats.usedAliases}
                  </strong>
                </span>
              </div>

              <div className="pt-1">
                <div className="text-xs text-slate-400">
                  الإيميل الجاهز للنسخ الآن (لم يُستخدم من قبل):
                </div>
                {nextUnusedAlias ? (
                  <div
                    dir="ltr"
                    className="mt-1.5 inline-block rounded-2xl border border-emerald-500/30 bg-[#060911] px-4 py-2.5 font-mono text-lg font-bold tracking-wide text-white"
                  >
                    {nextUnusedAlias.email}
                  </div>
                ) : (
                  <div className="mt-1.5 text-sm font-bold text-amber-300">
                    لا توجد إيميلات في الجدول حالياً — اضغط على (توليد إيميلات جديدة) بالأسفل أولاً
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-col items-stretch gap-2.5 sm:flex-row sm:items-center">
              <button
                type="button"
                disabled={!nextUnusedAlias}
                onClick={handleCopyNextUnused}
                className="inline-flex items-center justify-center gap-3 rounded-2xl bg-emerald-500 px-8 py-4 text-base font-extrabold text-black shadow-xl shadow-emerald-500/25 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {copiedId === "next_unused_btn" ? (
                  <>
                    <Check className="h-6 w-6" />
                    <span>تم النسخ! الصقه في الموقع الآن</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-6 w-6" />
                    <span>نسخ الإيميل التالي وتحديده كمستخدَم</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {lastCopiedEmail ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 text-xs">
              <span className="text-slate-300">
                آخر إيميل في الحافظة لديك الآن:{" "}
                <strong dir="ltr" className="font-mono text-sm text-emerald-300">
                  {lastCopiedEmail}
                </strong>
              </span>
              <span className="text-slate-400">
                كود الـ OTP سيصل على:{" "}
                <strong dir="ltr" className="font-mono text-white">
                  {primaryEmailInput}
                </strong>
              </span>
            </div>
          ) : null}
        </section>

        {/* CARD 2: OTP RECEIVER EMAIL SWITCHER */}
        <section className="rounded-3xl border border-white/10 bg-[#0C1322] p-6 shadow-xl">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-base font-extrabold text-white">
                على أي إيميل جيميل تريد استلام كود الـ OTP الآن؟
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                اضغط على الإيميل الذي تريد أن يذهب إليه الكود، أو أضف إيميل جيميل جديد للقائمة:
              </p>
            </div>

            <form
              onSubmit={handleAddReceiverEmail}
              className="flex flex-wrap items-center gap-2"
            >
              <input
                dir="ltr"
                type="email"
                value={newReceiverInput}
                onChange={(e) => setNewReceiverInput(e.target.value)}
                placeholder="example@gmail.com"
                className="w-64 rounded-xl border border-white/15 bg-[#070B14] px-3.5 py-2.5 text-left font-mono text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={switchingReceiver}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة إيميل للاستقبال</span>
              </button>
            </form>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {settings.availableMailboxes.map((mb) => {
              const isCurrent =
                primaryEmailInput.toLowerCase() === mb.email.toLowerCase();
              const isVerified = mb.verified !== false;
              return (
                <div
                  key={mb.email}
                  className={`flex flex-col justify-between rounded-2xl border p-4 transition ${
                    isCurrent
                      ? "border-emerald-500 bg-emerald-500/15 shadow-lg shadow-emerald-500/10"
                      : "border-white/10 bg-[#070B14] hover:border-white/25"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      dir="ltr"
                      className="truncate font-mono text-xs font-bold text-white"
                    >
                      {mb.email}
                    </span>
                    {settings.availableMailboxes.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveReceiverEmail(mb.email)}
                        className="text-slate-500 hover:text-rose-400"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between pt-2">
                    {!isVerified ? (
                      <span className="text-[11px] font-bold text-amber-300">
                        ⏳ افتح Gmail واضغط Verify أولاً
                      </span>
                    ) : isCurrent ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-emerald-300">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        يستلم الـ OTP حالياً
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        جاهز ومفعّل
                      </span>
                    )}

                    {!isCurrent ? (
                      <button
                        type="button"
                        onClick={() => handleSwitchReceiver(mb.email)}
                        className="rounded-xl bg-white/10 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-500 hover:text-black"
                      >
                        تحويل الـ OTP إليه
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CARD 3: ONE-ROW GENERATOR + CLEAN TABLE */}
        <section className="rounded-3xl border border-white/10 bg-[#0C1322] p-6 shadow-xl">
          {/* Top Generator Bar */}
          <form
            onSubmit={handleGenerateAliases}
            className="flex flex-col justify-between gap-4 rounded-2xl border border-indigo-500/30 bg-[#070B14] p-4 lg:flex-row lg:items-center"
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                <Wand2 className="h-5 w-5 text-indigo-400" />
                <span>توليد دفعة إيميلات جديدة:</span>
              </div>

              {/* Quantity Buttons */}
              <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0C1322] p-1">
                {[10, 25, 50, 100, 250].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQuantity(n)}
                    className={`rounded-lg px-3 py-1.5 font-mono text-xs font-bold transition ${
                      quantity === n
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>

              {/* Format Selector */}
              <select
                value={generationMode}
                onChange={(e) =>
                  setGenerationMode(e.target.value as GenerationMode)
                }
                className="rounded-xl border border-white/10 bg-[#0C1322] px-3 py-2 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="numeric_dot">
                  صيغة أرقام روضة (a45286444.617...@smsmraw.com)
                </option>
                <option value="realistic_name">
                  أسماء أشخاص (mohamed.samy4821@smsmraw.com)
                </option>
                <option value="custom_prefix">
                  كلمة مخصصة + ترقيم (rawda01.4821@smsmraw.com)
                </option>
              </select>

              {generationMode === "custom_prefix" ? (
                <input
                  dir="ltr"
                  type="text"
                  value={prefixPattern}
                  onChange={(e) => setPrefixPattern(e.target.value)}
                  placeholder="rawda"
                  className="w-28 rounded-xl border border-white/15 bg-[#0C1322] px-3 py-2 text-left font-mono text-xs text-white"
                />
              ) : null}
            </div>

            <button
              type="submit"
              disabled={generating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-extrabold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4" />
              )}
              <span>توليد {quantity} إيميل الآن</span>
            </button>
          </form>

          {/* Filter & Excel Export Bar */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1 rounded-xl border border-white/10 bg-[#070B14] p-1">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
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
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                    statusFilter === "unused"
                      ? "bg-emerald-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🟢 جديد غير مستخدم ({stats.unusedAliases})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("used");
                    setPage(1);
                  }}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                    statusFilter === "used"
                      ? "bg-amber-600 text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🟡 تم استخدامه ({stats.usedAliases})
                </button>
              </div>

              <div className="relative w-60">
                <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="بحث سريع..."
                  className="w-full rounded-xl border border-white/10 bg-[#070B14] py-2 pl-3 pr-9 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleExport("xlsx", "unused")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-2 text-xs font-bold text-emerald-200 hover:bg-emerald-500/25"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" />
                <span>تحميل المتاح Excel (.xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => handleExport("xlsx", "all")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
              >
                <FileText className="h-4 w-4 text-cyan-400" />
                <span>تحميل الكل Excel</span>
              </button>

              {stats.usedAliases > 0 ? (
                <button
                  type="button"
                  onClick={() => handleBulkAction("clear_used")}
                  className="inline-flex items-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف المستخدَم ({stats.usedAliases})</span>
                </button>
              ) : null}

              {stats.totalAliases > 0 ? (
                <button
                  type="button"
                  onClick={() => handleBulkAction("clear_all")}
                  className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>مسح الكل</span>
                </button>
              ) : null}
            </div>
          </div>

          {/* Spacious Clean Table */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full border-collapse text-right">
              <thead>
                <tr className="border-b border-white/10 text-xs font-bold text-slate-400">
                  <th className="px-4 py-3.5">الإيميل (اضغط عليه للنسخ)</th>
                  <th className="px-4 py-3.5">الحالة</th>
                  <th className="px-4 py-3.5">يستلم الـ OTP على</th>
                  <th className="px-4 py-3.5 text-left">نسخ وتحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06] text-sm">
                {loadingTable ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-16 text-center text-slate-400"
                    >
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-400" />
                    </td>
                  </tr>
                ) : aliases.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="py-16 text-center text-slate-400"
                    >
                      <Mail className="mx-auto mb-2 h-9 w-9 text-slate-600" />
                      <div className="text-base font-bold text-slate-200">
                        الجدول فارغ حالياً
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        اضغط على زر (توليد {quantity} إيميل الآن) بالأعلى لإنشاء الإيميلات فوراً.
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
                            ? "bg-black/20 opacity-60"
                            : "hover:bg-white/[0.03]"
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <span
                            dir="ltr"
                            onClick={() => handleCopyAndMarkUsed(a)}
                            className={`cursor-pointer font-mono text-sm font-bold ${
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
                        </td>

                        <td className="px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => handleToggleUsedStatus(a)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${
                              a.isUsed
                                ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                                : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                            }`}
                          >
                            {a.isUsed ? (
                              <>
                                <Check className="h-3.5 w-3.5" />
                                <span>تم استخدامه</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-3.5 w-3.5" />
                                <span>جديد متاح</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-3.5">
                          <span
                            dir="ltr"
                            className="inline-flex items-center gap-1.5 font-mono text-xs text-slate-300"
                          >
                            <ArrowLeft className="h-3.5 w-3.5 text-emerald-400" />
                            {a.primaryEmail}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-left">
                          <div className="inline-flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopyAndMarkUsed(a)}
                              className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-extrabold transition ${
                                isCopied
                                  ? "bg-emerald-500 text-black"
                                  : a.isUsed
                                  ? "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                  : "bg-emerald-600 text-white hover:bg-emerald-500"
                              }`}
                            >
                              {isCopied ? (
                                <>
                                  <Check className="h-4 w-4" />
                                  <span>تم النسخ!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-4 w-4" />
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
                                title="إعادته كجديد"
                                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 hover:text-white"
                              >
                                <RotateCcw className="h-4 w-4" />
                              </button>
                            ) : null}

                            <button
                              type="button"
                              onClick={() => handleDeleteAlias(a)}
                              title="حذف"
                              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-rose-300 hover:bg-rose-500/20"
                            >
                              <Trash2 className="h-4 w-4" />
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

          {/* Pagination */}
          {totalPages > 1 ? (
            <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
              <span>
                إجمالي: <strong className="text-white">{totalItems}</strong>{" "}
                إيميل
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-xl border border-white/10 px-3.5 py-1.5 font-bold text-slate-200 disabled:opacity-40"
                >
                  السابق
                </button>
                <span>
                  صفحة {page} من {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-xl border border-white/10 px-3.5 py-1.5 font-bold text-slate-200 disabled:opacity-40"
                >
                  التالي
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </main>

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
    </div>
  );
}
