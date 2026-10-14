import { getPortalContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { portalInvoiceWhere } from "@/lib/invoices/queries";
import { ensureInvoicePdf } from "@/lib/invoices/service";
import { invoiceFileName, invoicePdfResponse } from "@/lib/invoices/storage";

/**
 * Rechnungs-PDF im Kundenportal (<kuerzel>.<hauptdomain>/rechnungen/<id>/pdf).
 * Nur Hauptansprechpartner, nur Rechnungen ihrer Firma (Firmenkunde inkl. Unterkunden), nur versendete oder bezahlte.
 * Für alle anderen sieht es aus, als gäbe es die Rechnung nicht.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;

  const ctx = await getPortalContext();
  if (!ctx) return plain(401, "Bitte melden Sie sich im Kundenportal an, um diese Rechnung zu öffnen.");
  if (ctx.root.slug !== slug || !ctx.isAdmin || !/^[A-Za-z0-9_-]{1,64}$/.test(id)) return notFound();

  const invoice = await db.invoice.findFirst({
    where: { AND: [{ id }, portalInvoiceWhere(ctx.scopeCompanyIds)] },
    select: { id: true, number: true, kind: true },
  });
  if (!invoice) return notFound();

  const file = await ensureInvoicePdf(invoice.id);
  if (!file) return notFound();
  return invoicePdfResponse(file.pdf, invoiceFileName(invoice.number, invoice.kind), true);
}

function plain(status: number, message: string): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
  });
}

function notFound(): Response {
  return plain(404, "Rechnung nicht gefunden.");
}
