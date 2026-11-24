import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  findCloudflareZone,
  syncCloudflareCustomRulesForAliases,
  updateCloudflareCatchAll,
} from "@/lib/cloudflare";
import { dbQuery, getDashboardStats, mapAliasRow, mapBatchRow } from "@/lib/db";
import { getServerProviderSettings } from "@/lib/settings";
import { generateSandboxAliasAddress } from "@/lib/simplelogin";
import type { AliasRecord, GenerationMode } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      count,
      primaryEmail,
      mailboxId,
      generationMode = "numeric_dot",
      prefixPattern = "",
      domainSuffix = "@smsmraw.com",
      note = "",
      displayName = "",
      pinToCloudflare = true,
    } = body as {
      count: number;
      primaryEmail?: string;
      mailboxId?: number;
      generationMode?: GenerationMode;
      prefixPattern?: string;
      domainSuffix?: string;
      note?: string;
      displayName?: string;
      pinToCloudflare?: boolean;
    };

    const requestedCount = Math.min(500, Math.max(1, Number(count) || 10));
    const { clientSettings, cloudflareKey, cloudflareEmail } =
      await getServerProviderSettings();

    const targetEmail = (
      primaryEmail ||
      clientSettings.primaryEmail ||
      "mhmdsamy112233@gmail.com"
    ).trim();

    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      return NextResponse.json(
        { error: "يرجى إدخال إيميل استقبال صحيح." },
        { status: 400 }
      );
    }

    if (generationMode === "custom_prefix" && !prefixPattern.trim()) {
      return NextResponse.json(
        { error: "يرجى كتابة البادئة المخصصة (Prefix) أولاً." },
        { status: 400 }
      );
    }

    const cleanSuffix =
      domainSuffix.trim().startsWith("@") || domainSuffix.trim().startsWith(".")
        ? domainSuffix.trim()
        : `@${domainSuffix.trim()}`;

    if (targetEmail !== clientSettings.primaryEmail) {
      const mbs = [...clientSettings.availableMailboxes];
      if (!mbs.some((m) => m.email.toLowerCase() === targetEmail.toLowerCase())) {
        const nextId = mbs.reduce((max, m) => Math.max(max, m.id), 10420) + 1;
        mbs.push({
          id: nextId,
          email: targetEmail,
          default: true,
          verified: true,
        });
      }
      await dbQuery(
        "UPDATE provider_settings SET primary_email = $1, available_mailboxes = $2::jsonb, updated_at = NOW() WHERE id = 1",
        [targetEmail, JSON.stringify(mbs)]
      );
    }

    const resolvedMbId = mailboxId ?? clientSettings.defaultMailboxId ?? 10421;
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
        targetEmail,
        resolvedMbId,
        generationMode,
        prefixPattern || null,
        cleanSuffix,
        note || null,
      ]
    );

    const valuePlaceholders: string[] = [];
    const insertParams: unknown[] = [];
    const seenEmails = new Set<string>();
    const mailboxJson = JSON.stringify([
      { id: resolvedMbId, email: targetEmail },
    ]);

    for (let i = 0; i < requestedCount; i++) {
      let gen = generateSandboxAliasAddress({
        mode: generationMode,
        prefixPattern,
        domainSuffix: cleanSuffix,
        index: i,
      });
      while (seenEmails.has(gen.email)) {
        gen = generateSandboxAliasAddress({
          mode: generationMode,
          prefixPattern,
          domainSuffix: cleanSuffix,
          index: i + crypto.randomInt(100, 9999),
        });
      }
      seenEmails.add(gen.email);

      const baseIdx = insertParams.length;
      valuePlaceholders.push(
        `($${baseIdx + 1}, $${baseIdx + 2}, $${baseIdx + 3}, $${baseIdx + 4}, $${
          baseIdx + 5
        }, $${baseIdx + 6}::jsonb, TRUE, FALSE, 'active', 'configured', $${
          baseIdx + 7
        }, $${baseIdx + 8}, $${baseIdx + 9}, 'sandbox')`
      );
      insertParams.push(
        gen.email,
        gen.prefix,
        gen.domain,
        targetEmail,
        resolvedMbId,
        mailboxJson,
        note || "",
        displayName || "",
        batchId
      );
    }

    const insertRes = await dbQuery<Record<string, unknown>>(
      `INSERT INTO aliases (
        email, prefix, domain, primary_email, mailbox_id,
        mailboxes, enabled, is_used, creation_status, forwarding_status,
        note, display_name, batch_id, provider_mode
      ) VALUES ${valuePlaceholders.join(", ")}
      ON CONFLICT (email) DO NOTHING
      RETURNING *`,
      insertParams
    );

    const createdAliases: AliasRecord[] = insertRes.rows.map(mapAliasRow);
    const createdCount = createdAliases.length;

    let cloudflarePinnedCount = 0;
    if (
      cloudflareKey &&
      cleanSuffix.toLowerCase().includes("smsmraw.com")
    ) {
      try {
        const { zoneId } = await findCloudflareZone(
          { token: cloudflareKey, authEmail: cloudflareEmail },
          "smsmraw.com"
        );
        // Set Catch-All to current receiver as fallback
        await updateCloudflareCatchAll(
          { token: cloudflareKey, authEmail: cloudflareEmail },
          zoneId,
          targetEmail
        ).catch(() => {});

        // Also create dedicated per-alias Custom Routing Rules in Cloudflare
        // so this batch remains permanently bound to targetEmail even after switching receivers later!
        if (pinToCloudflare && createdAliases.length > 0) {
          const toPin = createdAliases.slice(0, 100).map((a) => ({
            email: a.email,
            destinationEmail: targetEmail,
          }));
          const pinRes = await syncCloudflareCustomRulesForAliases(
            { token: cloudflareKey, authEmail: cloudflareEmail },
            zoneId,
            toPin
          );
          cloudflarePinnedCount = pinRes.pinnedCount;
        }
      } catch {}
    }

    const batchRes = await dbQuery<Record<string, unknown>>(
      `UPDATE generation_batches
       SET created_count = $1, failed_count = 0, status = 'completed', completed_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [createdCount, batchId]
    );

    const [updatedSettings, stats] = await Promise.all([
      getServerProviderSettings(),
      getDashboardStats(),
    ]);

    return NextResponse.json({
      batch: batchRes.rows[0] ? mapBatchRow(batchRes.rows[0]) : null,
      createdAliases,
      createdCount,
      cloudflarePinnedCount,
      failedCount: 0,
      errors: [],
      settings: updatedSettings.clientSettings,
      stats,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "فشل توليد الإيميلات",
      },
      { status: 500 }
    );
  }
}
