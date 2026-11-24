"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  CheckSquare,
  Cloud,
  Copy,
  Database,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  Filter,
  FolderKanban,
  Globe,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Square,
  Star,
  Tag,
  Trash2,
  Upload,
  UserCheck,
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
  hasCloudflareKey: true,
  cloudflareKeyPreview: "cfk_••••••••••••8356",
  cloudflareAuthEmail: "mhmdsamy112233@gmail.com",
  cloudflareLiveCatchAll: null,
  cloudflareConnected: true,
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

const ARABIC_FIRST_NAMES = [
  { ar: "محمد", en: "Mohamed" },
  { ar: "أحمد", en: "Ahmed" },
  { ar: "محمود", en: "Mahmoud" },
  { ar: "مصطفى", en: "Mostafa" },
  { ar: "يوسف", en: "Youssef" },
  { ar: "إبراهيم", en: "Ibrahim" },
  { ar: "عمر", en: "Omar" },
  { ar: "خالد", en: "Khaled" },
  { ar: "طارق", en: "Tarek" },
  { ar: "كريم", en: "Karim" },
  { ar: "حسن", en: "Hassan" },
  { ar: "علي", en: "Ali" },
];

const ARABIC_LAST_NAMES = [
  { ar: "سامي", en: "Samy" },
  { ar: "منصور", en: "Mansour" },
  { ar: "فؤاد", en: "Fouad" },
  { ar: "كامل", en: "Kamel" },
  { ar: "سليمان", en: "Soliman" },
  { ar: "رضوان", en: "Radwan" },
  { ar: "الشافعي", en: "Elshafei" },
  { ar: "جمال", en: "Gamal" },
  { ar: "عثمان", en: "Osman" },
  { ar: "سالم", en: "Salem" },
];

const QUICK_TAG_PRESETS = [
  "روضة / نسك",
  "حساب رسمي",
  "تسجيل جديد",
  "عميل VIP",
  "دفعة اليوم",
];

type WorkspaceTab = "dashboard" | "studio" | "routing" | "backup";

