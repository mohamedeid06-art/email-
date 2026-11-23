import { NextRequest, NextResponse } from "next/server";
import { dbQuery, getDashboardStats, mapAliasRow } from "@/lib/db";
import {
  getServerProviderSettings,
  seedInitialAliasesIfEmpty,
} from "@/lib/settings";

const ALLOWED_SORT_COLUMNS: Record<string, string> = {
  createdAt: "created_at",
  email: "email",
  primaryEmail: "primary_email",
  status: "creation_status",
  nbForward: "nb_forward",
  domain: "domain",
  note: "note",
};

export async function GET(req: NextRequest) {
  try {
    await seedInitialAliasesIfEmpty();

    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const status = (searchParams.get("status") || "all").trim();
    const domain = (searchParams.get("domain") || "all").trim();
    const batchId = (searchParams.get("batchId") || "all").trim();
    const sortByKey = searchParams.get("sortBy") || "createdAt";
    const sortOrderRaw = (searchParams.get("sortOrder") || "desc").toLowerCase();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const pageSize = Math.min(
      100,
      Math.max(5, parseInt(searchParams.get("pageSize") || "10", 10) || 10)
    );

    const sortColumn = ALLOWED_SORT_COLUMNS[sortByKey] || "created_at";
    const sortDirection = sortOrderRaw === "asc" ? "ASC" : "DESC";

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (search) {
      params.push(`%${search}%`);
      const idx = params.length;
      conditions.push(
        `(email ILIKE $${idx} OR primary_email ILIKE $${idx} OR note ILIKE $${idx} OR display_name ILIKE $${idx} OR domain ILIKE $${idx} OR COALESCE(batch_id, '') ILIKE $${idx})`
      );
    }

    if (status === "active") {
      conditions.push(`(enabled = TRUE AND creation_status = 'active')`);
    } else if (status === "disabled") {
      conditions.push(`(enabled = FALSE OR creation_status = 'disabled')`);
    } else if (status === "failed") {
      conditions.push(`(creation_status IN ('failed', 'rate_limited'))`);
    }

    if (domain && domain !== "all") {
      const cleanDomain = domain.startsWith("@") ? domain.slice(1) : domain;
      params.push(cleanDomain);
      conditions.push(`domain = $${params.length}`);
    }

    if (batchId && batchId !== "all") {
      params.push(batchId);
      conditions.push(`batch_id = $${params.length}`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countQuery = `SELECT COUNT(*)::int AS total FROM aliases ${whereClause}`;
    const countRes = await dbQuery<{ total: number }>(countQuery, params);
    const totalItems = Number(countRes.rows[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * pageSize;

    const dataParams = [...params, pageSize, offset];
    const dataQuery = `
      SELECT *
      FROM aliases
      ${whereClause}
      ORDER BY pinned DESC, ${sortColumn} ${sortDirection}, id DESC
      LIMIT $${dataParams.length - 1}
      OFFSET $${dataParams.length}
    `;

    const [rowsRes, domainsRes, stats, { clientSettings }] = await Promise.all([
      dbQuery<Record<string, unknown>>(dataQuery, dataParams),
      dbQuery<{ domain: string }>(
        "SELECT DISTINCT domain FROM aliases ORDER BY domain ASC"
      ),
      getDashboardStats(),
      getServerProviderSettings(),
    ]);

    return NextResponse.json({
      aliases: rowsRes.rows.map(mapAliasRow),
      pagination: {
        page: safePage,
        pageSize,
        totalItems,
        totalPages,
      },
      domains: domainsRes.rows.map((r) => r.domain),
      stats,
      settings: clientSettings,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to query aliases",
      },
      { status: 500 }
    );
  }
}
