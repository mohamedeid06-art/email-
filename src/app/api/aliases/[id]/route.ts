import { NextRequest, NextResponse } from "next/server";
import { dbQuery, getDashboardStats, mapAliasRow } from "@/lib/db";
import { getServerProviderSettings } from "@/lib/settings";
import { SimpleLoginClient } from "@/lib/simplelogin";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const aliasId = parseInt(id, 10);
    if (isNaN(aliasId)) {
      return NextResponse.json({ error: "Invalid alias ID" }, { status: 400 });
    }

    const existingRes = await dbQuery<Record<string, unknown>>(
      "SELECT * FROM aliases WHERE id = $1",
      [aliasId]
    );
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: "Alias not found" }, { status: 404 });
    }

    const existing = mapAliasRow(existingRes.rows[0]);
    const body = await req.json();
    const {
      action,
      enabled,
      note,
      displayName,
      primaryEmail,
      mailboxId,
      pinned,
    } = body as {
      action?: "toggle";
      enabled?: boolean;
      note?: string;
      displayName?: string;
      primaryEmail?: string;
      mailboxId?: number;
      pinned?: boolean;
    };

    const { clientSettings, apiKey } = await getServerProviderSettings();
    let newEnabled =
      action === "toggle"
        ? !existing.enabled
        : typeof enabled === "boolean"
        ? enabled
        : existing.enabled;

    // Sync with official SimpleLogin API when in live mode and remoteAliasId exists
    if (
      clientSettings.mode === "live" &&
      apiKey &&
      existing.remoteAliasId &&
      existing.providerMode === "live"
    ) {
      const client = new SimpleLoginClient(apiKey, clientSettings.apiBaseUrl);
      if (action === "toggle" || (typeof enabled === "boolean" && enabled !== existing.enabled)) {
        const toggleResp = await client.toggleAlias(existing.remoteAliasId);
        if (typeof toggleResp.enabled === "boolean") {
          newEnabled = toggleResp.enabled;
        }
      }

      if (
        note !== undefined ||
        displayName !== undefined ||
        mailboxId !== undefined ||
        pinned !== undefined
      ) {
        await client.updateAlias(existing.remoteAliasId, {
          note: note !== undefined ? note : undefined,
          name: displayName !== undefined ? displayName : undefined,
          mailbox_ids: mailboxId !== undefined ? [mailboxId] : undefined,
          pinned: pinned !== undefined ? pinned : undefined,
        });
      }
    }

    const newCreationStatus = newEnabled ? "active" : "disabled";
    const newForwardingStatus = newEnabled ? "configured" : "paused";
    const resolvedPrimaryEmail =
      primaryEmail !== undefined ? primaryEmail.trim() : existing.primaryEmail;
    const resolvedMailboxId =
      mailboxId !== undefined ? mailboxId : existing.mailboxId;
    const resolvedMailboxes =
      primaryEmail !== undefined
        ? [{ id: resolvedMailboxId || 10421, email: resolvedPrimaryEmail }]
        : existing.mailboxes;

    const updateRes = await dbQuery<Record<string, unknown>>(
      `UPDATE aliases
       SET enabled = $1,
           creation_status = $2,
           forwarding_status = $3,
           note = $4,
           display_name = $5,
           primary_email = $6,
           mailbox_id = $7,
           mailboxes = $8::jsonb,
           pinned = $9,
           updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [
        newEnabled,
        newCreationStatus,
        newForwardingStatus,
        note !== undefined ? note : existing.note,
        displayName !== undefined ? displayName : existing.displayName,
        resolvedPrimaryEmail,
        resolvedMailboxId,
        JSON.stringify(resolvedMailboxes),
        pinned !== undefined ? pinned : existing.pinned,
        aliasId,
      ]
    );

    const [stats, updatedSettings] = await Promise.all([
      getDashboardStats(),
      getServerProviderSettings(),
    ]);

    return NextResponse.json({
      alias: mapAliasRow(updateRes.rows[0]),
      stats,
      settings: updatedSettings.clientSettings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to update alias",
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
    if (isNaN(aliasId)) {
      return NextResponse.json({ error: "Invalid alias ID" }, { status: 400 });
    }

    const existingRes = await dbQuery<Record<string, unknown>>(
      "SELECT * FROM aliases WHERE id = $1",
      [aliasId]
    );
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: "Alias not found" }, { status: 404 });
    }

    const existing = mapAliasRow(existingRes.rows[0]);
    const { clientSettings, apiKey } = await getServerProviderSettings();

    if (
      clientSettings.mode === "live" &&
      apiKey &&
      existing.remoteAliasId &&
      existing.providerMode === "live"
    ) {
      const client = new SimpleLoginClient(apiKey, clientSettings.apiBaseUrl);
      await client.deleteAlias(existing.remoteAliasId);
    }

    await dbQuery("DELETE FROM aliases WHERE id = $1", [aliasId]);

    const [stats, updatedSettings] = await Promise.all([
      getDashboardStats(),
      getServerProviderSettings(),
    ]);

    return NextResponse.json({
      deletedId: aliasId,
      stats,
      settings: updatedSettings.clientSettings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to delete alias",
      },
      { status: 500 }
    );
  }
}
