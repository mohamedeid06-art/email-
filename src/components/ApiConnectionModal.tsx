"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Cloud,
  Database,
  ExternalLink,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import type { ProviderSettingsClient } from "@/lib/types";

interface ApiConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ProviderSettingsClient;
  onUpdated: (newSettings: ProviderSettingsClient, message?: string) => void;
}

export function ApiConnectionModal({
  isOpen,
  onClose,
  settings,
  onUpdated,
}: ApiConnectionModalProps) {
  const [cfKeyInput, setCfKeyInput] = useState("");
  const [cfEmailInput, setCfEmailInput] = useState(
    settings.cloudflareAuthEmail || "mhmdsamy112233@gmail.com"
  );
  const [primaryEmail, setPrimaryEmail] = useState(
    settings.primaryEmail || "mhmdsamy112233@gmail.com"
  );
  const [defaultSuffix, setDefaultSuffix] = useState(
    settings.defaultSuffix || "@smsmraw.com"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSave() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cloudflareKey: cfKeyInput.trim() || undefined,
          cloudflareAuthEmail: cfEmailInput.trim() || undefined,
          primaryEmail: primaryEmail.trim(),
          defaultSuffix: defaultSuffix.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "تعذر حفظ الإعدادات");
      }
      setCfKeyInput("");
      onUpdated(
        data.settings,
        data.message || "✅ تم حفظ الإعدادات وربط Cloudflare بنجاح!"
      );
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "حدث خطأ أثناء الاتصال بـ Cloudflare"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleClearCfKey() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clearCloudflareKey: true }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdated(data.settings, "تم مسح مفتاح Cloudflare من السيرفر.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-amber-500/40 bg-[#0B101C] text-right shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/15 text-amber-400">
              <Cloud className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                إعدادات ربط Cloudflare وتبديل إيميل الـ OTP
              </h2>
              <p className="text-xs text-slate-400">
                اربط مفتاح Cloudflare مرة واحدة لتبديل الإيميل المستلم للـ OTP بضغطة زر
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          {error ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-3 text-xs font-medium leading-relaxed text-rose-200">
              ⚠️ {error}
            </div>
          ) : null}

          <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-bold text-amber-300">
                <Lock className="h-4 w-4 text-amber-400" />
                مفتاح Cloudflare Global API Key (لدومين @smsmraw.com)
              </span>
              {settings.hasCloudflareKey ? (
                <span
                  dir="ltr"
                  className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] text-emerald-300"
                >
                  ✅ Connected: {settings.cloudflareKeyPreview}
                </span>
              ) : (
                <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-0.5 text-[11px] font-bold text-rose-300">
                  غير متصل بعد
                </span>
              )}
            </div>

            <div className="space-y-1.5 rounded-xl border border-white/10 bg-[#070B14] p-3.5 text-xs leading-relaxed text-slate-300">
              <div className="font-semibold text-white">
                كيف تحصل على المفتاح في 15 ثانية؟
              </div>
              <div>
                1. اضغط هنا لفتح صفحة المفاتيح في حسابك:{" "}
                <a
                  href="https://dash.cloudflare.com/profile/api-tokens"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-amber-400 underline hover:text-amber-300"
                >
                  فتح صفحة Cloudflare API Keys <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                2. انزل لآخر الصفحة عند قسم <strong>API Keys</strong> واضغط على زر{" "}
                <strong>View</strong> أمام <strong>Global API Key</strong>.
              </div>
              <div>
                3. انسخ الكود والصقه في الخانة بالأسفل ثم اضغط{" "}
                <strong>حفظ وربط Cloudflare</strong>:
              </div>
            </div>

            <div className="space-y-3 pt-1">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  إيميل حسابك في Cloudflare (Account Email)
                </label>
                <input
                  dir="ltr"
                  type="email"
                  value={cfEmailInput}
                  onChange={(e) => setCfEmailInput(e.target.value)}
                  placeholder="mhmdsamy112233@gmail.com"
                  className="w-full rounded-xl border border-white/10 bg-[#0C1220] px-3.5 py-2.5 text-left font-mono text-xs text-white focus:border-amber-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  مفتاح Cloudflare Global API Key
                </label>
                <div className="flex gap-2">
                  <input
                    dir="ltr"
                    type="password"
                    value={cfKeyInput}
                    onChange={(e) => setCfKeyInput(e.target.value)}
                    placeholder={
                      settings.hasCloudflareKey
                        ? "المفتاح محفوظ بالفعل — الصق هنا فقط إذا أردت تغييره..."
                        : "الصق الـ Global API Key هنا..."
                    }
                    className="w-full rounded-xl border border-amber-500/40 bg-[#0C1220] px-3.5 py-2.5 text-left font-mono text-xs text-white focus:border-amber-400 focus:outline-none"
                  />
                  {settings.hasCloudflareKey ? (
                    <button
                      type="button"
                      onClick={handleClearCfKey}
                      title="حذف المفتاح"
                      className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 text-rose-300 hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Mail className="h-3.5 w-3.5 text-emerald-400" />
                إيميل استقبال الـ OTP الحالي
              </label>
              <input
                dir="ltr"
                type="email"
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0C1220] px-3 py-2 text-left font-mono text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                نطاق الدومين الأساسي
              </label>
              <input
                dir="ltr"
                type="text"
                value={defaultSuffix}
                onChange={(e) => setDefaultSuffix(e.target.value)}
                placeholder="@smsmraw.com"
                className="w-full rounded-xl border border-white/10 bg-[#0C1220] px-3 py-2 text-left font-mono text-xs text-emerald-300"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#070A12] px-4 py-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              {settings.databaseEngine}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              مشفر بتشفير AES-256-GCM ومحفوظ بشكل دائم
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.08] bg-[#080C15] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-white/5"
          >
            إغلاق
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-2.5 text-xs font-bold text-black shadow-lg transition hover:bg-amber-400 disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            حفظ وربط Cloudflare الآن
          </button>
        </div>
      </div>
    </div>
  );
}
