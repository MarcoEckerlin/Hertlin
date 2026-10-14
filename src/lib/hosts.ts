/**
 * Auflösung von Hostnamen auf Hauptseite bzw. Kundenportal.
 * Reine Funktionen ohne Abhängigkeiten, damit sie im Proxy und im Servercode
 * gleichermaßen genutzt werden können.
 *
 * Beispiele (ROOT_DOMAIN = "hertlin.de"):
 *   hertlin.de          -> { kind: "main" }
 *   www.hertlin.de      -> { kind: "main" }
 *   muster.hertlin.de   -> { kind: "portal", slug: "muster" }
 *   a.b.hertlin.de      -> { kind: "invalid" }
 */

/** Subdomains, die nie an Kunden vergeben werden dürfen. */
export const RESERVED_SLUGS = new Set([
  "www", "admin", "api", "app", "portal", "kunden", "kundenportal", "support", "hilfe",
  "mail", "smtp", "imap", "pop", "webmail", "autodiscover", "autoconfig", "ftp", "sftp",
  "vpn", "remote", "status", "dev", "test", "staging", "intern", "static", "assets", "cdn",
  "ns1", "ns2", "dns", "login", "auth", "hertlin", "office", "cloud", "backup", "files",
]);

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

export type HostInfo =
  | { kind: "main" }
  | { kind: "portal"; slug: string }
  | { kind: "invalid" };

export function normalizeHost(host: string | null | undefined): string {
  return (host ?? "").trim().toLowerCase().replace(/\.$/, "");
}

export function rootDomain(): string {
  return normalizeHost(process.env.ROOT_DOMAIN || "localhost:3000");
}

export function appProtocol(): "http" | "https" {
  return process.env.APP_PROTOCOL === "http" ? "http" : "https";
}

export function parseHost(rawHost: string | null | undefined, root: string = rootDomain()): HostInfo {
  const host = normalizeHost(rawHost);
  if (!host || host === root || host === `www.${root}`) return { kind: "main" };

  const suffix = `.${root}`;
  if (host.endsWith(suffix)) {
    const sub = host.slice(0, -suffix.length);
    if (sub.includes(".")) return { kind: "invalid" };
    if (sub === "www") return { kind: "main" };
    if (!SLUG_PATTERN.test(sub) || RESERVED_SLUGS.has(sub)) return { kind: "invalid" };
    return { kind: "portal", slug: sub };
  }

  // Unbekannte Hosts (z. B. IP-Adresse, interner Name) zeigen die Hauptseite.
  return { kind: "main" };
}

export function isValidSlug(slug: string): boolean {
  return SLUG_PATTERN.test(slug) && !RESERVED_SLUGS.has(slug);
}

/** Absolute URL auf der Hauptdomain, z. B. für E-Mails. */
export function mainUrl(path = "/"): string {
  return `${appProtocol()}://${rootDomain()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Absolute URL im Kundenportal eines Firmenkunden. */
export function portalUrl(slug: string, path = "/"): string {
  return `${appProtocol()}://${slug}.${rootDomain()}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Anzeigeform der Portal-Adresse ohne Protokoll, z. B. "muster.hertlin.de". */
export function portalHost(slug: string): string {
  return `${slug}.${rootDomain()}`;
}
