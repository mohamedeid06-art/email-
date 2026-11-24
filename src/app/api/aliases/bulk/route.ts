import { NextRequest, NextResponse } from "next/server";
import {
  deleteCloudflareCustomRulesForAliases,
  findCloudflareZone,
  syncCloudflareCustomRulesForAliases,
} from "@/lib/cloudflare";
import { dbQuery, getDashboardStats } from "@/lib/db";
import { getServerProviderSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const { ids, action, primaryEmail, backupAliases } = (await req.json()) as {
      ids?: number[];
      action:
        | "enable"
        | "disable"
        | "delete"
        | "clear_all"
        | "clear_used"
        | "mark_used"
        | "mark_unused"
        | "switch_receiver"
        | "pin_to_cloudflare"
        | "restore_backup";
      primaryEmail?: string;
      backupAliases?: Array<{
        email: string;
        prefix: string;
        domain: string;
        primaryEmail: string;
        isUsed?: boolean;
        note?: string;
      }>;
    };

    const { cloudflareKey, cloudflareEmail, clientSettings } =
      await getServerProviderSettings();

    if (
      action === "restore_backup" &&
      Array.isArray(backupAliases) &&
      backupAliases.length > 0
    ) {
      for (const item of backupAliases.slice(0, 500)) {
        if (!item.email || !item.email.includes("@")) continue;
        const [p, d] = item.email.split("@");
        await dbQuery(
          `INSERT INTO aliases (
            email, prefix, domain, primary_email, mailbox_id,
            mailboxes, enabled, is_used, creation_status, forwarding_status,
            note, display_name, provider_mode
          ) VALUES (
            $1, $2, $3, $4, 10421,
            $5::jsonb, TRUE, $6, 'active', 'configured',
            $7, '', 'sandbox'
          ) ON CONFLICT (email) DO UPDATE SET
            is_used = EXCLUDED.is_used,
            primary_email = EXCLUDED.primary_email`,
          [
            item.email,
            item.prefix || p,
            item.domain || d || "smsmraw.com",
            item.primaryEmail || "mhmdsamy112233@gmail.com",
            JSON.stringify([
              {
                id: 10421,
                email: item.primaryEmail || "mhmdsamy112233@gmail.com",
              },
            ]),
            Boolean(item.isUsed),
            item.note || "",
          ]
        );
      }
      const [stats, updated] = await Promise.all([
        getDashboardStats(),
        getServerProviderSettings(),
      ]);
      return NextResponse.json({
        processedCount: backupAliases.length,
        errors: [],
        stats,
        settings: updated.clientSettings,
      });
    }

    if (action === "clear_all") {
      if (cloudflareKey) {
        try {
          const { zoneId } = await findCloudflareZone(
            { token: cloudflareKey, authEmail: cloudflareEmail },
            "smsmraw.com"
          );
          await deleteCloudflareCustomRulesForAliases(
            { token: cloudflareKey, authEmail: cloudflareEmail },
            zoneId
          );
        } catch {}
      }
      await dbQuery("DELETE FROM aliases");
      const [stats, updated] = await Promise.all([
        getDashboardStats(),
        getServerProviderSettings(),
      ]);
      return NextResponse.json({
        processedCount: 0,
        errors: [],
        stats,
        settings: updated.clientSettings,
      });
    }

    if (action === "clear_used") {
      if (cloudflareKey) {
        try {
          const usedRows = await dbQuery<{ email: string }>(
            "SELECT email FROM aliases WHERE is_used = TRUE"
          );
          if (usedRows.rows.length > 0) {
            const { zoneId } = await findCloudflareZone(
              { token: cloudflareKey, authEmail: cloudflareEmail },
              "smsmraw.com"
            );
            await deleteCloudflareCustomRulesForAliases(
              { token: cloudflareKey, authEmail: cloudflareEmail },
              zoneId,
              usedRows.rows.map((r) => r.email)
            );
          }
        } catch {}
      }
      await dbQuery("DELETE FROM aliases WHERE is_used = TRUE");
      const [stats, updated] = await Promise.all([
        getDashboardStats(),
        getServerProviderSettings(),
      ]);
      return NextResponse.json({
        processedCount: 0,
        errors: [],
        stats,
        settings: updated.clientSettings,
      });
    }

    if (action === "pin_to_cloudflare") {
      if (!cloudflareKey) {
        return NextResponse.json(
          { error: "مفتاح Cloudflare غير متصل." },
          { status: 400 }
        );
      }
      let rowsToPin: Array<{ email: string; primary_email: string }> = [];
      if (Array.isArray(ids) && ids.length > 0) {
        const cleanIds = ids
          .map(Number)
          .filter((n) => Number.isInteger(n) && n > 0);
        const ph = cleanIds.map((_, i) => `$${i + 1}`).join(",");
        const r = await dbQuery<{ email: string; primary_email: string }>(
          `SELECT email, primary_email FROM aliases WHERE id IN (${ph}) LIMIT 100`,
          cleanIds
        );
        rowsToPin = r.rows;
      } else {
        const r = await dbQuery<{ email: string; primary_email: string }>(
          `SELECT email, primary_email FROM aliases WHERE is_used = FALSE ORDER BY id DESC LIMIT 100`
        );
        rowsToPin = r.rows;
      }

      const targetReceiver = primaryEmail?.trim();
      if (targetReceiver && rowsToPin.length > 0) {
        const emailList = rowsToPin.map((r) => r.email);
        const ph = emailList.map((_, i) => `$${i + 2}`).join(",");
        await dbQuery(
          `UPDATE aliases SET primary_email = $1, updated_at = NOW() WHERE email IN (${ph})`,
          [targetReceiver, ...emailList]
        );
      }

      const { zoneId } = await findCloudflareZone(
        { token: cloudflareKey, authEmail: cloudflareEmail },
        "smsmraw.com"
      );
      const { pinnedCount } = await syncCloudflareCustomRulesForAliases(
        { token: cloudflareKey, authEmail: cloudflareEmail },
        zoneId,
        rowsToPin.map((r) => ({
          email: r.email,
          destinationEmail: targetReceiver || r.primary_email,
        }))
      );

      const [stats, updated] = await Promise.all([
        getDashboardStats(),
        getServerProviderSettings(),
      ]);
      return NextResponse.json({
        processedCount: pinnedCount,
        pinnedCount,
        errors: [],
        stats,
        settings: updated.clientSettings,
      });
    }

    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json(
        { error: "يرجى تحديد إيميل واحد على الأقل." },
        { status: 400 }
      );
    }

    const cleanIds = ids
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0);
    const ph = cleanIds.map((_, i) => `$${i + 1}`).join(",");

    if (action === "delete") {
      if (cloudflareKey) {
        try {
          const delRows = await dbQuery<{ email: string }>(
            `SELECT email FROM aliases WHERE id IN (${ph})`,
            cleanIds
          );
          if (delRows.rows.length > 0) {
            const { zoneId } = await findCloudflareZone(
              { token: cloudflareKey, authEmail: cloudflareEmail },
              "smsmraw.com"
            );
            await deleteCloudflareCustomRulesForAliases(
              { token: cloudflareKey, authEmail: cloudflareEmail },
              zoneId,
              delRows.rows.map((r) => r.email)
            );
          }
        } catch {}
      }
      await dbQuery(`DELETE FROM aliases WHERE id IN (${ph})`, cleanIds);
    } else if (action === "mark_used" || action === "mark_unused") {
      const usedVal = action === "mark_used";
      await dbQuery(
        `UPDATE aliases
         SET is_used = $1,
             used_at = CASE WHEN $1 = TRUE THEN NOW() ELSE NULL END,
             updated_at = NOW()
         WHERE id IN (${cleanIds.map((_, i) => `$${i + 2}`).join(",")})`,
        [usedVal, ...cleanIds]
      );
    } else if (action === "switch_receiver" && primaryEmail) {
      const cleanDest = primaryEmail.trim();
      await dbQuery(
        `UPDATE aliases
         SET primary_email = $1, updated_at = NOW()
         WHERE id IN (${cleanIds.map((_, i) => `$${i + 2}`).join(",")})`,
        [cleanDest, ...cleanIds]
      );
      if (cloudflareKey) {
        try {
          const targetRows = await dbQuery<{ email: string }>(
            `SELECT email FROM aliases WHERE id IN (${ph}) LIMIT 100`,
            cleanIds
          );
          const { zoneId } = await findCloudflareZone(
            { token: cloudflareKey, authEmail: cloudflareEmail },
            "smsmraw.com"
          );
          await syncCloudflareCustomRulesForAliases(
            { token: cloudflareKey, authEmail: cloudflareEmail },
            zoneId,
            targetRows.rows.map((r) => ({
              email: r.email,
              destinationEmail: cleanDest,
            }))
          );
        } catch {}
      }
    } else {
      const en = action === "enable";
      await dbQuery(
        `UPDATE aliases
         SET enabled = $1,
             creation_status = $2,
             forwarding_status = $3,
             updated_at = NOW()
         WHERE id IN (${cleanIds.map((_, i) => `$${i + 4}`).join(",")})`,
        [
          en,
          en ? "active" : "disabled",
          en ? "configured" : "paused",
          ...cleanIds,
        ]
      );
    }

    const [stats, updated] = await Promise.all([
      getDashboardStats(),
      getServerProviderSettings(),
    ]);

    return NextResponse.json({
      processedCount: cleanIds.length,
      errors: [],
      stats,
      settings: updated.clientSettings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Bulk operation failed",
      },
      { status: 500 }
    );
  }
}
