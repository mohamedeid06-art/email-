import { NextResponse } from "next/server";
import { dbQuery, getDashboardStats } from "@/lib/db";
import { getServerProviderSettings } from "@/lib/settings";
import { SimpleLoginClient } from "@/lib/simplelogin";

export async function POST() {
  try {
    const { clientSettings, apiKey } = await getServerProviderSettings();

    if (clientSettings.mode !== "live" || !apiKey) {
      return NextResponse.json(
        {
          error:
            "Remote SimpleLogin sync requires Live API mode with a configured SimpleLogin API key.",
        },
        { status: 400 }
      );
    }

    const client = new SimpleLoginClient(apiKey, clientSettings.apiBaseUrl);
    const { aliases } = await client.listAliases(0);

    let syncedCount = 0;
    for (const remote of aliases) {
      const parts = remote.email.split("@");
      const prefix = parts[0] || remote.email;
      const domain = parts[1] || "simplelogin.com";
      const mailboxes =
        remote.mailboxes && remote.mailboxes.length > 0
          ? remote.mailboxes
          : remote.mailbox
          ? [remote.mailbox]
          : [
              {
                id: clientSettings.defaultMailboxId || 0,
                email: clientSettings.primaryEmail,
              },
            ];
      const primaryEmail =
        mailboxes[0]?.email || clientSettings.primaryEmail || "";

      await dbQuery(
        `INSERT INTO aliases (
          remote_alias_id, email, prefix, domain, primary_email,
          mailbox_id, mailboxes, enabled, creation_status, forwarding_status,
          note, display_name, nb_forward, nb_reply, nb_block,
          pinned, provider_mode
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7::jsonb, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, 'live'
        )
        ON CONFLICT (email) DO UPDATE SET
          remote_alias_id = EXCLUDED.remote_alias_id,
          primary_email = EXCLUDED.primary_email,
          mailbox_id = EXCLUDED.mailbox_id,
          mailboxes = EXCLUDED.mailboxes,
          enabled = EXCLUDED.enabled,
          creation_status = EXCLUDED.creation_status,
          forwarding_status = EXCLUDED.forwarding_status,
          note = EXCLUDED.note,
          display_name = EXCLUDED.display_name,
          nb_forward = EXCLUDED.nb_forward,
          nb_reply = EXCLUDED.nb_reply,
          nb_block = EXCLUDED.nb_block,
          pinned = EXCLUDED.pinned,
          provider_mode = 'live',
          updated_at = NOW()`,
        [
          remote.id,
          remote.email,
          prefix,
          domain,
          primaryEmail,
          mailboxes[0]?.id ?? null,
          JSON.stringify(mailboxes),
          Boolean(remote.enabled),
          remote.enabled ? "active" : "disabled",
          remote.enabled ? "configured" : "paused",
          remote.note || "",
          remote.name || "",
          Number(remote.nb_forward || 0),
          Number(remote.nb_reply || 0),
          Number(remote.nb_block || 0),
          Boolean(remote.pinned),
        ]
      );
      syncedCount++;
    }

    await dbQuery(
      "UPDATE provider_settings SET last_synced_at = NOW(), updated_at = NOW() WHERE id = 1"
    );

    const [updatedSettings, stats] = await Promise.all([
      getServerProviderSettings(),
      getDashboardStats(),
    ]);

    return NextResponse.json({
      syncedCount,
      settings: updatedSettings.clientSettings,
      stats,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to sync aliases from SimpleLogin",
      },
      { status: 500 }
    );
  }
}
