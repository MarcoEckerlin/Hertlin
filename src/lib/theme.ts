/**
 * Hell/Dunkel. Die Wahl liegt im Cookie hertlin_theme ("light" | "dark"); ohne Cookie gilt die Systemeinstellung.
 * Das Root-Layout setzt daraus <html data-theme>, damit die Seite gleich in der richtigen Farbe ankommt.
 * Gilt für Website, Kundenportale und Verwaltung – mit Domain-Cookie auch über alle Subdomains hinweg.
 */
export const THEME_COOKIE = "hertlin_theme";

export const THEME_CHOICES = ["system", "light", "dark"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export function parseThemeChoice(value: string | null | undefined): ThemeChoice {
  return value === "light" || value === "dark" ? value : "system";
}

/**
 * Domain für das Cookie, damit die Wahl auf der Hauptdomain und allen Kundenportalen gilt.
 * Nur, wenn der aufgerufene Host die Hauptdomain oder eine Subdomain davon ist – nicht bei localhost und IP-Adressen
 * (dort bleibt das Cookie am jeweiligen Host).
 */
export function themeCookieDomain(rootDomain: string, requestHost: string | null | undefined): string | null {
  const root = rootDomain.toLowerCase().replace(/:\d+$/, "");
  const host = (requestHost ?? "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!root || !host) return null;
  if (root === "localhost" || root.endsWith(".localhost")) return null;
  if (/^[\d.]+$/.test(root) || root.includes(":") || root.startsWith("[")) return null;
  if (host !== root && !host.endsWith(`.${root}`)) return null;
  return root;
}
