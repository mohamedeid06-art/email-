import { NextRequest, NextResponse } from "next/server";
import { dbQuery, getDashboardStats } from "@/lib/db";
import { getServerProviderSettings } from "@/lib/settings";

export async function POST(req: NextRequest) {
  try {
    const { ids, action, primaryEmail } = (await req.json()) as {
      ids?: number[];
      action:
        | "enable"
        | "disable"
        | "delete"
        | "clear_all"
        | "clear_used"
        | "mark_used"
        | "mark_unused"
        | "switch_receiver";
      primaryEmail?: string;
    };

    if (action === "clear_all") {
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
      await dbQuery(
        `UPDATE aliases
         SET primary_email = $1, updated_at = NOW()
         WHERE id IN (${cleanIds.map((_, i) => `$${i + 2}`).join(",")})`,
        [primaryEmail.trim(), ...cleanIds]
      );
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
