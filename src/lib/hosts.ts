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

/**
 * Hostname, den server.ts an Next.js übergibt. Next.js bildet daraus die Basis-URL für den Proxy
 * (http://<hostname>:<port>), schreibt Loopback-Adressen in der URL des Proxys aber zu „localhost“ um.
 * Stünde hier 127.0.0.1, passten Rewrite-Ziel und Basis nicht zusammen: Die Rewrites auf die Kundenportale
 * (/portal/<kuerzel>) würden als externe Rewrites an localhost weitergereicht – und jedes Portal lieferte 404.
 */
export function nextInternalHostname(listenHost: string): string {
  return /^(127(\.\d{1,3}){3}|::1|\[::1\])$/.test(listenHost.trim()) ? "localhost" : listenHost;
}

const LOCAL_BASE = "http://hertlin.invalid";

/**
 * Pfad für Weiterleitungen nach der Anmeldung (?next=…): nur Ziele auf demselben Host.
 * Steuerzeichen, Leerraum und Backslashes lehnen wir ab, weil Browser sie entfernen oder umdeuten
 * („/\t/evil.example“ wird zu „//evil.example“). Zurück kommt der bereinigte Pfad samt Query und Anker.
 */
export function safeLocalPath(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.length > 2000 || !value.startsWith("/")) return fallback;
  if (/[\u0000-\u001F\u007F\\\s]/.test(value)) return fallback;
  let url: URL;
  try {
    url = new URL(value, LOCAL_BASE);
  } catch {
    return fallback;
  }
  if (url.origin !== LOCAL_BASE || url.pathname.startsWith("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** Request-Header, in den der Proxy den angefragten Pfad samt Query schreibt (im Portal ohne /portal/<kuerzel>). */
export const REQUEST_PATH_HEADER = "x-hertlin-path";

/**
 * Ziel für die Weiterleitung zur Anmeldung, mit Rücksprung zur angefragten Seite (z. B. aus einem E-Mail-Link):
 * „/login?next=%2Ftickets%2F7“. Ohne brauchbaren Pfad, für die Startseite des Bereichs (home) und für die
 * Anmeldeseite selbst bleibt es bei loginPath.
 */
export function loginRedirectTarget(loginPath: string, requestedPath: string | null | undefined, home: string): string {
  const next = safeLocalPath(requestedPath, "");
  if (!next || next === home || next === loginPath || next.startsWith(`${loginPath}?`)) return loginPath;
  return `${loginPath}?next=${encodeURIComponent(next)}`;
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
