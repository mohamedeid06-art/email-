"use client";

import React, { useState } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Mail,
  Pin,
  Power,
  Save,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { AliasRecord, SimpleLoginMailbox } from "@/lib/types";

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
  const [displayName, setDisplayName] = useState(alias?.displayName || "");
  const [note, setNote] = useState(alias?.note || "");
  const [primaryEmail, setPrimaryEmail] = useState(alias?.primaryEmail || "");
  const [pinned, setPinned] = useState(Boolean(alias?.pinned));
  const [enabled, setEnabled] = useState(Boolean(alias?.enabled));
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!alias) return null;

  const currentAlias = alias;

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const matchedMb = mailboxes.find(
        (m) => m.email.toLowerCase() === primaryEmail.trim().toLowerCase()
      );
      const res = await fetch(`/api/aliases/${currentAlias.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          displayName,
          note,
          primaryEmail: primaryEmail.trim(),
          mailboxId: matchedMb?.id ?? currentAlias.mailboxId,
          pinned,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update alias");
      }
      onUpdated(data.alias);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/aliases/${currentAlias.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete alias");
      }
      onDeleted(currentAlias.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(currentAlias.email);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0B101C] shadow-2xl">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                enabled
                  ? "bg-emerald-400 shadow-[0_0_10px_#34d399]"
                  : "bg-slate-500"
              }`}
            />
            <span className="font-mono text-xs text-slate-400">
              ALIAS #{currentAlias.id}{" "}
              {currentAlias.remoteAliasId
                ? `• SL-${currentAlias.remoteAliasId}`
                : ""}
            </span>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5 p-6">
          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          {/* Alias Address Box */}
          <div className="rounded-xl border border-white/[0.08] bg-[#070A12] p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">
                  Generated Alias Address
                </div>
                <div className="mt-1 truncate font-mono text-sm font-semibold text-white">
                  {currentAlias.email}
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                    Copy
                  </>
                )}
              </button>
            </div>

            {/* Forwarding Flow Visual */}
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3 text-xs">
              <span className="inline-flex items-center gap-1 font-mono text-indigo-300">
                <Mail className="h-3 w-3" />
                {currentAlias.email}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-500" />
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 font-mono text-emerald-300">
                <Shield className="h-3 w-3" />
                {primaryEmail || currentAlias.primaryEmail}
              </span>
            </div>
          </div>

          {/* Toggle & Pin Controls */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setEnabled(!enabled)}
              className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                enabled
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-white/[0.02] text-slate-400"
              }`}
            >
              <div>
                <div className="text-xs font-semibold">
                  {enabled ? "Alias Active" : "Alias Disabled"}
                </div>
                <div className="text-[11px] opacity-80">
                  {enabled ? "Forwarding incoming mail" : "All incoming mail paused"}
                </div>
              </div>
              <Power className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={`flex items-center justify-between rounded-xl border p-3.5 text-left transition ${
                pinned
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                  : "border-white/10 bg-white/[0.02] text-slate-400"
              }`}
            >
              <div>
                <div className="text-xs font-semibold">
                  {pinned ? "Pinned to Top" : "Standard Priority"}
                </div>
                <div className="text-[11px] opacity-80">
                  {pinned ? "Appears first in table" : "Click to pin alias"}
                </div>
              </div>
              <Pin className="h-4 w-4" />
            </button>
          </div>

          {/* Form Fields */}
          <div className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Forwarding Destination (Primary Email)
              </label>
              <input
                type="email"
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0C1220] px-3 py-2 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Display Name / Label
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Stripe Billing, AWS Root, Client Portal"
                className="w-full rounded-lg border border-white/10 bg-[#0C1220] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Description / Audit Note
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Add context about where this alias is used..."
                className="w-full rounded-lg border border-white/10 bg-[#0C1220] px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Telemetry stats */}
          <div className="grid grid-cols-3 gap-2 rounded-xl border border-white/[0.06] bg-[#070A12] p-3 text-center">
            <div>
              <div className="font-mono text-sm font-semibold text-emerald-400">
                {currentAlias.nbForward}
              </div>
              <div className="text-[11px] text-slate-400">Forwarded</div>
            </div>
            <div>
              <div className="font-mono text-sm font-semibold text-indigo-400">
                {currentAlias.nbReply}
              </div>
              <div className="text-[11px] text-slate-400">Replies Sent</div>
            </div>
            <div>
              <div className="font-mono text-sm font-semibold text-rose-400">
                {currentAlias.nbBlock}
              </div>
              <div className="text-[11px] text-slate-400">Blocked</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.07] bg-[#080C15] px-6 py-4">
          <button
            type="button"
            disabled={deleting || saving}
            onClick={handleDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 text-xs font-medium text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
          >
            {deleting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Trash2 className="h-3.5 w-3.5" />
            )}
            Delete Alias
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving || deleting}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
