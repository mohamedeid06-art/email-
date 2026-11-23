import { NextRequest, NextResponse } from "next/server";
import { encryptApiKey, maskApiKey } from "@/lib/crypto";
import {
  dbQuery,
  DEFAULT_SANDBOX_MAILBOXES,
  DEFAULT_SANDBOX_SUFFIXES,
  getDashboardStats,
  mapBatchRow,
} from "@/lib/db";
import {
  getServerProviderSettings,
  seedInitialAliasesIfEmpty,
} from "@/lib/settings";
import {
  SimpleLoginApiError,
  SimpleLoginClient,
} from "@/lib/simplelogin";
import type { SimpleLoginMailbox } from "@/lib/types";

export async function GET() {
  try {
    await seedInitialAliasesIfEmpty();
    const [{ clientSettings }, stats, batchesRes] = await Promise.all([
      getServerProviderSettings(),
      getDashboardStats(),
      dbQuery<Record<string, unknown>>(
        "SELECT * FROM generation_batches ORDER BY created_at DESC LIMIT 8"
      ),
    ]);

    return NextResponse.json({
      settings: clientSettings,
      stats,
      recentBatches: batchesRes.rows.map(mapBatchRow),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to load provider settings",
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      apiKey,
      clearApiKey,
      apiBaseUrl,
      mode,
      primaryEmail,
      defaultMailboxId,
      defaultSuffix,
      verifyConnection,
      isPremiumPlanSim,
    } = body as {
      apiKey?: string;
      clearApiKey?: boolean;
      apiBaseUrl?: string;
      mode?: "live" | "sandbox";
      primaryEmail?: string;
      defaultMailboxId?: number;
      defaultSuffix?: string;
      verifyConnection?: boolean;
      isPremiumPlanSim?: boolean;
    };

    const current = await getServerProviderSettings();

    let resolvedBaseUrl =
      apiBaseUrl?.trim().replace(/\/+$/, "") ||
      current.clientSettings.apiBaseUrl ||
      "https://app.simplelogin.io";

    let resolvedMode: "live" | "sandbox" =
      mode || current.clientSettings.mode || "sandbox";

    let resolvedPrimaryEmail =
      primaryEmail !== undefined
        ? primaryEmail.trim()
        : current.clientSettings.primaryEmail;

    if (
      resolvedPrimaryEmail &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(resolvedPrimaryEmail)
    ) {
      return NextResponse.json(
        { error: "Please enter a valid primary email address." },
        { status: 400 }
      );
    }

    // Handle API key updates securely on the server
    let activeApiKey = current.apiKey;
    if (clearApiKey) {
      await dbQuery(
        `UPDATE provider_settings
         SET encrypted_api_key = NULL, api_key_preview = NULL, mode = 'sandbox', updated_at = NOW()
         WHERE id = 1`
      );
      activeApiKey = null;
      resolvedMode = "sandbox";
    } else if (apiKey && apiKey.trim()) {
      const trimmedKey = apiKey.trim();
      const encrypted = encryptApiKey(trimmedKey);
      const preview = maskApiKey(trimmedKey);
      await dbQuery(
        `UPDATE provider_settings
         SET encrypted_api_key = $1, api_key_preview = $2, updated_at = NOW()
         WHERE id = 1`,
        [encrypted, preview]
      );
      activeApiKey = trimmedKey;
    }

    let connectionMessage = "Settings saved to PostgreSQL.";
    let liveVerified = false;

    // If mode is 'live' or verifyConnection requested, authenticate against SimpleLogin API
    if (resolvedMode === "live" || verifyConnection) {
      if (!activeApiKey) {
        return NextResponse.json(
          {
            error:
              "A SimpleLogin API key is required for Live SimpleLogin API mode. Enter your key or switch to Sandbox mode.",
          },
          { status: 400 }
        );
      }

      try {
        const client = new SimpleLoginClient(activeApiKey, resolvedBaseUrl);
        const [userInfo, aliasOptions, mailboxesResp] = await Promise.all([
          client.getUserInfo(),
          client.getAliasOptions(),
          client.getMailboxes(),
        ]);

        const mailboxes: SimpleLoginMailbox[] =
          mailboxesResp.mailboxes && mailboxesResp.mailboxes.length > 0
            ? mailboxesResp.mailboxes
            : [];

        // Match primary email to an existing mailbox or use default mailbox
        let matchedMailbox = mailboxes.find(
          (m) =>
            resolvedPrimaryEmail &&
            m.email.toLowerCase() === resolvedPrimaryEmail.toLowerCase()
        );

        if (!matchedMailbox && defaultMailboxId) {
          matchedMailbox = mailboxes.find((m) => m.id === defaultMailboxId);
        }
        if (!matchedMailbox) {
          matchedMailbox =
            mailboxes.find((m) => m.default) || mailboxes[0] || undefined;
        }

        if (!resolvedPrimaryEmail && matchedMailbox) {
          resolvedPrimaryEmail = matchedMailbox.email;
        }

        const suffixes =
          aliasOptions.suffixes && aliasOptions.suffixes.length > 0
            ? aliasOptions.suffixes
            : DEFAULT_SANDBOX_SUFFIXES;

        const chosenSuffixObj =
          suffixes.find((s) => s.suffix === defaultSuffix) || suffixes[0];

        await dbQuery(
          `UPDATE provider_settings
           SET api_base_url = $1,
               mode = 'live',
               primary_email = $2,
               default_mailbox_id = $3,
               default_suffix = $4,
               default_signed_suffix = $5,
               account_name = $6,
               account_email = $7,
               is_premium = $8,
               in_trial = $9,
               max_alias_free_plan = $10,
               can_create = $11,
               available_suffixes = $12::jsonb,
               available_mailboxes = $13::jsonb,
               last_synced_at = NOW(),
               updated_at = NOW()
           WHERE id = 1`,
          [
            resolvedBaseUrl,
            resolvedPrimaryEmail || userInfo.email,
            matchedMailbox ? matchedMailbox.id : null,
            chosenSuffixObj?.suffix || "@simplelogin.com",
            chosenSuffixObj?.signed_suffix || null,
            userInfo.name || "SimpleLogin Account",
            userInfo.email,
            Boolean(userInfo.is_premium),
            Boolean(userInfo.in_trial),
            Number(userInfo.max_alias_free_plan || 10),
            Boolean(aliasOptions.can_create),
            JSON.stringify(suffixes),
            JSON.stringify(mailboxes),
          ]
        );

        liveVerified = true;
        connectionMessage = `Connected to SimpleLogin as ${userInfo.email} (${
          userInfo.is_premium
            ? "Premium Plan"
            : userInfo.in_trial
            ? "Trial Plan"
            : `Free Plan • Max ${userInfo.max_alias_free_plan || 10} aliases`
        }).`;
      } catch (err) {
        const status =
          err instanceof SimpleLoginApiError ? err.status : 502;
        return NextResponse.json(
          {
            error:
              err instanceof Error
                ? err.message
                : "Failed to authenticate with SimpleLogin API",
          },
          { status: status >= 400 && status < 600 ? status : 502 }
        );
      }
    } else {
      // Sandbox / Local Provider Mode update
      const currentMailboxes = [...current.clientSettings.availableMailboxes];
      let targetMailboxId =
        defaultMailboxId ?? current.clientSettings.defaultMailboxId ?? 10421;

      if (resolvedPrimaryEmail) {
        const existingMb = currentMailboxes.find(
          (m) => m.email.toLowerCase() === resolvedPrimaryEmail.toLowerCase()
        );
        if (existingMb) {
          targetMailboxId = existingMb.id;
        } else {
          // Update primary default mailbox or add it
          const newId =
            currentMailboxes.length > 0
              ? Math.max(...currentMailboxes.map((m) => m.id)) + 1
              : 10421;
          currentMailboxes.unshift({
            id: newId,
            email: resolvedPrimaryEmail,
            default: true,
            verified: true,
            nb_alias: 0,
            creation_timestamp: Math.floor(Date.now() / 1000),
          });
          targetMailboxId = newId;
        }
      }

      const suffixes =
        current.clientSettings.availableSuffixes.length > 0
          ? current.clientSettings.availableSuffixes
          : DEFAULT_SANDBOX_SUFFIXES;
      const chosenSuffixObj =
        suffixes.find((s) => s.suffix === defaultSuffix) ||
        suffixes.find(
          (s) => s.suffix === current.clientSettings.defaultSuffix
        ) ||
        suffixes[0];

      const isPremium =
        typeof isPremiumPlanSim === "boolean"
          ? isPremiumPlanSim
          : current.clientSettings.isPremium;

      await dbQuery(
        `UPDATE provider_settings
         SET api_base_url = $1,
             mode = 'sandbox',
             primary_email = $2,
             default_mailbox_id = $3,
             default_suffix = $4,
             default_signed_suffix = $5,
             is_premium = $6,
             available_suffixes = $7::jsonb,
             available_mailboxes = $8::jsonb,
             updated_at = NOW()
         WHERE id = 1`,
        [
          resolvedBaseUrl,
          resolvedPrimaryEmail,
          targetMailboxId,
          chosenSuffixObj?.suffix || "@simplelogin.com",
          chosenSuffixObj?.signed_suffix || null,
          isPremium,
          JSON.stringify(suffixes),
          JSON.stringify(currentMailboxes),
        ]
      );
    }

    const updated = await getServerProviderSettings();
    const stats = await getDashboardStats();

    return NextResponse.json({
      settings: updated.clientSettings,
      stats,
      liveVerified,
      message: connectionMessage,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update settings",
      },
      { status: 500 }
    );
  }
}
