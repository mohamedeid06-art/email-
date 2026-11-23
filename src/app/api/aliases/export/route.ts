import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { dbQuery, mapAliasRow } from "@/lib/db";

function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = (searchParams.get("format") || "csv").toLowerCase();
    const idsParam = (searchParams.get("ids") || "").trim();
    const search = (searchParams.get("search") || "").trim();
    const status = (searchParams.get("status") || "all").trim();
    const domain = (searchParams.get("domain") || "all").trim();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);

      if (ids.length > 0) {
        const placeholders = ids.map((_, idx) => `$${idx + 1}`).join(", ");
        params.push(...ids);
        conditions.push(`id IN (${placeholders})`);
      }
    } else {
      if (search) {
        params.push(`%${search}%`);
        const idx = params.length;
        conditions.push(
          `(email ILIKE $${idx} OR primary_email ILIKE $${idx} OR note ILIKE $${idx} OR display_name ILIKE $${idx} OR domain ILIKE $${idx})`
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
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const res = await dbQuery<Record<string, unknown>>(
      `SELECT * FROM aliases ${whereClause} ORDER BY pinned DESC, created_at DESC, id DESC`,
      params
    );

    const aliases = res.rows.map(mapAliasRow);

    const exportRows = aliases.map((a) => ({
      "Alias ID": a.id,
      "SimpleLogin ID": a.remoteAliasId ?? "N/A",
      "Alias Email": a.email,
      Prefix: a.prefix,
      Domain: `@${a.domain}`,
      "Forwarding Target (Primary Email)": a.primaryEmail,
      "Mailbox ID": a.mailboxId ?? "",
      "Creation Status": a.creationStatus.toUpperCase(),
      Enabled: a.enabled ? "Yes" : "No",
      "Forwarding Route": `${a.email} -> ${a.primaryEmail} (${a.forwardingStatus})`,
      "Display Name": a.displayName || "",
      Note: a.note || "",
      Forwarded: a.nbForward,
      Replies: a.nbReply,
      Blocked: a.nbBlock,
      "Batch ID": a.batchId || "Manual / Synced",
      "Provider Mode": a.providerMode.toUpperCase(),
      "Created At (UTC)": a.createdAt,
    }));

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === "xlsx" || format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet["!cols"] = [
        { wch: 10 }, // Alias ID
        { wch: 16 }, // SimpleLogin ID
        { wch: 38 }, // Alias Email
        { wch: 24 }, // Prefix
        { wch: 18 }, // Domain
        { wch: 32 }, // Forwarding Target
        { wch: 12 }, // Mailbox ID
        { wch: 16 }, // Creation Status
        { wch: 10 }, // Enabled
        { wch: 52 }, // Forwarding Route
        { wch: 22 }, // Display Name
        { wch: 38 }, // Note
        { wch: 12 }, // Forwarded
        { wch: 10 }, // Replies
        { wch: 10 }, // Blocked
        { wch: 24 }, // Batch ID
        { wch: 14 }, // Provider Mode
        { wch: 24 }, // Created At
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Email Aliases");

      const excelBuffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }) as Buffer;

      return new NextResponse(new Uint8Array(excelBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="email-aliases-${timestamp}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    // Default to RFC-4180 CSV with UTF-8 BOM for Excel compatibility
    const headers =
      exportRows.length > 0
        ? Object.keys(exportRows[0])
        : [
            "Alias ID",
            "SimpleLogin ID",
            "Alias Email",
            "Prefix",
            "Domain",
            "Forwarding Target (Primary Email)",
            "Mailbox ID",
            "Creation Status",
            "Enabled",
            "Forwarding Route",
            "Display Name",
            "Note",
            "Forwarded",
            "Replies",
            "Blocked",
            "Batch ID",
            "Provider Mode",
            "Created At (UTC)",
          ];

    const csvLines = [
      headers.map(escapeCsvCell).join(","),
      ...exportRows.map((row) =>
        headers
          .map((h) => escapeCsvCell((row as Record<string, unknown>)[h]))
          .join(",")
      ),
    ];

    const csvContent = "\uFEFF" + csvLines.join("\r\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="email-aliases-${timestamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to export aliases",
      },
      { status: 500 }
    );
  }
}
