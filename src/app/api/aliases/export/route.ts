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
    const format = (searchParams.get("format") || "xlsx").toLowerCase();
    const idsParam = (searchParams.get("ids") || "").trim();
    const status = (searchParams.get("status") || "all").trim();

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (idsParam) {
      const ids = idsParam
        .split(",")
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n) && n > 0);
      if (ids.length > 0) {
        params.push(...ids);
        conditions.push(
          `id IN (${ids.map((_, idx) => `$${idx + 1}`).join(", ")})`
        );
      }
    } else if (status === "unused") {
      conditions.push(`(is_used = FALSE AND enabled = TRUE)`);
    } else if (status === "used") {
      conditions.push(`(is_used = TRUE)`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const res = await dbQuery<Record<string, unknown>>(
      `SELECT * FROM aliases ${whereClause} ORDER BY is_used ASC, pinned DESC, id ASC`,
      params
    );

    const aliases = res.rows.map(mapAliasRow);

    const exportRows = aliases.map((a, idx) => ({
      "#": idx + 1,
      "الإيميل (Alias Email)": a.email,
      "كلمة المرور (Password)": a.displayName || "SmsmRaw@2026#",
      "حالة الاستخدام (Status)": a.isUsed
        ? "تم استخدامه (Used)"
        : "جديد متاح (Unused)",
      "إيميل استقبال الـ OTP (OTP Receiver)": a.primaryEmail,
      "التصنيف / ملاحظة (Tag / Note)": a.note || "",
      "النطاق (Domain)": `@${a.domain}`,
      "تاريخ الإنشاء (Created At)": new Date(a.createdAt).toLocaleString("en-GB"),
    }));

    const timestamp = new Date().toISOString().slice(0, 10);

    if (format === "xlsx" || format === "excel") {
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      worksheet["!cols"] = [
        { wch: 6 },  // #
        { wch: 38 }, // الإيميل
        { wch: 22 }, // كلمة المرور
        { wch: 22 }, // حالة الاستخدام
        { wch: 34 }, // إيميل استقبال الـ OTP
        { wch: 28 }, // التصنيف / ملاحظة
        { wch: 16 }, // النطاق
        { wch: 22 }, // تاريخ الإنشاء
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Smsmraw Accounts");

      const excelBuffer = XLSX.write(workbook, {
        type: "buffer",
        bookType: "xlsx",
      }) as Buffer;

      return new NextResponse(new Uint8Array(excelBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="smsmraw-accounts-${timestamp}.xlsx"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const headers =
      exportRows.length > 0
        ? Object.keys(exportRows[0])
        : [
            "#",
            "الإيميل (Alias Email)",
            "كلمة المرور (Password)",
            "حالة الاستخدام (Status)",
            "إيميل استقبال الـ OTP (OTP Receiver)",
            "التصنيف / ملاحظة (Tag / Note)",
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
        "Content-Disposition": `attachment; filename="smsmraw-accounts-${timestamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to export aliases",
      },
      { status: 500 }
    );
  }
}
