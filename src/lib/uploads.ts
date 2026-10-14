import "server-only";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";

/** Ticket-Anhänge werden außerhalb von public/ gespeichert und nur nach Rechteprüfung ausgeliefert. */
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "storage", "uploads");
export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".heic": "image/heic",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".log": "text/plain",
  ".csv": "text/csv",
  ".eml": "message/rfc822",
  ".msg": "application/vnd.ms-outlook",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".zip": "application/zip",
};

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED).join(",");
export const ALLOWED_EXTENSIONS_LABEL = "Bilder, PDF, Text, Office-Dokumente, E-Mails, ZIP";

export type StoredFile = { fileName: string; storedName: string; mimeType: string; size: number };

/** Liest Dateien aus einem FormData-Feld (leere Datei-Inputs werden ignoriert). */
export function filesFromFormData(formData: FormData, field = "attachments"): File[] {
  return formData.getAll(field).filter((f): f is File => typeof f === "object" && f !== null && "size" in f && f.size > 0);
}

/** Gibt eine Fehlermeldung zurück oder null, wenn alles passt. */
export function validateFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Bitte höchstens ${MAX_FILES} Dateien anhängen.`;
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    if (!ALLOWED[ext]) return `Der Dateityp von „${file.name}“ wird nicht unterstützt (erlaubt: ${ALLOWED_EXTENSIONS_LABEL}).`;
    if (file.size > MAX_FILE_SIZE) return `„${file.name}“ ist größer als 10 MB.`;
  }
  return null;
}

function safeFileName(name: string): string {
  const base = path.basename(name).replace(/[\u0000-\u001f"\\/<>:|?*]+/g, "_").trim();
  return base.slice(0, 180) || "datei";
}

export async function storeFiles(files: File[]): Promise<StoredFile[]> {
  if (files.length === 0) return [];
  await mkdir(UPLOAD_DIR, { recursive: true });
  const stored: StoredFile[] = [];
  for (const file of files) {
    const ext = path.extname(file.name).toLowerCase();
    const storedName = `${randomBytes(16).toString("hex")}${ext}`;
    await writeFile(path.join(UPLOAD_DIR, storedName), Buffer.from(await file.arrayBuffer()));
    stored.push({ fileName: safeFileName(file.name), storedName, mimeType: ALLOWED[ext], size: file.size });
  }
  return stored;
}

export async function removeStoredFiles(storedNames: string[]): Promise<void> {
  await Promise.all(storedNames.map((n) => unlink(path.join(UPLOAD_DIR, path.basename(n))).catch(() => undefined)));
}

/** Antwort zum Herunterladen eines Anhangs. Rechte vorher prüfen! */
export async function attachmentResponse(att: { fileName: string; storedName: string; mimeType: string }): Promise<Response> {
  let data: Buffer;
  try {
    data = await readFile(path.join(UPLOAD_DIR, path.basename(att.storedName)));
  } catch {
    return new Response("Datei nicht gefunden", { status: 404 });
  }
  const inline = att.mimeType.startsWith("image/") && att.mimeType !== "image/svg+xml";
  const encoded = encodeURIComponent(att.fileName);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": att.mimeType,
      "Content-Length": String(data.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${encoded}"; filename*=UTF-8''${encoded}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
