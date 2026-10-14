/** Menüeintrag der Website (aus den veröffentlichten Seiten, siehe getNavigation in src/cms/store.ts). */
export type SiteNavLink = { href: string; label: string };

/** Firmendaten, die Header und Footer brauchen (Client-Komponenten bekommen sie als Props). */
export type SiteContact = {
  name: string;
  legalName: string;
  phone: string;
  phoneHref: string;
  email: string;
  street: string;
  zip: string;
  city: string;
  openingHours: { days: string; hours: string }[];
};

/** true, wenn href die aktuelle Seite (oder eine Unterseite davon) ist. */
export function isActivePath(pathname: string, href: string): boolean {
  const path = href.split("#")[0].split("?")[0] || "/";
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** Gültige Anruf-Adresse oder null */
export function telHref(phoneHref: string): string | null {
  const v = phoneHref.replace(/\s+/g, "");
  return /^\+?[0-9][0-9/()-]{2,30}$/.test(v) ? `tel:${v}` : null;
}
