"use client";

import React, { useState } from "react";
import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  Mail,
  Save,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import type { AliasRecord, SimpleLoginMailbox } from "@/lib/types";

interface AliasDetailModalProps {
  alias: AliasRecord | null;
  mailboxes: SimpleLoginMailbox[];
  onClose: () => void;
  onUpdated: (alias: AliasRecord) => void;
  onDeleted: (id: number) => void;
}

export function AliasDetailModal({
  alias,
  mailboxes,
  onClose,
  onUpdated,
  onDeleted,
}: AliasDetailModalProps) {
  const [note, setNote] = useState(alias?.note || "");
  const [primaryEmail, setPrimaryEmail] = useState(alias?.primaryEmail || "");
  const [isUsed, setIsUsed] = useState(Boolean(alias?.isUsed));
  const [enabled, setEnabled] = useState(Boolean(alias?.enabled));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!alias) return null;
  const curr = alias;

  async function handleSave() {
    setSaving(true);
    try {
      const mb = mailboxes.find(
        (m) => m.email.toLowerCase() === primaryEmail.trim().toLowerCase()
      );
      const res = await fetch(`/api/aliases/${curr.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          isUsed,
          note,
          primaryEmail: primaryEmail.trim(),
          mailboxId: mb?.id ?? curr.mailboxId,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdated(data.alias);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      const res = await fetch(`/api/aliases/${curr.id}`, { method: "DELETE" });
      if (res.ok) {
        onDeleted(curr.id);
        onClose();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      dir="rtl"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-[#0B101C] text-right shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
          <span className="text-sm font-bold text-white">
            تفاصيل الإيميل #{curr.id}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="rounded-xl border border-white/[0.08] bg-[#070A12] p-4">
            <div className="flex items-center justify-between gap-2">
              <div
                dir="ltr"
                className="truncate font-mono text-sm font-bold text-white"
              >
                {curr.email}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(curr.email);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copied ? "تم النسخ" : "نسخ"}</span>
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 font-mono text-xs">
              <span className="inline-flex items-center gap-1 text-indigo-300">
                <Mail className="h-3 w-3" />
                {curr.email}
              </span>
              <ArrowLeft className="h-3.5 w-3.5 text-slate-500" />
              <span className="inline-flex items-center gap-1 text-emerald-300">
                <Shield className="h-3 w-3" />
                {primaryEmail}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsUsed(!isUsed)}
              className={`rounded-xl border p-3 text-right text-xs font-semibold transition ${
                isUsed
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                  : "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
              }`}
            >
              <div>{isUsed ? "✅ تم استخدامه (Used)" : "✨ جديد متاح (Unused)"}</div>
              <div className="mt-0.5 text-[10px] opacity-80">
                اضغط لتغيير حالة الاستخدام
              </div>
            </button>

            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`rounded-xl border p-3 text-right text-xs font-semibold transition ${
                enabled
                  ? "border-indigo-500/40 bg-indigo-500/15 text-indigo-200"
                  : "border-white/10 bg-white/5 text-slate-400"
              }`}
            >
              <div>{enabled ? "تحويل الرسائل مفعّل" : "تحويل الرسائل متوقف"}</div>
              <div className="mt-0.5 text-[10px] opacity-80">
                اضغط لإيقاف أو تشغيل الإيميل
              </div>
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                ملاحظة على هذا الإيميل (اختياري)
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="اكتب مثلاً اسم الحساب أو الموقع الذي سجلت به..."
                className="w-full rounded-xl border border-white/10 bg-[#0C1220] px-3 py-2 text-xs text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/[0.08] bg-[#080C15] px-6 py-4">
          <button
            type="button"
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            حذف الإيميل
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-xs text-slate-300"
            >
              إلغاء
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              حفظ التعديلات
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