function generateRandomIdentity() {
  const f =
    ARABIC_FIRST_NAMES[Math.floor(Math.random() * ARABIC_FIRST_NAMES.length)];
  const l =
    ARABIC_LAST_NAMES[Math.floor(Math.random() * ARABIC_LAST_NAMES.length)];
  const num = Math.floor(1000 + Math.random() * 9000);
  const randPass = `Sm$m${num}#${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const birthYear = Math.floor(1982 + Math.random() * 20);
  const birthMonth = String(Math.floor(1 + Math.random() * 12)).padStart(2, "0");
  const birthDay = String(Math.floor(1 + Math.random() * 28)).padStart(2, "0");
  return {
    fullNameAr: `${f.ar} ${l.ar}`,
    fullNameEn: `${f.en} ${l.en}`,
    firstNameEn: f.en,
    lastNameEn: l.en,
    username: `${f.en.toLowerCase()}.${l.en.toLowerCase()}${num}`,
    suggestedPassword: randPass,
    birthDate: `${birthYear}-${birthMonth}-${birthDay}`,
  };
}

export default function BulkEmailAliasDashboard() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("dashboard");
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

  // Filters & table state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unused" | "used">(
    "all"
  );
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loadingTable, setLoadingTable] = useState(true);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Inline note editing
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");

  // Generator & OTP Receiver state
  const [primaryEmailInput, setPrimaryEmailInput] = useState(
    "mhmdsamy112233@gmail.com"
  );
  const [newReceiverInput, setNewReceiverInput] = useState("");
  const [switchingReceiver, setSwitchingReceiver] = useState(false);
  const [quantity, setQuantity] = useState(25);
  const [generationMode, setGenerationMode] =
    useState<GenerationMode>("numeric_dot");
  const [prefixPattern, setPrefixPattern] = useState("rawda");
  const [batchTag, setBatchTag] = useState("");
  const [domainSuffix, setDomainSuffix] = useState("@smsmraw.com");
  const [generating, setGenerating] = useState(false);

  // Smart Registration Kit state
  const [passwordMode, setPasswordMode] = useState<"fixed" | "random">("fixed");
  const [fixedPassword, setFixedPassword] = useState("SmsmRaw@2026#");
  const [identity, setIdentity] = useState(() => generateRandomIdentity());
  const [copyWithPassword, setCopyWithPassword] = useState(false);
  const [lastCopiedEmail, setLastCopiedEmail] = useState<string | null>(null);

  // Modals & Import state
  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [selectedAliasDetail, setSelectedAliasDetail] =
    useState<AliasRecord | null>(null);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);

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
    const t = setTimeout(() => setToast(null), 5500);
    return () => clearTimeout(t);
  }, [toast]);

  const activePassword =
    passwordMode === "fixed" ? fixedPassword : identity.suggestedPassword;

  const loadSettings = useCallback(async (forceSync = false) => {
    try {
      const r = await fetch(
        forceSync ? "/api/settings?sync=1" : "/api/settings"
      );
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
        const loaded: AliasRecord[] = d.aliases || [];
        setAliases(loaded);
        setNextUnusedAlias(d.nextUnusedAlias || null);
        setTotalItems(d.pagination?.totalItems ?? 0);
        setTotalPages(d.pagination?.totalPages ?? 1);
        if (d.stats) setStats(d.stats);

        // Save automatic local backup when aliases exist
        if (loaded.length > 0 && page === 1 && !search && statusFilter === "all") {
          try {
            localStorage.setItem(
              "bm_aliases_v3_backup",
              JSON.stringify(
                loaded.map((a) => ({
                  email: a.email,
                  prefix: a.prefix,
                  domain: a.domain,
                  primaryEmail: a.primaryEmail,
                  isUsed: a.isUsed,
                  note: a.note,
                }))
              )
            );
          } catch {}
        } else if (
          loaded.length === 0 &&
          (d.pagination?.totalItems ?? 0) === 0 &&
          !search &&
          statusFilter === "all"
        ) {
          // Auto-restore from browser vault if serverless cold-start wiped /tmp DB
          try {
            const rawBackup = localStorage.getItem("bm_aliases_v3_backup");
            const skipAutoRestore = sessionStorage.getItem("bm_intentionally_cleared");
            if (rawBackup && !skipAutoRestore) {
              const parsed = JSON.parse(rawBackup);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const restoreRes = await fetch("/api/aliases/bulk", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    action: "restore_backup",
                    backupAliases: parsed,
                  }),
                });
                if (restoreRes.ok) {
                  const r2 = await fetch(`/api/aliases?${q.toString()}`);
                  const d2 = await r2.json();
                  if (r2.ok) {
                    setAliases(d2.aliases || []);
                    setNextUnusedAlias(d2.nextUnusedAlias || null);
                    setTotalItems(d2.pagination?.totalItems ?? 0);
                    setTotalPages(d2.pagination?.totalPages ?? 1);
                    if (d2.stats) setStats(d2.stats);
                  }
                }
              }
            }
          } catch {}
        }
      }
    } finally {
      setLoadingTable(false);
    }
  }, [search, statusFilter, page, pageSize]);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  // Live preview of generation format
  const samplePreviewEmails = useMemo(() => {
    const cleanDom = domainSuffix.startsWith("@")
      ? domainSuffix
      : `@${domainSuffix}`;
    if (generationMode === "numeric_dot") {
      return [
        `a45286444.6171425682${cleanDom}`,
        `a91827364.5049382716${cleanDom}`,
        `a73645192.8473625190${cleanDom}`,
      ];
    }
    if (generationMode === "realistic_name") {
      return [
        `mohamed.samy4821${cleanDom}`,
        `ahmed.mansour9104${cleanDom}`,
        `youssef.kamel3752${cleanDom}`,
      ];
    }
    if (generationMode === "custom_prefix") {
      const p = (prefixPattern || "rawda").trim().toLowerCase();
      return [
        `${p}01.4821${cleanDom}`,
        `${p}02.7390${cleanDom}`,
        `${p}03.1584${cleanDom}`,
      ];
    }
    if (generationMode === "random_word") {
      return [
        `royal.falcon.4821${cleanDom}`,
        `emerald.atlas.9102${cleanDom}`,
        `amber.horizon.7341${cleanDom}`,
      ];
    }
    return [
      `usr-9f8a2c41e0${cleanDom}`,
      `usr-3b7d1e85a9${cleanDom}`,
      `usr-6c4f9a20d1${cleanDom}`,
    ];
  }, [generationMode, prefixPattern, domainSuffix]);

  async function copyTextToClipboard(text: string, idKey: string | number, label: string) {
    await navigator.clipboard.writeText(text);
    setCopiedId(idKey);
    setTimeout(() => setCopiedId(null), 1600);
    showToast(`📋 تم نسخ ${label}: ${text}`);
  }

  function openGmailInbox(email: string) {
    const url = `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(
      email.trim()
    )}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleCopyNextUnused(markUsed = true) {
    const candidate =
      nextUnusedAlias || aliases.find((a) => !a.isUsed && a.enabled);
    if (!candidate) {
      showToast(
        "لا توجد إيميلات متاحة حالياً! اضغط على زر (توليد دفعة جديدة) لإنشاء إيميلات فورية.",
        "error"
      );
      return;
    }

    const textToCopy = copyWithPassword
      ? `${candidate.email}\t${activePassword}`
      : candidate.email;

    await navigator.clipboard.writeText(textToCopy);
    setLastCopiedEmail(candidate.email);
    setCopiedId(markUsed ? "next_unused_btn" : "copy_only_btn");
    setTimeout(() => setCopiedId(null), 1800);

    if (markUsed) {
      setAliases((prev) =>
        prev.map((a) =>
          a.id === candidate.id
            ? {
                ...a,
                isUsed: true,
                usedAt: new Date().toISOString(),
                displayName: a.displayName || activePassword,
              }
            : a
        )
      );

      await fetch(`/api/aliases/${candidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_used",
          displayName: candidate.displayName || activePassword,
        }),
      });
      setIdentity(generateRandomIdentity());
      await fetchAliases();
      showToast(
        copyWithPassword
          ? `✅ تم نسخ (${candidate.email} + كلمة المرور) وتحديده كمستخدَم!`
          : `✅ تم نسخ (${candidate.email}) وتحديده كمستخدَم!`
      );
    } else {
      showToast(`📋 تم نسخ (${candidate.email}) بدون تغيير حالته.`);
    }
  }

  async function handleCopyBulkUnused(countToCopy: number, markAsUsed: boolean) {
    const unusedList = aliases.filter((a) => !a.isUsed && a.enabled);
    if (unusedList.length === 0) {
      showToast("لا توجد إيميلات غير مستخدمة في هذه الصفحة حالياً.", "error");
      return;
    }
    const batch = unusedList.slice(0, countToCopy);
    const text = batch
      .map((a) => (copyWithPassword ? `${a.email}\t${a.displayName || activePassword}` : a.email))
      .join("\n");
    await navigator.clipboard.writeText(text);

    if (markAsUsed) {
      const ids = batch.map((a) => a.id);
      await fetch("/api/aliases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_used", ids }),
      });
      await fetchAliases();
      showToast(`✅ تم نسخ ${batch.length} إيميل دفعة واحدة وتحديدها كمستخدَمة!`);
    } else {
      showToast(`📋 تم نسخ قائمة من ${batch.length} إيميل إلى الحافظة!`);
    }
  }

  async function handleCopyAndMarkUsed(alias: AliasRecord) {
    const textToCopy = copyWithPassword
      ? `${alias.email}\t${alias.displayName || activePassword}`
      : alias.email;
    await navigator.clipboard.writeText(textToCopy);
    setLastCopiedEmail(alias.email);
    setCopiedId(alias.id);
    setTimeout(() => setCopiedId(null), 1600);

    if (!alias.isUsed) {
      setAliases((prev) =>
        prev.map((a) =>
          a.id === alias.id
            ? {
                ...a,
                isUsed: true,
                usedAt: new Date().toISOString(),
                displayName: a.displayName || activePassword,
              }
            : a
        )
      );
      await fetch(`/api/aliases/${alias.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "mark_used",
          displayName: alias.displayName || activePassword,
        }),
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

  async function handleTogglePin(alias: AliasRecord) {
    setAliases((prev) =>
      prev.map((a) => (a.id === alias.id ? { ...a, pinned: !a.pinned } : a))
    );
    await fetch(`/api/aliases/${alias.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !alias.pinned }),
    });
    await fetchAliases();
  }

  async function handleSaveInlineNote(aliasId: number) {
    const cleanNote = editingNoteText.trim();
    setEditingNoteId(null);
    setAliases((prev) =>
      prev.map((a) => (a.id === aliasId ? { ...a, note: cleanNote } : a))
    );
    await fetch(`/api/aliases/${aliasId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: cleanNote }),
    });
    showToast("✅ تم حفظ الملاحظة والتصنيف.");
  }

  async function handleSwitchReceiver(targetEmail: string) {
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

  async function handleGenerateAliases(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (generating) return;
    setGenerating(true);
    try {
      sessionStorage.removeItem("bm_intentionally_cleared");
      const res = await fetch("/api/aliases/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: quantity,
          primaryEmail: primaryEmailInput.trim(),
          generationMode,
          prefixPattern,
          domainSuffix,
          note: batchTag.trim(),
          displayName: activePassword,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "فشل توليد الإيميلات");
      if (d.settings) setSettings(d.settings);
      if (d.stats) setStats(d.stats);
      setPage(1);
      await fetchAliases();
      if (activeTab === "studio") setActiveTab("dashboard");
      showToast(
        `🎉 تم توليد ${d.createdCount} إيميل جديد بنجاح على ${domainSuffix}!`
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

  async function handleImportEmails(e: React.FormEvent) {
    e.preventDefault();
    const lines = importText
      .split(/[\r\n,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));

    if (lines.length === 0) {
      showToast("يرجى لصق إيميل واحد صحيح على الأقل للاستيراد.", "error");
      return;
    }

    setImporting(true);
    try {
      sessionStorage.removeItem("bm_intentionally_cleared");
      const backupAliases = lines.map((em) => {
        const [p, d] = em.split("@");
        return {
          email: em,
          prefix: p,
          domain: d || "smsmraw.com",
          primaryEmail: primaryEmailInput,
          isUsed: false,
          note: batchTag.trim() || "مستورد",
        };
      });

      const res = await fetch("/api/aliases/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "restore_backup",
          backupAliases,
        }),
      });
      if (!res.ok) throw new Error("فشل استيراد الإيميلات");
      setImportText("");
      await fetchAliases();
      setActiveTab("dashboard");
      showToast(`✅ تم استيراد ${lines.length} إيميل إلى الجدول بنجاح!`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "فشل الاستيراد", "error");
    } finally {
      setImporting(false);
    }
  }

  async function handleDeleteAlias(a: AliasRecord) {
    setAliases((p) => p.filter((x) => x.id !== a.id));
    setSelectedIds((p) => p.filter((id) => id !== a.id));
    await fetch(`/api/aliases/${a.id}`, { method: "DELETE" });
    await fetchAliases();
  }

  async function handleBulkAction(
    action: "clear_all" | "clear_used" | "mark_used" | "mark_unused" | "delete",
    idsToUse?: number[]
  ) {
    if (action === "clear_all") {
      sessionStorage.setItem("bm_intentionally_cleared", "1");
      localStorage.removeItem("bm_aliases_v3_backup");
      setAliases([]);
      setSelectedIds([]);
    }
    await fetch("/api/aliases/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: idsToUse }),
    });
    setSelectedIds([]);
    await fetchAliases();
    showToast(
      action === "clear_all"
        ? "تم مسح الجدول بالكامل."
        : action === "clear_used"
        ? "تم حذف الإيميلات المستخدمة والإبقاء على المتاح فقط."
        : "✅ تم تنفيذ العملية على الإيميلات المحددة."
    );
  }

  function handleExport(
    format: "xlsx" | "csv",
    filterMode: "all" | "unused" | "used" | "selected" = "all"
  ) {
    const q = new URLSearchParams({ format });
    if (filterMode === "selected" && selectedIds.length > 0) {
      q.set("ids", selectedIds.join(","));
    } else if (filterMode === "unused" || filterMode === "used") {
      q.set("status", filterMode);
    }
    window.open(`/api/aliases/export?${q.toString()}`, "_blank");
  }

  const allOnPageSelected =
    aliases.length > 0 && aliases.every((a) => selectedIds.includes(a.id));

  function toggleSelectAll() {
    if (allOnPageSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(aliases.map((a) => a.id));
    }
  }

  function toggleSelectRow(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const unusedPercent =
    stats.totalAliases > 0
      ? Math.round((stats.unusedAliases / stats.totalAliases) * 100)
      : 0;
  const usedPercent =
    stats.totalAliases > 0
      ? Math.round((stats.usedAliases / stats.totalAliases) * 100)
      : 0;

  return (
    <div
      dir="rtl"
      className="bg-enterprise-mesh min-h-screen text-right text-slate-100"
    >
      {/* Top Floating Toast Notification */}
      {toast ? (
        <div className="fixed left-6 top-6 z-50 flex max-w-lg items-center gap-3 rounded-2xl border border-white/15 bg-[#0B1222]/95 px-5 py-4 text-sm font-bold shadow-2xl backdrop-blur-xl">
          {toast.type === "error" ? (
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
          )}
          <span className="leading-relaxed">{toast.text}</span>
          <button
            onClick={() => setToast(null)}
            className="mr-2 rounded-lg p-1 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Floating Bulk Selection Dock */}
      {selectedIds.length > 0 ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex -translate-x-1/2 flex-wrap items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-[#0A101F]/95 px-5 py-3.5 shadow-2xl shadow-black/80 backdrop-blur-xl">
          <span className="ml-2 rounded-xl bg-emerald-500/20 px-3 py-1 text-xs font-extrabold text-emerald-300">
            تم تحديد {selectedIds.length} إيميل
          </span>

          <button
            type="button"
            onClick={async () => {
              const rows = aliases.filter((a) => selectedIds.includes(a.id));
              const txt = rows
                .map((r) =>
                  copyWithPassword
                    ? `${r.email}\t${r.displayName || activePassword}`
                    : r.email
                )
                .join("\n");
              await navigator.clipboard.writeText(txt);
              showToast(`📋 تم نسخ ${rows.length} إيميل محدد إلى الحافظة!`);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-xs font-extrabold text-slate-950 hover:bg-emerald-400"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>نسخ المحدد</span>
          </button>

          <button
            type="button"
            onClick={() => handleBulkAction("mark_used", selectedIds)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-500/25"
          >
            <Check className="h-3.5 w-3.5" />
            <span>تحديد كمستخدَم</span>
          </button>

          <button
            type="button"
            onClick={() => handleBulkAction("mark_unused", selectedIds)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-bold text-cyan-200 hover:bg-cyan-500/25"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>إعادة كجديد</span>
          </button>

          <button
            type="button"
            onClick={() => handleExport("xlsx", "selected")}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
            <span>تصدير Excel</span>
          </button>

          <button
            type="button"
            onClick={() => handleBulkAction("delete", selectedIds)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>حذف</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            title="إلغاء التحديد"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {/* Enterprise App Shell: Right Sidebar + Main Content */}
      <div className="flex min-h-screen">
        {/* RIGHT SIDEBAR (Desktop) */}
        <aside className="hidden w-72 shrink-0 flex-col justify-between border-l border-white/[0.07] bg-[#070B14]/90 p-5 backdrop-blur-xl xl:flex">
          <div className="space-y-6">
            {/* Brand Logo */}
            <div className="flex items-center gap-3.5 border-b border-white/[0.07] pb-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 text-slate-950 shadow-lg shadow-emerald-500/25">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-base font-black tracking-tight text-white">
                    SMSMRAW PRO
                  </span>
                  <span className="rounded-md bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                    v3.0
                  </span>
                </div>
                <p className="truncate text-[11px] text-slate-400">
                  منصة إدارة الحسابات والـ OTP
                </p>
              </div>
            </div>

            {/* Navigation Menu */}
            <div className="space-y-1.5">
              <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                مساحات العمل
              </div>

              <button
                type="button"
                onClick={() => setActiveTab("dashboard")}
                className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-extrabold transition ${
                  activeTab === "dashboard"
                    ? "border border-emerald-500/30 bg-gradient-to-l from-emerald-500/20 to-emerald-500/5 text-white shadow-lg shadow-emerald-950/30"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <LayoutDashboard
                    className={`h-4 w-4 ${
                      activeTab === "dashboard"
                        ? "text-emerald-400"
                        : "text-slate-500"
                    }`}
                  />
                  <span>مركز القيادة والتسجيل</span>
                </span>
                <span className="rounded-lg bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-emerald-300">
                  {stats.unusedAliases}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("studio")}
                className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-extrabold transition ${
                  activeTab === "studio"
                    ? "border border-indigo-500/30 bg-gradient-to-l from-indigo-500/20 to-indigo-500/5 text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Wand2
                    className={`h-4 w-4 ${
                      activeTab === "studio"
                        ? "text-indigo-400"
                        : "text-slate-500"
                    }`}
                  />
                  <span>استوديو التوليد المتقدم</span>
                </span>
                <span className="rounded-lg bg-indigo-500/15 px-2 py-0.5 text-[10px] text-indigo-300">
                  500/دفعة
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("routing")}
                className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-extrabold transition ${
                  activeTab === "routing"
                    ? "border border-cyan-500/30 bg-gradient-to-l from-cyan-500/20 to-cyan-500/5 text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Cloud
                    className={`h-4 w-4 ${
                      activeTab === "routing"
                        ? "text-cyan-400"
                        : "text-slate-500"
                    }`}
                  />
                  <span>إدارة الـ OTP و Cloudflare</span>
                </span>
                <span className="rounded-lg bg-cyan-500/15 px-2 py-0.5 font-mono text-[11px] text-cyan-300">
                  {settings.availableMailboxes.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("backup")}
                className={`flex w-full items-center justify-between rounded-2xl px-3.5 py-3 text-xs font-extrabold transition ${
                  activeTab === "backup"
                    ? "border border-amber-500/30 bg-gradient-to-l from-amber-500/20 to-amber-500/5 text-white"
                    : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200"
                }`}
              >
                <span className="flex items-center gap-3">
                  <Database
                    className={`h-4 w-4 ${
                      activeTab === "backup"
                        ? "text-amber-400"
                        : "text-slate-500"
                    }`}
                  />
                  <span>الاستيراد والتصدير والأرشيف</span>
                </span>
              </button>
            </div>

            {/* Active Cloudflare Routing Status Box in Sidebar */}
            <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-b from-emerald-950/30 to-[#090E1A] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-300">
                  ● مستلم الـ OTP النشط
                </span>
                <span
                  dir="ltr"
                  className="rounded-md bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300"
                >
                  @smsmraw.com
                </span>
              </div>
              <div
                dir="ltr"
                className="mt-2 truncate rounded-xl border border-white/10 bg-black/40 px-3 py-2 font-mono text-xs font-bold text-white"
                title={primaryEmailInput}
              >
                {primaryEmailInput}
              </div>
              <button
                type="button"
                onClick={() => openGmailInbox(primaryEmailInput)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/20 px-3 py-2 text-xs font-extrabold text-emerald-300 transition hover:bg-emerald-500 hover:text-slate-950"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>فتح صندوق Gmail للـ OTP</span>
              </button>
            </div>

            {/* Quick Bulk Copy Widget in Sidebar */}
            <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="text-xs font-bold text-white">
                نسخ دفعة سريعة للحافظة
              </div>
              <p className="mt-0.5 text-[11px] text-slate-400">
                انسخ عدة إيميلات غير مستخدمة دفعة واحدة:
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {[5, 10, 25].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleCopyBulkUnused(n, false)}
                    className="rounded-xl border border-white/10 bg-[#0B1222] py-2 font-mono text-xs font-bold text-slate-200 transition hover:border-emerald-500/40 hover:bg-emerald-500/15 hover:text-emerald-300"
                  >
                    نسخ {n}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom Sidebar Footer */}
          <div className="space-y-2 border-t border-white/[0.07] pt-4">
            <button
              type="button"
              onClick={() => setIsApiModalOpen(true)}
              className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-xs font-bold text-slate-300 transition hover:bg-white/[0.08] hover:text-white"
            >
              <span className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-amber-400" />
                <span>إعدادات Cloudflare API</span>
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
            </button>
            <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
              <span>حفظ تلقائي مشفر</span>
              <span className="font-mono">AES-256</span>
            </div>
          </div>
        </aside>

        {/* MAIN WORKSPACE CONTENT */}
        <div className="flex-1 min-w-0">
          {/* Top Command Header */}
          <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#060A14]/85 backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
              {/* Mobile Logo & Tab Switcher */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2.5 xl:hidden">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 font-black">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <span className="font-black text-white">SMSMRAW</span>
                </div>

                {/* Quick Navigation Pills (Visible on all screens for fast switching) */}
                <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-white/[0.08] bg-[#0B1120] p-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("dashboard")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                      activeTab === "dashboard"
                        ? "bg-emerald-500 text-slate-950 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <LayoutDashboard className="h-3.5 w-3.5" />
                    <span>الرئيسية والتسجيل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("studio")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                      activeTab === "studio"
                        ? "bg-indigo-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Wand2 className="h-3.5 w-3.5" />
                    <span>استوديو التوليد</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("routing")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                      activeTab === "routing"
                        ? "bg-cyan-600 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Cloud className="h-3.5 w-3.5" />
                    <span>إيميلات الـ OTP ({settings.availableMailboxes.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("backup")}
                    className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                      activeTab === "backup"
                        ? "bg-amber-500 text-slate-950 shadow"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>استيراد وتصدير</span>
                  </button>
                </div>
              </div>

              {/* Right Header Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openGmailInbox(primaryEmailInput)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-extrabold text-emerald-300 transition hover:bg-emerald-500 hover:text-slate-950"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>فتح Gmail المستلم الآن</span>
                  <ExternalLink className="h-3 w-3" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSwitchingReceiver(true);
                    loadSettings(true).finally(() =>
                      setSwitchingReceiver(false)
                    );
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/10"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 text-cyan-400 ${
                      switchingReceiver ? "animate-spin" : ""
                    }`}
                  />
                  <span className="hidden sm:inline">مزامنة Cloudflare</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsApiModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs font-bold text-amber-200 transition hover:bg-amber-500/25"
                >
                  <Settings className="h-3.5 w-3.5 text-amber-400" />
                  <span className="hidden sm:inline">إعدادات الربط</span>
                </button>
              </div>
            </div>
          </header>

          {/* WORKSPACE BODY */}
          <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">
            {/* EXECUTIVE KPI ROW (4 Cards) */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* KPI 1: Available Unused */}
              <div className="glass-panel relative overflow-hidden rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">
                    متاح للتسجيل فوراً
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Sparkles className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-black text-emerald-400">
                    {stats.unusedAliases}
                  </span>
                  <span className="text-[11px] font-bold text-emerald-300/80">
                    {unusedPercent}% جاهز
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${unusedPercent}%` }}
                  />
                </div>
              </div>

              {/* KPI 2: Used Accounts */}
              <div className="glass-panel relative overflow-hidden rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">
                    تم استخدامه (مسجّل)
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
                    <UserCheck className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-black text-amber-300">
                    {stats.usedAliases}
                  </span>
                  <span className="text-[11px] font-bold text-amber-300/80">
                    {usedPercent}% مستهلك
                  </span>
                </div>
                <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-amber-500 transition-all duration-500"
                    style={{ width: `${usedPercent}%` }}
                  />
                </div>
              </div>

              {/* KPI 3: Total Inventory */}
              <div className="glass-panel relative overflow-hidden rounded-2xl p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400">
                    إجمالي مخزون الإيميلات
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
                    <Layers className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="font-mono text-2xl font-black text-white">
                    {stats.totalAliases}
                  </span>
                  <span
                    dir="ltr"
                    className="rounded-md bg-indigo-500/15 px-2 py-0.5 font-mono text-[11px] font-bold text-indigo-300"
                  >
                    {domainSuffix}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>محفوظ في السيرفر والمتصفح</span>
                  <span className="text-emerald-400">● متزامن</span>
                </div>
              </div>

              {/* KPI 4: Live OTP Receiver */}
              <div className="glass-panel relative overflow-hidden rounded-2xl border-emerald-500/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-300">
                    مستلم كود الـ OTP الحالي
                  </span>
                  <button
                    type="button"
                    onClick={() => openGmailInbox(primaryEmailInput)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] font-extrabold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950"
                  >
                    <span>فتح Gmail</span>
                    <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
                <div
                  dir="ltr"
                  className="mt-2 truncate font-mono text-xs font-bold text-white"
                  title={primaryEmailInput}
                >
                  {primaryEmailInput}
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">
                    Cloudflare Catch-All
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab("routing")}
                    className="font-bold text-cyan-400 underline hover:text-cyan-300"
                  >
                    تبديل المستلم ({settings.availableMailboxes.length})
                  </button>
                </div>
              </div>
            </div>

            {/* TAB 2: ADVANCED GENERATOR STUDIO */}
            {activeTab === "studio" ? (
              <section className="glass-panel rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-indigo-400">
                      <Wand2 className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">
                        استوديو التوليد المتقدم للدفعات (Bulk Alias Studio)
                      </h2>
                      <p className="text-xs text-slate-400">
                        اختر الصيغة والعدد وكلمة المرور المرفقة وتصنيف الدفعة مع معاينة فورية قبل الإنشاء
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("dashboard")}
                    className="rounded-xl border border-white/10 px-4 py-2 text-xs font-bold text-slate-300 hover:bg-white/5"
                  >
                    العودة للجدول الرئيسي
                  </button>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="space-y-5 lg:col-span-7">
                    {/* Format Cards */}
                    <div>
                      <label className="mb-2 block text-xs font-extrabold text-slate-300">
                        1. اختر صيغة توليد الإيميلات:
                      </label>
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        {[
                          {
                            id: "numeric_dot",
                            title: "صيغة أرقام روضة / نسك القياسية",
                            sample: "a45286444.6171425682@smsmraw.com",
                          },
                          {
                            id: "realistic_name",
                            title: "أسماء أشخاص حقيقية",
                            sample: "mohamed.samy4821@smsmraw.com",
                          },
                          {
                            id: "custom_prefix",
                            title: "بادئة مخصصة + ترقيم متسلسل",
                            sample: `${prefixPattern || "rawda"}01.4821@smsmraw.com`,
                          },
                          {
                            id: "random_word",
                            title: "كلمات إنجليزية رسمية",
                            sample: "royal.falcon.4821@smsmraw.com",
                          },
                        ].map((fmt) => (
                          <button
                            key={fmt.id}
                            type="button"
                            onClick={() =>
                              setGenerationMode(fmt.id as GenerationMode)
                            }
                            className={`flex flex-col items-start rounded-2xl border p-3.5 text-right transition ${
                              generationMode === fmt.id
                                ? "border-indigo-500 bg-indigo-500/15 shadow-lg shadow-indigo-500/10"
                                : "border-white/10 bg-[#070B14] hover:border-white/25"
                            }`}
                          >
                            <span className="text-xs font-extrabold text-white">
                              {fmt.title}
                            </span>
                            <span
                              dir="ltr"
                              className="mt-1.5 truncate font-mono text-[11px] text-emerald-300"
                            >
                              {fmt.sample}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {generationMode === "custom_prefix" ? (
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-300">
                          اكتب الكلمة المخصصة لبداية الإيميل (Prefix):
                        </label>
                        <input
                          dir="ltr"
                          type="text"
                          value={prefixPattern}
                          onChange={(e) => setPrefixPattern(e.target.value)}
                          placeholder="rawda"
                          className="w-full rounded-xl border border-indigo-500/40 bg-[#070B14] px-4 py-2.5 text-left font-mono text-xs text-white"
                        />
                      </div>
                    ) : null}

                    {/* Quantity Presets */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <label className="text-xs font-extrabold text-slate-300">
                          2. عدد الإيميلات المطلوب توليدها في هذه الدفعة:
                        </label>
                        <span className="font-mono text-sm font-black text-indigo-400">
                          {quantity} إيميل
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {[10, 25, 50, 100, 200, 500].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setQuantity(n)}
                            className={`flex-1 rounded-xl border py-2.5 font-mono text-xs font-extrabold transition ${
                              quantity === n
                                ? "border-indigo-500 bg-indigo-600 text-white"
                                : "border-white/10 bg-[#070B14] text-slate-300 hover:border-white/25"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Batch Tag & Default Password */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-300">
                          3. تصنيف الدفعة / اسم المشروع (اختياري):
                        </label>
                        <input
                          type="text"
                          value={batchTag}
                          onChange={(e) => setBatchTag(e.target.value)}
                          placeholder="مثال: دفعة روضة 1، حسابات نسك..."
                          className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3.5 py-2.5 text-xs text-white"
                        />
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {QUICK_TAG_PRESETS.map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setBatchTag(t)}
                              className="rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] text-slate-300 hover:border-indigo-500/40 hover:text-white"
                            >
                              + {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-300">
                          4. كلمة المرور المحفوظة مع كل إيميل في Excel:
                        </label>
                        <input
                          dir="ltr"
                          type="text"
                          value={fixedPassword}
                          onChange={(e) => setFixedPassword(e.target.value)}
                          className="w-full rounded-xl border border-white/10 bg-[#070B14] px-3.5 py-2.5 text-left font-mono text-xs text-emerald-300"
                        />
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          تُحفظ تلقائياً مع الدفعة وتظهر عند تصدير ملف Excel.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Live Preview Box */}
                  <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#060913] p-5 lg:col-span-5">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/10 pb-3">
                        <span className="text-xs font-extrabold text-indigo-300">
                          معاينة حية لشكل الإيميلات قبل التوليد
                        </span>
                        <span className="rounded-lg bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                          {quantity}× جاهز
                        </span>
                      </div>

                      <div className="space-y-2">
                        {samplePreviewEmails.map((em, idx) => (
                          <div
                            key={idx}
                            dir="ltr"
                            className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#0B1120] px-3.5 py-2.5 font-mono text-xs text-white"
                          >
                            <span className="truncate">{em}</span>
                            <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] text-emerald-300">
                              #{idx + 1}
                            </span>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-400 space-y-1">
                        <div>
                          • مستلم الـ OTP:{" "}
                          <strong dir="ltr" className="font-mono text-white">
                            {primaryEmailInput}
                          </strong>
                        </div>
                        <div>
                          • كلمة المرور المرفقة:{" "}
                          <strong
                            dir="ltr"
                            className="font-mono text-emerald-300"
                          >
                            {fixedPassword}
                          </strong>
                        </div>
                        {batchTag ? (
                          <div>
                            • التصنيف:{" "}
                            <strong className="text-indigo-300">
                              {batchTag}
                            </strong>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={generating}
                      onClick={() => handleGenerateAliases()}
                      className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-l from-indigo-600 to-violet-600 py-4 text-sm font-black text-white shadow-xl shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50"
                    >
                      {generating ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Zap className="h-5 w-5" />
                      )}
                      <span>توليد {quantity} إيميل الآن وإضافتها للجدول</span>
                    </button>
                  </div>
                </div>
              </section>
            ) : null}

            {/* TAB 3: CLOUDFLARE & OTP ROUTING HUB */}
            {activeTab === "routing" ? (
              <section className="glass-panel rounded-3xl p-6">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-500/20 text-cyan-400">
                      <Cloud className="h-6 w-6" />
                    </div>
                    <div>
                      <h2 className="text-lg font-black text-white">
                        مركز توجيه رسائل الـ OTP عبر Cloudflare Email Routing
                      </h2>
                      <p className="text-xs text-slate-400">
                        تحكم في إيميل الجيميل الذي يستلم أكواد التفعيل المرسلة إلى أي عنوان على @smsmraw.com
                      </p>
                    </div>
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
                      placeholder="new.receiver@gmail.com"
                      className="w-64 rounded-xl border border-white/15 bg-[#070B14] px-3.5 py-2.5 text-left font-mono text-xs text-white focus:border-cyan-400 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={switchingReceiver}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2.5 text-xs font-extrabold text-white hover:bg-cyan-500 disabled:opacity-50"
                    >
                      <Plus className="h-4 w-4" />
                      <span>إضافة إيميل استقبال جديد</span>
                    </button>
                  </form>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {settings.availableMailboxes.map((mb) => {
                    const isCurrent =
                      primaryEmailInput.toLowerCase() ===
                      mb.email.toLowerCase();
                    const isVerified = mb.verified !== false;
                    return (
                      <div
                        key={mb.email}
                        className={`flex flex-col justify-between rounded-2xl border p-5 transition ${
                          isCurrent
                            ? "border-emerald-500 bg-gradient-to-b from-emerald-950/40 to-[#080D1A] shadow-xl shadow-emerald-500/10"
                            : "border-white/10 bg-[#070B14] hover:border-white/25"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold ${
                                !isVerified
                                  ? "bg-amber-500/20 text-amber-300"
                                  : isCurrent
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-white/5 text-slate-400"
                              }`}
                            >
                              {!isVerified
                                ? "⏳ بانتظار التفعيل من Gmail"
                                : isCurrent
                                ? "● يستلم الـ OTP حالياً"
                                : "✓ مفعّل وجاهز في Cloudflare"}
                            </span>
                            {settings.availableMailboxes.length > 1 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveReceiverEmail(mb.email)
                                }
                                className="rounded-lg p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-400"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>

                          <div
                            dir="ltr"
                            className="mt-3 truncate font-mono text-sm font-bold text-white"
                            title={mb.email}
                          >
                            {mb.email}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4">
                          {!isCurrent ? (
                            <button
                              type="button"
                              disabled={switchingReceiver}
                              onClick={() => handleSwitchReceiver(mb.email)}
                              className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-xs font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                            >
                              تحويل الـ OTP إليه الآن
                            </button>
                          ) : (
                            <div className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-center text-xs font-bold text-emerald-300">
                              المستلم النشط حالياً
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => openGmailInbox(mb.email)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs font-bold text-slate-200 hover:bg-white/10"
                            title="فتح هذا البريد في Gmail"
                          >
                            <span>Gmail</span>
                            <ExternalLink className="h-3.5 w-3.5 text-cyan-400" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {/* TAB 4: IMPORT / EXPORT & BACKUP VAULT */}
            {activeTab === "backup" ? (
              <section className="glass-panel rounded-3xl p-6">
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  {/* Bulk Import Box */}
                  <form
                    onSubmit={handleImportEmails}
                    className="space-y-4 rounded-2xl border border-white/10 bg-[#070B14] p-5"
                  >
                    <div className="flex items-center gap-2.5">
                      <Upload className="h-5 w-5 text-amber-400" />
                      <h3 className="text-base font-extrabold text-white">
                        استيراد قائمة إيميلات جاهزة إلى الجدول
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      الصق أي قائمة إيميلات لديك (إيميل في كل سطر) ليتم إضافتها وتفعيل تتبع الاستخدام عليها:
                    </p>
                    <textarea
                      dir="ltr"
                      rows={6}
                      value={importText}
                      onChange={(e) => setImportText(e.target.value)}
                      placeholder={`a45286444.6171425682@smsmraw.com\nmohamed.samy4821@smsmraw.com`}
                      className="w-full rounded-xl border border-white/10 bg-[#0B1120] p-3.5 text-left font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={importing}
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-xs font-extrabold text-slate-950 hover:bg-amber-400 disabled:opacity-50"
                    >
                      {importing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      <span>استيراد الإيميلات للجدول الآن</span>
                    </button>
                  </form>

                  {/* Export Center */}
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-[#070B14] p-5">
                    <div className="flex items-center gap-2.5">
                      <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
                      <h3 className="text-base font-extrabold text-white">
                        مركز تصدير التقارير (Excel & CSV)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      يحتوي ملف الإكسيل المصدّر على: الإيميل + كلمة المرور + حالة الاستخدام + إيميل الـ OTP + الملاحظات:
                    </p>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handleExport("xlsx", "unused")}
                        className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-4 text-right hover:bg-emerald-500/25"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-emerald-300">
                            تصدير المتاح فقط (.xlsx)
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-300">
                            {stats.unusedAliases} إيميل جديد غير مستخدم
                          </div>
                        </div>
                        <Download className="h-5 w-5 text-emerald-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExport("xlsx", "used")}
                        className="flex items-center justify-between rounded-xl border border-amber-500/40 bg-amber-500/15 p-4 text-right hover:bg-amber-500/25"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-amber-300">
                            تصدير المستخدَم فقط (.xlsx)
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-300">
                            {stats.usedAliases} حساب تم التسجيل به
                          </div>
                        </div>
                        <Download className="h-5 w-5 text-amber-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExport("xlsx", "all")}
                        className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 p-4 text-right hover:bg-white/10"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-white">
                            تصدير الجدول بالكامل (.xlsx)
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            شامل كل الإيميلات ({stats.totalAliases})
                          </div>
                        </div>
                        <FileSpreadsheet className="h-5 w-5 text-cyan-400" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExport("csv", "all")}
                        className="flex items-center justify-between rounded-xl border border-white/15 bg-white/5 p-4 text-right hover:bg-white/10"
                      >
                        <div>
                          <div className="text-xs font-extrabold text-white">
                            تصدير بصيغة CSV قياسية
                          </div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            متوافق مع جميع البرامج والسكربتات
                          </div>
                        </div>
                        <FileText className="h-5 w-5 text-indigo-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {/* MAIN DASHBOARD VIEW: SMART REGISTRATION KIT + QUICK OTP SWITCHER + FULL DATA TABLE */}
            {activeTab === "dashboard" ? (
              <>
                {/* BENTO ROW: SMART ACCOUNT REGISTRATION KIT (8 cols) + LIVE OTP SWITCHER (4 cols) */}
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
                  {/* LEFT 7 COLS: SMART REGISTRATION KIT (Email + Password + Identity + 1-Click Copy) */}
                  <section className="glass-card-emerald flex flex-col justify-between rounded-3xl p-6 lg:col-span-7">
                    <div className="space-y-4">
                      {/* Header Row */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3 py-1 text-xs font-black text-slate-950">
                            <Zap className="h-3.5 w-3.5" />
                            حقيبة التسجيل السريع بدون تكرار
                          </span>
                          <span className="text-xs font-bold text-emerald-300">
                            جاهز الآن: {stats.unusedAliases} إيميل
                          </span>
                        </div>

                        <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-1.5 text-[11px] font-bold text-slate-300">
                          <input
                            type="checkbox"
                            checked={copyWithPassword}
                            onChange={(e) =>
                              setCopyWithPassword(e.target.checked)
                            }
                            className="h-3.5 w-3.5 accent-emerald-500"
                          />
                          <span>نسخ الإيميل + الباسورد معاً</span>
                        </label>
                      </div>

                      {/* Next Unused Email Display Box */}
                      <div className="rounded-2xl border border-emerald-500/40 bg-[#050811]/90 p-4">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>الإيميل التالي الجاهز للتسجيل (لم يُستخدم من قبل):</span>
                          {nextUnusedAlias ? (
                            <button
                              type="button"
                              onClick={() => handleCopyNextUnused(false)}
                              className="font-bold text-emerald-400 hover:underline"
                            >
                              {copiedId === "copy_only_btn"
                                ? "✓ تم النسخ فقط"
                                : "نسخ بدون تحديد كمستخدَم"}
                            </button>
                          ) : null}
                        </div>

                        {nextUnusedAlias ? (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <div
                              dir="ltr"
                              onClick={() => handleCopyNextUnused(true)}
                              className="cursor-pointer select-all font-mono text-lg font-black tracking-wide text-white transition hover:text-emerald-300 sm:text-xl"
                            >
                              {nextUnusedAlias.prefix}
                              <span className="text-emerald-400">
                                @{nextUnusedAlias.domain}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                            <span className="text-sm font-bold text-amber-300">
                              لا توجد إيميلات غير مستخدمة حالياً — اضغط توليد دفعة جديدة:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleGenerateAliases()}
                              className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-indigo-500"
                            >
                              + توليد {quantity} إيميل فوراً
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Assistant Credentials Strip: Password + Random Full Name (Click any pill to copy!) */}
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        {/* Password Pill */}
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3.5 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                              <KeyRound className="h-3 w-3 text-amber-400" />
                              <span>كلمة المرور للتسجيل</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setPasswordMode((m) =>
                                    m === "fixed" ? "random" : "fixed"
                                  )
                                }
                                className="text-[10px] text-amber-300 underline"
                              >
                                ({passwordMode === "fixed" ? "ثابتة" : "عشوائية"})
                              </button>
                            </div>
                            {passwordMode === "fixed" ? (
                              <input
                                dir="ltr"
                                type="text"
                                value={fixedPassword}
                                onChange={(e) =>
                                  setFixedPassword(e.target.value)
                                }
                                className="mt-0.5 w-full bg-transparent font-mono text-xs font-bold text-white focus:outline-none"
                              />
                            ) : (
                              <div
                                dir="ltr"
                                className="mt-0.5 truncate font-mono text-xs font-bold text-white"
                              >
                                {activePassword}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyTextToClipboard(
                                activePassword,
                                "pass_pill",
                                "كلمة المرور"
                              )
                            }
                            className="rounded-lg bg-white/10 p-1.5 text-slate-200 hover:bg-emerald-500 hover:text-slate-950"
                            title="نسخ كلمة المرور"
                          >
                            {copiedId === "pass_pill" ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {/* Arabic Name Pill */}
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3.5 py-2.5">
                          <div className="min-w-0">
                            <div className="text-[10px] font-bold text-slate-400">
                              اسم مقترح (عربي)
                            </div>
                            <div className="mt-0.5 truncate text-xs font-extrabold text-white">
                              {identity.fullNameAr}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyTextToClipboard(
                                identity.fullNameAr,
                                "name_ar_pill",
                                "الاسم العربي"
                              )
                            }
                            className="rounded-lg bg-white/10 p-1.5 text-slate-200 hover:bg-emerald-500 hover:text-slate-950"
                            title="نسخ الاسم العربي"
                          >
                            {copiedId === "name_ar_pill" ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>

                        {/* English Name Pill */}
                        <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3.5 py-2.5">
                          <div className="min-w-0">
                            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                              <span>اسم مقترح (EN)</span>
                              <button
                                type="button"
                                onClick={() =>
                                  setIdentity(generateRandomIdentity())
                                }
                                className="text-cyan-400 hover:underline"
                                title="تغيير الاسم العشوائي"
                              >
                                تحديث ↻
                              </button>
                            </div>
                            <div
                              dir="ltr"
                              className="mt-0.5 truncate font-mono text-xs font-bold text-white"
                            >
                              {identity.fullNameEn}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              copyTextToClipboard(
                                identity.fullNameEn,
                                "name_en_pill",
                                "الاسم الإنجليزي"
                              )
                            }
                            className="rounded-lg bg-white/10 p-1.5 text-slate-200 hover:bg-emerald-500 hover:text-slate-950"
                            title="نسخ الاسم الإنجليزي"
                          >
                            {copiedId === "name_en_pill" ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Main Hero Action Button + Open Gmail OTP */}
                    <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
                      <button
                        type="button"
                        disabled={!nextUnusedAlias}
                        onClick={() => handleCopyNextUnused(true)}
                        className="flex flex-1 items-center justify-center gap-3 rounded-2xl bg-gradient-to-l from-emerald-400 to-emerald-500 px-6 py-4 text-base font-black text-slate-950 shadow-xl shadow-emerald-500/25 transition hover:from-emerald-300 hover:to-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {copiedId === "next_unused_btn" ? (
                          <>
                            <Check className="h-6 w-6" />
                            <span>تم النسخ وتحديده كمستخدَم!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-5 w-5" />
                            <span>نسخ الإيميل التالي وتحديده كمستخدَم</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => openGmailInbox(primaryEmailInput)}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/15 px-5 py-4 text-xs font-extrabold text-emerald-200 transition hover:bg-emerald-500 hover:text-slate-950"
                      >
                        <Mail className="h-4 w-4" />
                        <span>فتح Gmail للـ OTP</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </section>

                  {/* RIGHT 5 COLS: COMPACT OTP RECEIVER SWITCHER */}
                  <section className="glass-panel flex flex-col justify-between rounded-3xl p-6 lg:col-span-5">
                    <div>
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-sm font-black text-white">
                            تحويل إيميل استلام الـ OTP بضغطة زر
                          </h2>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            مربوط مباشرة مع Cloudflare لدومين @smsmraw.com
                          </p>
                        </div>
                        <span className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-extrabold text-emerald-300">
                          ● متصل
                        </span>
                      </div>

                      {/* Receiver Mailboxes List */}
                      <div className="mt-4 max-h-52 space-y-2 overflow-y-auto pl-1">
                        {settings.availableMailboxes.map((mb) => {
                          const isCurrent =
                            primaryEmailInput.toLowerCase() ===
                            mb.email.toLowerCase();
                          const isVerified = mb.verified !== false;
                          return (
                            <div
                              key={mb.email}
                              className={`flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5 transition ${
                                isCurrent
                                  ? "border-emerald-500/60 bg-emerald-500/15"
                                  : "border-white/10 bg-[#060A14] hover:border-white/20"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div
                                  dir="ltr"
                                  className="truncate font-mono text-xs font-bold text-white"
                                  title={mb.email}
                                >
                                  {mb.email}
                                </div>
                                <div className="mt-0.5 flex items-center gap-2 text-[10px]">
                                  {!isVerified ? (
                                    <span className="font-bold text-amber-300">
                                      ⏳ افتح Gmail واضغط Verify
                                    </span>
                                  ) : isCurrent ? (
                                    <span className="font-extrabold text-emerald-300">
                                      ● يستلم كل أكواد الـ OTP الآن
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">
                                      جاهز ومفعّل
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {!isCurrent ? (
                                  <button
                                    type="button"
                                    disabled={switchingReceiver}
                                    onClick={() =>
                                      handleSwitchReceiver(mb.email)
                                    }
                                    className="rounded-xl bg-emerald-500 px-3 py-1.5 text-[11px] font-extrabold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-50"
                                  >
                                    تفعيل الـ OTP
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openGmailInbox(mb.email)}
                                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-black/40 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300 hover:bg-emerald-500 hover:text-slate-950"
                                  >
                                    <span>Gmail</span>
                                    <ExternalLink className="h-3 w-3" />
                                  </button>
                                )}

                                {settings.availableMailboxes.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRemoveReceiverEmail(mb.email)
                                    }
                                    className="rounded-lg p-1 text-slate-500 hover:text-rose-400"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Quick Add New Gmail Receiver Form */}
                    <form
                      onSubmit={handleAddReceiverEmail}
                      className="mt-4 flex items-center gap-2 border-t border-white/[0.07] pt-3.5"
                    >
                      <input
                        dir="ltr"
                        type="email"
                        value={newReceiverInput}
                        onChange={(e) => setNewReceiverInput(e.target.value)}
                        placeholder="إضافة جيميل جديد (example@gmail.com)"
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#050811] px-3 py-2 text-left font-mono text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        disabled={switchingReceiver}
                        className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-extrabold text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>إضافة</span>
                      </button>
                    </form>
                  </section>
                </div>

                {/* MAIN DATA GRID SECTION: FAST GENERATOR BAR + FILTERS + INTERACTIVE TABLE */}
                <section className="glass-panel rounded-3xl p-6">
                  {/* Fast One-Row Generator Bar */}
                  <form
                    onSubmit={handleGenerateAliases}
                    className="flex flex-col justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-[#060A14]/90 p-4 xl:flex-row xl:items-center"
                  >
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="flex items-center gap-1.5 text-xs font-black text-white">
                        <Wand2 className="h-4 w-4 text-indigo-400" />
                        <span>توليد سريع:</span>
                      </span>

                      {/* Quantity Pills */}
                      <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-[#0B1120] p-1">
                        {[10, 25, 50, 100, 250, 500].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => setQuantity(n)}
                            className={`rounded-lg px-2.5 py-1 font-mono text-xs font-extrabold transition ${
                              quantity === n
                                ? "bg-indigo-600 text-white"
                                : "text-slate-400 hover:text-white"
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>

                      {/* Format Select */}
                      <select
                        value={generationMode}
                        onChange={(e) =>
                          setGenerationMode(e.target.value as GenerationMode)
                        }
                        className="rounded-xl border border-white/10 bg-[#0B1120] px-3 py-2 text-xs font-bold text-white focus:border-indigo-500 focus:outline-none"
                      >
                        <option value="numeric_dot">
                          صيغة أرقام روضة (a45286444.617...@smsmraw.com)
                        </option>
                        <option value="realistic_name">
                          أسماء حقيقية (mohamed.samy4821@smsmraw.com)
                        </option>
                        <option value="custom_prefix">
                          كلمة مخصصة + ترقيم (rawda01.4821@smsmraw.com)
                        </option>
                        <option value="random_word">
                          كلمات رسمية (royal.falcon.4821@smsmraw.com)
                        </option>
                      </select>

                      {generationMode === "custom_prefix" ? (
                        <input
                          dir="ltr"
                          type="text"
                          value={prefixPattern}
                          onChange={(e) => setPrefixPattern(e.target.value)}
                          placeholder="rawda"
                          className="w-24 rounded-xl border border-indigo-500/40 bg-[#0B1120] px-2.5 py-1.5 text-left font-mono text-xs text-white"
                        />
                      ) : null}

                      {/* Batch Tag Input */}
                      <input
                        type="text"
                        value={batchTag}
                        onChange={(e) => setBatchTag(e.target.value)}
                        placeholder="تصنيف الدفعة (مثال: روضة 1)..."
                        className="w-40 rounded-xl border border-white/10 bg-[#0B1120] px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="submit"
                        disabled={generating}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-indigo-600/25 transition hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 xl:flex-none"
                      >
                        {generating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Zap className="h-4 w-4" />
                        )}
                        <span>توليد {quantity} إيميل الآن</span>
                      </button>
                    </div>
                  </form>

                  {/* Table Controls: Status Tabs, Search, Bulk Copy, Excel Export */}
                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Filter Pills */}
                      <div className="flex gap-1 rounded-xl border border-white/10 bg-[#060A14] p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter("all");
                            setPage(1);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
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
                          className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                            statusFilter === "unused"
                              ? "bg-emerald-600 text-white"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          🟢 متاح للتسجيل ({stats.unusedAliases})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setStatusFilter("used");
                            setPage(1);
                          }}
                          className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
                            statusFilter === "used"
                              ? "bg-amber-600 text-white"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          🟡 تم استخدامه ({stats.usedAliases})
                        </button>
                      </div>

                      {/* Search Box */}
                      <div className="relative w-56">
                        <Search className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                        <input
                          type="text"
                          value={search}
                          onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                          }}
                          placeholder="بحث بالإيميل أو التصنيف..."
                          className="w-full rounded-xl border border-white/10 bg-[#060A14] py-2 pl-3 pr-8 text-xs text-white focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Action Toolbar: Bulk Copy + Excel + Cleanup */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyBulkUnused(10, false)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
                        title="نسخ أول 10 إيميلات غير مستخدمة كقائمة نصية"
                      >
                        <ListChecks className="h-3.5 w-3.5 text-emerald-400" />
                        <span>نسخ 10 متاح</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExport("xlsx", "unused")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3.5 py-2 text-xs font-extrabold text-emerald-200 hover:bg-emerald-500/25"
                      >
                        <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                        <span>تحميل المتاح Excel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExport("xlsx", "all")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-200 hover:bg-white/10"
                      >
                        <Download className="h-3.5 w-3.5 text-cyan-400" />
                        <span>الكل Excel</span>
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

                  {/* Interactive Data Grid Table */}
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full border-collapse text-right">
                      <thead>
                        <tr className="border-b border-white/10 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          <th className="w-10 px-3 py-3.5">
                            <button
                              type="button"
                              onClick={toggleSelectAll}
                              className="text-slate-400 hover:text-white"
                            >
                              {allOnPageSelected ? (
                                <CheckSquare className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Square className="h-4 w-4" />
                              )}
                            </button>
                          </th>
                          <th className="px-3 py-3.5">
                            الإيميل المولّد (اضغط للنسخ والتسجيل)
                          </th>
                          <th className="px-3 py-3.5">الحالة</th>
                          <th className="px-3 py-3.5">الباسورد المحفوظ</th>
                          <th className="px-3 py-3.5">
                            التصنيف / ملاحظة الحساب
                          </th>
                          <th className="px-3 py-3.5">مستلم الـ OTP</th>
                          <th className="px-3 py-3.5 text-left">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05] text-sm">
                        {loadingTable ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-16 text-center text-slate-400"
                            >
                              <Loader2 className="mx-auto h-7 w-7 animate-spin text-emerald-400" />
                            </td>
                          </tr>
                        ) : aliases.length === 0 ? (
                          <tr>
                            <td
                              colSpan={7}
                              className="py-16 text-center text-slate-400"
                            >
                              <Mail className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                              <div className="text-base font-extrabold text-slate-200">
                                لا توجد إيميلات في الجدول حالياً
                              </div>
                              <p className="mt-1 text-xs text-slate-500">
                                اضغط على زر (توليد {quantity} إيميل الآن) بالأعلى لإنشاء دفعة جاهزة للتسجيل فوراً.
                              </p>
                            </td>
                          </tr>
                        ) : (
                          aliases.map((a) => {
                            const isCopied = copiedId === a.id;
                            const isSelected = selectedIds.includes(a.id);
                            const rowPass = a.displayName || fixedPassword;

                            return (
                              <tr
                                key={a.id}
                                className={`group transition ${
                                  isSelected
                                    ? "bg-emerald-500/[0.08]"
                                    : a.isUsed
                                    ? "bg-black/25 opacity-60"
                                    : "hover:bg-white/[0.03]"
                                }`}
                              >
                                {/* Checkbox + Pin */}
                                <td className="px-3 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => toggleSelectRow(a.id)}
                                      className="text-slate-400 hover:text-white"
                                    >
                                      {isSelected ? (
                                        <CheckSquare className="h-4 w-4 text-emerald-400" />
                                      ) : (
                                        <Square className="h-4 w-4" />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleTogglePin(a)}
                                      className={`${
                                        a.pinned
                                          ? "text-amber-400"
                                          : "text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-300"
                                      }`}
                                      title="تثبيت في الأعلى"
                                    >
                                      <Star
                                        className="h-3.5 w-3.5"
                                        fill={a.pinned ? "currentColor" : "none"}
                                      />
                                    </button>
                                  </div>
                                </td>

                                {/* Email Address */}
                                <td className="px-3 py-3">
                                  <span
                                    dir="ltr"
                                    onClick={() => handleCopyAndMarkUsed(a)}
                                    className={`cursor-pointer font-mono text-xs font-bold sm:text-sm ${
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

                                {/* Status Badge */}
                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleUsedStatus(a)}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-extrabold transition ${
                                      a.isUsed
                                        ? "border-amber-500/30 bg-amber-500/15 text-amber-300"
                                        : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
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

                                {/* Saved Password Pill */}
                                <td className="px-3 py-3">
                                  <button
                                    type="button"
                                    dir="ltr"
                                    onClick={() =>
                                      copyTextToClipboard(
                                        rowPass,
                                        `pass_${a.id}`,
                                        "الباسورد"
                                      )
                                    }
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1 font-mono text-[11px] text-slate-300 hover:border-emerald-500/40 hover:text-white"
                                    title="اضغط لنسخ كلمة المرور الخاصة بهذا الحساب"
                                  >
                                    <span>{rowPass}</span>
                                    {copiedId === `pass_${a.id}` ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3 text-slate-500" />
                                    )}
                                  </button>
                                </td>

                                {/* Inline Editable Note / Tag */}
                                <td className="px-3 py-3">
                                  {editingNoteId === a.id ? (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        autoFocus
                                        value={editingNoteText}
                                        onChange={(e) =>
                                          setEditingNoteText(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") {
                                            handleSaveInlineNote(a.id);
                                          } else if (e.key === "Escape") {
                                            setEditingNoteId(null);
                                          }
                                        }}
                                        onBlur={() =>
                                          handleSaveInlineNote(a.id)
                                        }
                                        placeholder="اكتب ملاحظة..."
                                        className="w-32 rounded-lg border border-emerald-500 bg-[#050811] px-2 py-1 text-xs text-white focus:outline-none"
                                      />
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingNoteId(a.id);
                                        setEditingNoteText(a.note || "");
                                      }}
                                      className="inline-flex items-center gap-1 rounded-lg border border-transparent px-2 py-1 text-xs text-slate-400 hover:border-white/10 hover:bg-white/[0.04] hover:text-slate-200"
                                    >
                                      <Tag className="h-3 w-3 text-indigo-400" />
                                      <span>
                                        {a.note ? a.note : "إضافة ملاحظة..."}
                                      </span>
                                    </button>
                                  )}
                                </td>

                                {/* OTP Receiver */}
                                <td className="px-3 py-3">
                                  <span
                                    dir="ltr"
                                    className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-300"
                                  >
                                    <ArrowLeft className="h-3 w-3 text-emerald-400" />
                                    {a.primaryEmail}
                                  </span>
                                </td>

                                {/* Row Actions */}
                                <td className="px-3 py-3 text-left">
                                  <div className="inline-flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleCopyAndMarkUsed(a)}
                                      className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold transition ${
                                        isCopied
                                          ? "bg-emerald-400 text-slate-950"
                                          : a.isUsed
                                          ? "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                                          : "bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                                      }`}
                                    >
                                      {isCopied ? (
                                        <>
                                          <Check className="h-3.5 w-3.5" />
                                          <span>تم النسخ</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="h-3.5 w-3.5" />
                                          <span>
                                            {a.isUsed ? "نسخ" : "نسخ واستخدام"}
                                          </span>
                                        </>
                                      )}
                                    </button>

                                    {a.isUsed ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleToggleUsedStatus(a)
                                        }
                                        title="إعادته كجديد غير مستخدم"
                                        className="rounded-xl border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:text-white"
                                      >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}

                                    <button
                                      type="button"
                                      onClick={() => handleDeleteAlias(a)}
                                      title="حذف"
                                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-1.5 text-rose-300 hover:bg-rose-500/20"
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
                  {totalPages > 1 ? (
                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4 text-xs text-slate-400">
                      <span>
                        إجمالي السجلات:{" "}
                        <strong className="text-white">{totalItems}</strong>{" "}
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
              </>
            ) : null}
          </main>
        </div>
      </div>

      {/* Cloudflare API Connection Modal */}
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

      {/* Alias Detail Modal */}
      <AliasDetailModal
        alias={selectedAliasDetail}
        mailboxes={settings.availableMailboxes}
        onClose={() => setSelectedAliasDetail(null)}
        onUpdated={() => fetchAliases()}
        onDeleted={() => fetchAliases()}
      />
    </div>
  );
}
