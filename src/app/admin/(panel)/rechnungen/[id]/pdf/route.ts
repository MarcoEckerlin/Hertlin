import type { NextRequest } from "next/server";
import { getStaffUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ensureInvoicePdf } from "@/lib/invoices/service";
import { invoiceFileName, invoicePdfResponse } from "@/lib/invoices/storage";

/**
 * PDF einer Rechnung in der Verwaltung (/admin/rechnungen/<id>/pdf, mit ?download=1 als Datei).
 * Nur für Administratoren – alle anderen bekommen 404, damit die Adresse nichts verrät.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getStaffUser();
  const { id } = await params;
  if (!user || user.role !== "ADMIN" || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return notFound();

  const invoice = await db.invoice.findUnique({ where: { id }, select: { id: true, number: true, kind: true } });
  if (!invoice) return notFound();

  const file = await ensureInvoicePdf(invoice.id);
  if (!file) return notFound();
  return invoicePdfResponse(file.pdf, invoiceFileName(invoice.number, invoice.kind), request.nextUrl.searchParams.has("download"));
}

function notFound(): Response {
  return new Response("Rechnung nicht gefunden.", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}
