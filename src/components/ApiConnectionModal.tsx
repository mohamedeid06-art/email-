"use client";

import React, { useState } from "react";
import {
  CheckCircle2,
  Database,
  ExternalLink,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { ProviderSettingsClient } from "@/lib/types";

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
  const [mode, setMode] = useState<"live" | "sandbox">(settings.mode);
  const [apiBaseUrl, setApiBaseUrl] = useState(
    settings.apiBaseUrl || "https://app.simplelogin.io"
  );
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [primaryEmail, setPrimaryEmail] = useState(settings.primaryEmail || "");
  const [defaultSuffix, setDefaultSuffix] = useState(
    settings.defaultSuffix || "@simplelogin.com"
  );
  const [isPremiumSim, setIsPremiumSim] = useState(settings.isPremium);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSave(verifyLive = false) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          apiBaseUrl,
          apiKey: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
          primaryEmail,
          defaultSuffix,
          verifyConnection: verifyLive,
          isPremiumPlanSim: isPremiumSim,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save connection settings");
      }
      setApiKeyInput("");
      onUpdated(data.settings, data.message || "Provider configuration saved.");
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleClearKey() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clearApiKey: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to clear API key");
      }
      setMode("sandbox");
      onUpdated(
        data.settings,
        "Stored API key cleared from server. Switched to Sandbox Mode."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove key");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-[#0B101C] shadow-[0_25px_70px_-15px_rgba(0,0,0,0.85)]">
        {/* Top specular highlight */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-indigo-400/40 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              <KeyRound className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                SimpleLogin API & Routing Configuration
              </h2>
              <p className="text-xs text-slate-400">
                Keys are encrypted at rest with AES-256-GCM in PostgreSQL and never exposed to client code
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[78vh] space-y-5 overflow-y-auto p-6">
          {error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              {error}
            </div>
          ) : null}

          {/* Mode Selector */}
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-slate-400">
              Provider Execution Mode
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("live")}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  mode === "live"
                    ? "border-indigo-500/60 bg-indigo-500/10 shadow-[inset_0_1px_0_0_rgba(99,102,241,0.25)]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Server className="h-3.5 w-3.5 text-indigo-400" />
                    Official SimpleLogin API (Live)
                  </span>
                  {mode === "live" ? (
                    <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                      Selected
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Connects directly to{" "}
                  <code className="font-mono text-slate-300">
                    app.simplelogin.io/api
                  </code>{" "}
                  using your official API key header.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setMode("sandbox")}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition ${
                  mode === "sandbox"
                    ? "border-cyan-500/60 bg-cyan-500/10 shadow-[inset_0_1px_0_0_rgba(6,182,212,0.25)]"
                    : "border-white/[0.07] bg-white/[0.02] hover:border-white/15"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-white">
                    <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                    Sandbox Provider Simulator
                  </span>
                  {mode === "sandbox" ? (
                    <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-medium text-cyan-300">
                      Selected
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                  Simulates SimpleLogin endpoints locally with full PostgreSQL persistence & plan quota enforcement.
                </p>
              </button>
            </div>
          </div>

          {/* API Endpoint & Key */}
          <div className="space-y-4 rounded-xl border border-white/[0.07] bg-[#070B14] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-slate-200">
                <Lock className="h-3.5 w-3.5 text-emerald-400" />
                Server-Side API Key Vault
              </div>
              {settings.hasApiKey ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] text-emerald-300">
                  <CheckCircle2 className="h-3 w-3" />
                  Stored: {settings.apiKeyPreview}
                </span>
              ) : (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] text-amber-300">
                  No Live Key Stored
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs text-slate-400">
                  SimpleLogin Base URL
                </label>
                <input
                  type="url"
                  value={apiBaseUrl}
                  onChange={(e) => setApiBaseUrl(e.target.value)}
                  placeholder="https://app.simplelogin.io"
                  className="w-full rounded-lg border border-white/10 bg-[#0C1220] px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1.5 flex items-center justify-between text-xs text-slate-400">
                  <span>SimpleLogin API Key</span>
                  <a
                    href="https://app.simplelogin.io/dashboard/api_key"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    Get API Key <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={
                      settings.hasApiKey
                        ? "Enter new key to replace stored key..."
                        : "Paste SimpleLogin API key..."
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#0C1220] px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                  {settings.hasApiKey ? (
                    <button
                      type="button"
                      onClick={handleClearKey}
                      disabled={loading}
                      title="Delete stored API key from PostgreSQL"
                      className="inline-flex items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 text-rose-300 transition hover:bg-rose-500/20"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          {/* Primary Forwarding Email & Default Domain Suffix */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-300">
                <Mail className="h-3.5 w-3.5 text-indigo-400" />
                Default Primary Forwarding Email
              </label>
              <input
                type="email"
                value={primaryEmail}
                onChange={(e) => setPrimaryEmail(e.target.value)}
                placeholder="you@yourdomain.com"
                className="w-full rounded-lg border border-white/10 bg-[#0C1220] px-3 py-2 font-mono text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                All generated aliases will route incoming mail to this mailbox.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Default Alias Domain Suffix
              </label>
              <select
                value={defaultSuffix}
                onChange={(e) => setDefaultSuffix(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-[#0C1220] px-3 py-2 font-mono text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {settings.availableSuffixes.map((s) => (
                  <option key={s.suffix} value={s.suffix}>
                    {s.suffix} {s.is_custom ? "(Custom)" : s.is_premium ? "(Premium)" : "(Public)"}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Cryptographically signed suffixes synced from{" "}
                <code className="font-mono">/api/v5/alias/options</code>.
              </p>
            </div>
          </div>

          {/* Sandbox Plan Quota Tier Simulator (for testing provider limit enforcement) */}
          {mode === "sandbox" ? (
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h4 className="text-xs font-semibold text-white">
                    Provider Quota Tier Simulation (Sandbox Mode)
                  </h4>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Test how the generator enforces SimpleLogin&apos;s permitted plan limits (Free 10-alias total limit vs Premium 50-alias batch cap).
                  </p>
                </div>
                <div className="flex rounded-lg border border-white/10 bg-[#070B14] p-1">
                  <button
                    type="button"
                    onClick={() => setIsPremiumSim(false)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      !isPremiumSim
                        ? "bg-amber-500/20 text-amber-300"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Free Plan (Max 10)
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPremiumSim(true)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                      isPremiumSim
                        ? "bg-indigo-500/25 text-indigo-300"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Premium (50 / batch)
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {/* Security & Database Footnote */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-[#070A12] px-4 py-2.5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-cyan-400" />
              Engine: <strong className="text-slate-200">{settings.databaseEngine}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
              Rate-Limit Backoff & HTTP 429 Retry Active
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-white/[0.07] bg-[#080C15] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-slate-300 transition hover:bg-white/5"
          >
            Cancel
          </button>
          {mode === "live" ? (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSave(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Verify & Connect SimpleLogin API
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSave(false)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-indigo-600/25 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              Save Configuration
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
