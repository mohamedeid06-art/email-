import { NextRequest, NextResponse } from "next/server";
import { dbQuery, getDashboardStats, mapAliasRow } from "@/lib/db";
import { getServerProviderSettings } from "@/lib/settings";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const aliasId = parseInt(id, 10);
    const existingRes = await dbQuery<Record<string, unknown>>(
      "SELECT * FROM aliases WHERE id = $1",
      [aliasId]
    );
    if (!existingRes.rows[0]) {
      return NextResponse.json({ error: "Alias not found" }, { status: 404 });
    }
    const existing = mapAliasRow(existingRes.rows[0]);
    const body = await req.json();
    const {
      action,
      enabled,
      isUsed,
      note,
      displayName,
      primaryEmail,
      mailboxId,
      pinned,
    } = body as {
      action?: "toggle" | "toggle_used" | "mark_used";
      enabled?: boolean;
      isUsed?: boolean;
      note?: string;
      displayName?: string;
      primaryEmail?: string;
      mailboxId?: number;
      pinned?: boolean;
    };

    const newEnabled =
      action === "toggle"
        ? !existing.enabled
        : typeof enabled === "boolean"
        ? enabled
        : existing.enabled;

    const newIsUsed =
      action === "mark_used"
        ? true
        : action === "toggle_used"
        ? !existing.isUsed
        : typeof isUsed === "boolean"
        ? isUsed
        : existing.isUsed;

    const nextEmail =
      primaryEmail !== undefined ? primaryEmail.trim() : existing.primaryEmail;
    const nextMbId =
      mailboxId !== undefined ? mailboxId : existing.mailboxId;

    const updateRes = await dbQuery<Record<string, unknown>>(
      `UPDATE aliases
       SET enabled = $1,
           is_used = $2,
           used_at = CASE WHEN $2 = TRUE THEN COALESCE(used_at, NOW()) ELSE NULL END,
           creation_status = $3,
           forwarding_status = $4,
           note = $5,
           display_name = $6,
           primary_email = $7,
           mailbox_id = $8,
           pinned = $9,
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        newEnabled,
        newIsUsed,
        newEnabled ? "active" : "disabled",
        newEnabled ? "configured" : "paused",
        note ?? existing.note,
        displayName ?? existing.displayName,
        nextEmail,
        nextMbId,
        pinned ?? existing.pinned,
        aliasId,
      ]
    );

    const [stats, updated] = await Promise.all([
      getDashboardStats(),
      getServerProviderSettings(),
    ]);

    return NextResponse.json({
      alias: mapAliasRow(updateRes.rows[0]),
      stats,
      settings: updated.clientSettings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to update alias",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const aliasId = parseInt(id, 10);
    await dbQuery("DELETE FROM aliases WHERE id = $1", [aliasId]);
    const [stats, updated] = await Promise.all([
      getDashboardStats(),
      getServerProviderSettings(),
    ]);
    return NextResponse.json({
      deletedId: aliasId,
      stats,
      settings: updated.clientSettings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to delete alias",
      },
      { status: 500 }
    );
  }
}
