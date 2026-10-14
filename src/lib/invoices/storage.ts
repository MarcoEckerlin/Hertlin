import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/uploads";

/**
 * Rechnungs-PDFs liegen außerhalb von public/ unter UPLOAD_DIR/invoices/<jahr>/<nummer>.pdf
 * und werden nur nach Rechteprüfung ausgeliefert (Verwaltung bzw. Kundenportal).
 */

/** Relativer Pfad, wie er in Invoice.pdfPath steht, z. B. „invoices/2026/RE-2026-0001.pdf“ */
export function invoicePdfPath(year: number, number: string): string {
  const safe = number.replace(/[^A-Za-z0-9-]/g, "_");
  return `invoices/${year}/${safe}.pdf`;
}

/** Absoluter Pfad; nur innerhalb von UPLOAD_DIR/invoices. */
function absolutePath(relative: string): string {
  const root = path.resolve(/*turbopackIgnore: true*/ UPLOAD_DIR, "invoices");
  const full = path.resolve(/*turbopackIgnore: true*/ UPLOAD_DIR, relative);
  if (!full.startsWith(root + path.sep)) throw new Error(`Ungültiger PDF-Pfad: ${relative}`);
  return full;
}

export async function writeInvoicePdf(relative: string, pdf: Buffer): Promise<void> {
  const full = absolutePath(relative);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, pdf);
}

/** PDF lesen; null, wenn die Datei fehlt oder der Pfad ungültig ist. */
export async function readInvoicePdf(relative: string | null | undefined): Promise<Buffer | null> {
  if (!relative) return null;
  try {
    return await readFile(absolutePath(relative));
  } catch {
    return null;
  }
}

export async function removeInvoicePdf(relative: string): Promise<void> {
  try {
    await unlink(absolutePath(relative));
  } catch {
    // Datei gab es nicht (mehr)
  }
}

/** Dateiname beim Herunterladen, z. B. „Rechnung-RE-2026-0001.pdf“ */
export function invoiceFileName(number: string, kind: string): string {
  const safe = number.replace(/[^A-Za-z0-9-]/g, "_");
  return `${kind === "CANCELLATION" ? "Stornorechnung" : "Rechnung"}-${safe}.pdf`;
}

/** Antwort mit dem PDF. Rechte vorher prüfen! download = als Datei speichern statt im Browser anzeigen. */
export function invoicePdfResponse(pdf: Buffer, fileName: string, download: boolean): Response {
  const encoded = encodeURIComponent(fileName);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${fileName}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      // Eingebauter PDF-Betrachter des Browsers braucht object-src; Skripte sind nicht nötig
      "Content-Security-Policy": "default-src 'none'; object-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'",
    },
  });
}
