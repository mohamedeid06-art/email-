import { NextRequest, NextResponse } from "next/server";
import { dbQuery, getDashboardStats, mapAliasRow } from "@/lib/db";
import { getServerProviderSettings } from "@/lib/settings";
import { SimpleLoginClient } from "@/lib/simplelogin";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { ids, action, primaryEmail, mailboxId } = body as {
      ids?: number[];
      action: "enable" | "disable" | "delete" | "update_forwarding" | "clear_all";
      primaryEmail?: string;
      mailboxId?: number;
    };

    if (action === "clear_all") {
      await dbQuery("DELETE FROM aliases");
      const [stats, updatedSettings] = await Promise.all([
        getDashboardStats(),
        getServerProviderSettings(),
      ]);
      return NextResponse.json({
        processedCount: 0,
        errors: [],
        stats,
        settings: updatedSettings.clientSettings,
      });
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "Please select at least one alias for bulk management." },
        { status: 400 }
      );
    }

    const cleanIds = ids
      .map((n) => Number(n))
      .filter((n) => Number.isInteger(n) && n > 0);

    if (cleanIds.length === 0) {
      return NextResponse.json(
        { error: "No valid alias IDs provided." },
        { status: 400 }
      );
    }

    const placeholders = cleanIds.map((_, idx) => `$${idx + 1}`).join(", ");
    const targetRes = await dbQuery<Record<string, unknown>>(
      `SELECT * FROM aliases WHERE id IN (${placeholders})`,
      cleanIds
    );
    const targetAliases = targetRes.rows.map(mapAliasRow);

    const { clientSettings, apiKey } = await getServerProviderSettings();
    const isLive = Boolean(clientSettings.mode === "live" && apiKey);
    const client =
      isLive && apiKey
        ? new SimpleLoginClient(apiKey, clientSettings.apiBaseUrl)
        : null;

    let processedCount = 0;
    const errors: string[] = [];

    if (action === "delete") {
      for (const alias of targetAliases) {
        if (client && alias.remoteAliasId && alias.providerMode === "live") {
          try {
            await client.deleteAlias(alias.remoteAliasId);
            await sleep(150);
          } catch (err) {
            errors.push(
              `${alias.email}: ${
                err instanceof Error ? err.message : "Remote delete error"
              }`
            );
          }
        }
        await dbQuery("DELETE FROM aliases WHERE id = $1", [alias.id]);
        processedCount++;
      }
    } else if (action === "enable" || action === "disable") {
      const desiredEnabled = action === "enable";
      for (const alias of targetAliases) {
        if (alias.enabled === desiredEnabled) {
          processedCount++;
          continue;
        }
        if (client && alias.remoteAliasId && alias.providerMode === "live") {
          try {
            await client.toggleAlias(alias.remoteAliasId);
            await sleep(150);
          } catch (err) {
            errors.push(
              `${alias.email}: ${
                err instanceof Error ? err.message : "Remote toggle error"
              }`
            );
            continue;
          }
        }
        await dbQuery(
          `UPDATE aliases
           SET enabled = $1,
               creation_status = $2,
               forwarding_status = $3,
               updated_at = NOW()
           WHERE id = $4`,
          [
            desiredEnabled,
            desiredEnabled ? "active" : "disabled",
            desiredEnabled ? "configured" : "paused",
            alias.id,
          ]
        );
        processedCount++;
      }
    } else if (action === "update_forwarding") {
      if (
        !primaryEmail ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(primaryEmail.trim())
      ) {
        return NextResponse.json(
          { error: "Valid primary forwarding email is required." },
          { status: 400 }
        );
      }
      const cleanEmail = primaryEmail.trim();
      const targetMbId = mailboxId || clientSettings.defaultMailboxId || 10421;

      for (const alias of targetAliases) {
        if (
          client &&
          alias.remoteAliasId &&
          alias.providerMode === "live" &&
          mailboxId
        ) {
          try {
            await client.updateAlias(alias.remoteAliasId, {
              mailbox_ids: [mailboxId],
            });
            await sleep(150);
          } catch (err) {
            errors.push(
              `${alias.email}: ${
                err instanceof Error ? err.message : "Forwarding update failed"
              }`
            );
          }
        }
        await dbQuery(
          `UPDATE aliases
           SET primary_email = $1,
               mailbox_id = $2,
               mailboxes = $3::jsonb,
               updated_at = NOW()
           WHERE id = $4`,
          [
            cleanEmail,
            targetMbId,
            JSON.stringify([{ id: targetMbId, email: cleanEmail }]),
            alias.id,
          ]
        );
        processedCount++;
      }
    }

    const [stats, updatedSettings] = await Promise.all([
      getDashboardStats(),
      getServerProviderSettings(),
    ]);

    return NextResponse.json({
      processedCount,
      errors,
      stats,
      settings: updatedSettings.clientSettings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to complete bulk operation",
      },
      { status: 500 }
    );
  }
}
