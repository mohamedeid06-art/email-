import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { dbQuery, getDashboardStats, mapAliasRow, mapBatchRow } from "@/lib/db";
import { getServerProviderSettings } from "@/lib/settings";
import {
  generateSandboxAliasAddress,
  type SimpleLoginAliasResponse,
  SimpleLoginApiError,
  SimpleLoginClient,
} from "@/lib/simplelogin";
import type { AliasRecord } from "@/lib/types";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function splitEmailParts(email: string): { prefix: string; domain: string } {
  const parts = email.split("@");
  return {
    prefix: parts[0] || email,
    domain: parts[1] || "simplelogin.com",
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      count,
      primaryEmail,
      mailboxId,
      generationMode = "random_word",
      prefixPattern = "",
      domainSuffix = "@simplelogin.com",
      note = "",
      displayName = "",
    } = body as {
      count: number;
      primaryEmail?: string;
      mailboxId?: number;
      generationMode?: "random_word" | "random_uuid" | "custom_prefix";
      prefixPattern?: string;
      domainSuffix?: string;
      note?: string;
      displayName?: string;
    };

    const requestedCount = Number(count);
    if (
      !Number.isInteger(requestedCount) ||
      requestedCount < 1
    ) {
      return NextResponse.json(
        { error: "Please specify a valid number of aliases to generate (at least 1)." },
        { status: 400 }
      );
    }

    const { clientSettings, apiKey } = await getServerProviderSettings();
    const targetPrimaryEmail =
      (primaryEmail || clientSettings.primaryEmail || "").trim();

    if (
      !targetPrimaryEmail ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetPrimaryEmail)
    ) {
      return NextResponse.json(
        { error: "A valid primary forwarding email address is required." },
        { status: 400 }
      );
    }

    if (
      generationMode === "custom_prefix" &&
      (!prefixPattern || !prefixPattern.trim())
    ) {
      return NextResponse.json(
        {
          error:
            "Custom Prefix mode requires a base prefix (e.g., 'client-portal' or 'billing').",
        },
        { status: 400 }
      );
    }

    // Check provider limits strictly before generating
    const { quota } = clientSettings;
    if (!quota.isUnlimitedPlan && quota.remaining <= 0) {
      return NextResponse.json(
        {
          error: `Provider alias limit reached (${quota.currentCount}/${quota.totalLimit} aliases on Free plan). Delete unused aliases or upgrade plan quota to create more.`,
        },
        { status: 403 }
      );
    }

    if (requestedCount > quota.maxPerBatch) {
      return NextResponse.json(
        {
          error: quota.isUnlimitedPlan
            ? `Requested quantity (${requestedCount}) exceeds the maximum safe per-batch limit of ${quota.maxPerBatch} aliases.`
            : `Requested quantity (${requestedCount}) exceeds your remaining provider plan quota of ${quota.remaining} aliases (Free Plan limit: ${quota.totalLimit}).`,
        },
        { status: 400 }
      );
    }

    if (clientSettings.mode === "live" && !apiKey) {
      return NextResponse.json(
        {
          error:
            "SimpleLogin API key is not configured for Live Mode. Open API Connection settings to add your key or use Sandbox Mode.",
        },
        { status: 400 }
      );
    }

    // Update primary email in settings if user changed it in the form
    if (targetPrimaryEmail !== clientSettings.primaryEmail) {
      await dbQuery(
        `UPDATE provider_settings SET primary_email = $1, updated_at = NOW() WHERE id = 1`,
        [targetPrimaryEmail]
      );
    }

    const resolvedMailboxId =
      mailboxId ??
      clientSettings.availableMailboxes.find(
        (m) => m.email.toLowerCase() === targetPrimaryEmail.toLowerCase()
      )?.id ??
      clientSettings.defaultMailboxId ??
      10421;

    const batchId = `batch_${Date.now().toString(36)}_${crypto
      .randomBytes(2)
      .toString("hex")}`;

    await dbQuery(
      `INSERT INTO generation_batches (
        id, requested_count, created_count, failed_count,
        primary_email, mailbox_id, generation_mode, prefix_pattern,
        domain_suffix, note, status
      ) VALUES (
        $1, $2, 0, 0,
        $3, $4, $5, $6,
        $7, $8, 'running'
      )`,
      [
        batchId,
        requestedCount,
        targetPrimaryEmail,
        resolvedMailboxId,
        generationMode,
        prefixPattern || null,
        domainSuffix,
        note || null,
      ]
    );

    const createdAliases: AliasRecord[] = [];
    const errors: string[] = [];
    let createdCount = 0;
    let failedCount = 0;
    let hitRateLimit = false;

    if (clientSettings.mode === "live" && apiKey) {
      const client = new SimpleLoginClient(apiKey, clientSettings.apiBaseUrl);

      // Fetch fresh signed_suffix options if using custom_prefix
      let signedSuffixToUse =
        clientSettings.availableSuffixes.find((s) => s.suffix === domainSuffix)
          ?.signed_suffix || clientSettings.defaultSignedSuffix;

      if (generationMode === "custom_prefix") {
        try {
          const freshOptions = await client.getAliasOptions();
          if (!freshOptions.can_create) {
            throw new SimpleLoginApiError(
              "SimpleLogin reported can_create=false (account alias quota reached).",
              403
            );
          }
          const matched =
            freshOptions.suffixes.find((s) => s.suffix === domainSuffix) ||
            freshOptions.suffixes[0];
          if (matched) {
            signedSuffixToUse = matched.signed_suffix;
          }
        } catch (err) {
          if (err instanceof SimpleLoginApiError) {
            await dbQuery(
              `UPDATE generation_batches
               SET status = 'failed', failed_count = $1, error_summary = $2, completed_at = NOW()
               WHERE id = $3`,
              [requestedCount, err.message, batchId]
            );
            return NextResponse.json({ error: err.message }, { status: err.status });
          }
        }
      }

      for (let i = 0; i < requestedCount; i++) {
        // Rate limit pacing between sequential requests
        if (i > 0) {
          await sleep(220);
        }

        try {
          let apiAlias: SimpleLoginAliasResponse;
          const itemNote =
            note ||
            `Generated in batch ${batchId} (#${i + 1}/${requestedCount}) -> ${targetPrimaryEmail}`;

          if (generationMode === "custom_prefix") {
            if (!signedSuffixToUse) {
              throw new SimpleLoginApiError(
                "No valid signed_suffix available from SimpleLogin /api/v5/alias/options.",
                400
              );
            }
            const cleanPrefix = prefixPattern
              .trim()
              .toLowerCase()
              .replace(/[^a-z0-9._-]/g, "-")
              .replace(/-+/g, "-")
              .replace(/^-|-$/g, "");
            const randSuffix = crypto.randomBytes(2).toString("hex");
            const seq = String(i + 1).padStart(2, "0");
            const finalPrefix =
              requestedCount === 1
                ? `${cleanPrefix}-${randSuffix}`
                : `${cleanPrefix}-${seq}-${randSuffix}`;

            apiAlias = await client.createCustomAlias({
              aliasPrefix: finalPrefix,
              signedSuffix: signedSuffixToUse,
              mailboxIds: [resolvedMailboxId],
              note: itemNote,
              name: displayName || undefined,
            });
          } else {
            apiAlias = await client.createRandomAlias({
              mode: generationMode === "random_uuid" ? "uuid" : "word",
              note: itemNote,
            });
          }

          const { prefix, domain } = splitEmailParts(apiAlias.email);
          const mailboxesList =
            apiAlias.mailboxes && apiAlias.mailboxes.length > 0
              ? apiAlias.mailboxes
              : apiAlias.mailbox
              ? [apiAlias.mailbox]
              : [{ id: resolvedMailboxId, email: targetPrimaryEmail }];

          const primaryForwardEmail =
            mailboxesList[0]?.email || targetPrimaryEmail;

          const insertRes = await dbQuery<Record<string, unknown>>(
            `INSERT INTO aliases (
              remote_alias_id, email, prefix, domain, primary_email,
              mailbox_id, mailboxes, enabled, creation_status, forwarding_status,
              note, display_name, batch_id, nb_forward, nb_reply, nb_block,
              pinned, provider_mode
            ) VALUES (
              $1, $2, $3, $4, $5,
              $6, $7::jsonb, $8, 'active', 'configured',
              $9, $10, $11, $12, $13, $14,
              $15, 'live'
            )
            ON CONFLICT (email) DO UPDATE SET
              remote_alias_id = EXCLUDED.remote_alias_id,
              enabled = EXCLUDED.enabled,
              updated_at = NOW()
            RETURNING *`,
            [
              apiAlias.id,
              apiAlias.email,
              prefix,
              domain,
              primaryForwardEmail,
              mailboxesList[0]?.id ?? resolvedMailboxId,
              JSON.stringify(mailboxesList),
              Boolean(apiAlias.enabled ?? true),
              apiAlias.note ?? itemNote,
              apiAlias.name ?? displayName ?? "",
              batchId,
              Number(apiAlias.nb_forward || 0),
              Number(apiAlias.nb_reply || 0),
              Number(apiAlias.nb_block || 0),
              Boolean(apiAlias.pinned || false),
            ]
          );

          createdCount++;
          if (insertRes.rows[0]) {
            createdAliases.push(mapAliasRow(insertRes.rows[0]));
          }
        } catch (err) {
          failedCount++;
          const msg =
            err instanceof Error ? err.message : "Alias creation error";
          errors.push(`Alias #${i + 1}: ${msg}`);

          if (err instanceof SimpleLoginApiError && err.isRateLimit) {
            hitRateLimit = true;
            break;
          }
        }
      }
    } else {
      // Sandbox Provider Mode (executes full PostgreSQL persistence + rate-paced creation)
      for (let i = 0; i < requestedCount; i++) {
        if (i > 0) {
          await sleep(35);
        }

        const generated = generateSandboxAliasAddress({
          mode: generationMode,
          prefixPattern,
          domainSuffix,
          index: i,
        });

        const itemNote =
          note ||
          `Batch ${batchId} (#${i + 1}/${requestedCount}) • Forwarded to ${targetPrimaryEmail}`;

        const insertRes = await dbQuery<Record<string, unknown>>(
          `INSERT INTO aliases (
            remote_alias_id, email, prefix, domain, primary_email,
            mailbox_id, mailboxes, enabled, creation_status, forwarding_status,
            note, display_name, batch_id, nb_forward, nb_reply, nb_block,
            pinned, provider_mode
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7::jsonb, TRUE, 'active', 'configured',
            $8, $9, $10, 0, 0, 0,
            FALSE, 'sandbox'
          ) RETURNING *`,
          [
            generated.remoteId,
            generated.email,
            generated.prefix,
            generated.domain,
            targetPrimaryEmail,
            resolvedMailboxId,
            JSON.stringify([{ id: resolvedMailboxId, email: targetPrimaryEmail }]),
            itemNote,
            displayName || "",
            batchId,
          ]
        );

        createdCount++;
        if (insertRes.rows[0]) {
          createdAliases.push(mapAliasRow(insertRes.rows[0]));
        }
      }
    }

    const finalBatchStatus = hitRateLimit
      ? "rate_limited"
      : failedCount === 0
      ? "completed"
      : createdCount > 0
      ? "partial"
      : "failed";

    const batchUpdateRes = await dbQuery<Record<string, unknown>>(
      `UPDATE generation_batches
       SET created_count = $1,
           failed_count = $2,
           status = $3,
           error_summary = $4,
           completed_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        createdCount,
        failedCount,
        finalBatchStatus,
        errors.length > 0 ? errors.slice(0, 3).join("; ") : null,
        batchId,
      ]
    );

    const [updatedSettings, stats] = await Promise.all([
      getServerProviderSettings(),
      getDashboardStats(),
    ]);

    return NextResponse.json({
      batch: batchUpdateRes.rows[0]
        ? mapBatchRow(batchUpdateRes.rows[0])
        : null,
      createdAliases,
      createdCount,
      failedCount,
      errors,
      settings: updatedSettings.clientSettings,
      stats,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to execute bulk alias generation",
      },
      { status: 500 }
    );
  }
}
