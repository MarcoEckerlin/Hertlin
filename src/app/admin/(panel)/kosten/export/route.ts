import type { NextRequest } from "next/server";
import { getStaffUser } from "@/lib/auth";
import { buildCostCsv, parseCostAccount, parseCostFilter, periodFileSlug, resolveCostAccount } from "@/lib/costs";

/**
 * CSV-Export der Kostenpositionen (gleiche Filter wie die Übersicht, optional ein Konto).
 * Nur für Administratoren – alle anderen bekommen 404, damit die Adresse nichts verrät.
 */
export async function GET(request: NextRequest) {
  const user = await getStaffUser();
  if (!user || user.role !== "ADMIN") return new Response("Nicht gefunden", { status: 404 });

  const params = request.nextUrl.searchParams;
  const filter = parseCostFilter(Object.fromEntries(params.entries()));
  const get = (key: string) => params.get(key) ?? "";

  const wantsAccount = Boolean(get("konto") || get("email") || get("ticket"));
  const account = wantsAccount ? parseCostAccount(get) : null;
  const resolved = account ? await resolveCostAccount(account) : null;
  if (wantsAccount && !resolved) return new Response("Nicht gefunden", { status: 404 });

  const csv = await buildCostCsv(filter, resolved);
  const fileName = `kosten-${resolved ? `${resolved.fileSlug}-` : ""}${periodFileSlug(filter.period)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex",
    },
  });
}
