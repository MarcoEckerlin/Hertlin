import { readFile } from "node:fs/promises";
import path from "node:path";

/** Ohne SMTP schreibt die App Mails nach storage/mails.log – Tests lesen daraus Links. */
export async function lastMailTo(to: string): Promise<{ subject: string; body: string } | null> {
  const log = await readFile(path.join(process.cwd(), "storage", "mails.log"), "utf8").catch(() => "");
  const entries = log.split(/^=== /m).filter(Boolean);
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    const toLine = entry.match(/^An: (.*)$/m)?.[1] ?? "";
    if (toLine.split(",").map((s) => s.trim()).includes(to)) {
      return { subject: entry.match(/^Betreff: (.*)$/m)?.[1] ?? "", body: entry };
    }
  }
  return null;
}

export function linkIn(body: string, pattern: RegExp): string | null {
  return body.match(pattern)?.[0] ?? null;
}
