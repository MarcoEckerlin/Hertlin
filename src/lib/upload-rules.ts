/** Regeln für Ticket-Anhänge – ohne server-only, damit auch Formulare im Browser sie nutzen können. */
export const MAX_FILES = 5;
export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_TYPES: Record<string, string> = {
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

export const ACCEPT_ATTRIBUTE = Object.keys(ALLOWED_TYPES).join(",");
export const ALLOWED_EXTENSIONS_LABEL = "Bilder, PDF, Text, Office-Dokumente, E-Mails, ZIP";
