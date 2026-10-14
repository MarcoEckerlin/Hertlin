import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { generateToken, sha256 } from "@/lib/crypto";
import { REQUEST_PATH_HEADER, appProtocol, loginRedirectTarget, normalizeHost, parseHost } from "@/lib/hosts";
import type { Role } from "@/lib/constants";
import { SESSION_TTL_MS, sessionCookieName, sessionIsActive } from "@/lib/session-policy";


const sessionUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  position: true,
  role: true,
  active: true,
  language: true,
  companyId: true,
  company: {
    select: {
      id: true,
      name: true,
      slug: true,
      parentId: true,
      active: true,
      parent: { select: { id: true, name: true, slug: true, active: true } },
    },
  },
} satisfies Prisma.UserSelect;

export type SessionUser = Omit<Prisma.UserGetPayload<{ select: typeof sessionUserSelect }>, "role"> & { role: Role };

/** Host der aktuellen Anfrage (berücksichtigt X-Forwarded-Host hinter einem Reverse Proxy). */
export async function getRequestHost(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-host")?.split(",")[0];
  return normalizeHost(forwarded ?? h.get("host"));
}

/** Kürzel des Kundenportals, wenn die Anfrage über eine Kunden-Subdomain kommt. */
export async function getPortalSlugFromHost(): Promise<string | null> {
  const info = parseHost(await getRequestHost());
  return info.kind === "portal" ? info.slug : null;
}

export async function isMainHost(): Promise<boolean> {
  return parseHost(await getRequestHost()).kind === "main";
}

/** Legt eine Sitzung für den aktuellen Host an und setzt das Cookie. Nur in Server Actions/Route Handlern aufrufen. */
export async function createSession(userId: string): Promise<void> {
  const token = generateToken(32);
  const host = await getRequestHost();
  const userAgent = (await headers()).get("user-agent")?.slice(0, 255) ?? null;
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.session.create({ data: { tokenHash: sha256(token), userId, host, expiresAt, userAgent } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });

  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: appProtocol() === "https",
    path: "/",
    expires: expiresAt,
  });
}

/** Beendet die aktuelle Sitzung. Nur in Server Actions/Route Handlern aufrufen. */
export async function destroySession(): Promise<void> {
  const store = await cookies();
  const name = sessionCookieName();
  const token = store.get(name)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  // Mit denselben Attributen überschreiben, sonst verwirft der Browser das Löschen bei __Host-Cookies
  store.set(name, "", { httpOnly: true, sameSite: "lax", secure: appProtocol() === "https", path: "/", maxAge: 0 });
}

/** Beendet alle Sitzungen eines Benutzers, z. B. nach Passwortänderung oder Sperrung. */
export async function destroyAllSessions(userId: string, exceptCurrent = false): Promise<void> {
  let keepHash: string | undefined;
  if (exceptCurrent) {
    const token = (await cookies()).get(sessionCookieName())?.value;
    keepHash = token ? sha256(token) : undefined;
  }
  await db.session.deleteMany({ where: { userId, ...(keepHash ? { NOT: { tokenHash: keepHash } } : {}) } });
}

/**
 * Angemeldeter Benutzer der aktuellen Anfrage oder null.
 * Sitzungen gelten nur auf dem Host, auf dem sie angelegt wurden.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(sessionCookieName())?.value;
  if (!token) return null;

  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    select: { id: true, host: true, expiresAt: true, lastSeenAt: true, user: { select: sessionUserSelect } },
  });
  if (!session || !sessionIsActive(session)) return null;
  if (session.host !== (await getRequestHost())) return null;

  const user = session.user as SessionUser;
  if (!user.active) return null;
  if (user.company && (!user.company.active || (user.company.parent && !user.company.parent.active))) return null;

  if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
    await db.session.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
  }
  return user;
});

export function isStaff(user: Pick<SessionUser, "role"> | null | undefined): boolean {
  return user?.role === "ADMIN" || user?.role === "TECHNICIAN";
}

export function isAdmin(user: Pick<SessionUser, "role"> | null | undefined): boolean {
  return user?.role === "ADMIN";
}

/* ------------------------------------------------------------------ */
/* Hertlin-Mitarbeiter (Hauptdomain, /admin)                           */
/* ------------------------------------------------------------------ */

export async function getStaffUser(): Promise<SessionUser | null> {
  if (!(await isMainHost())) return null;
  const user = await getCurrentUser();
  return isStaff(user) ? user : null;
}

/**
 * Anmeldeseite mit Rücksprung zur gerade angefragten Seite (?next=…), damit Links aus E-Mails nach der
 * Anmeldung im Ticket landen statt auf der Startseite. Den Pfad setzt der Proxy (REQUEST_PATH_HEADER).
 */
async function loginRedirect(loginPath: string, home: string): Promise<never> {
  redirect(loginRedirectTarget(loginPath, (await headers()).get(REQUEST_PATH_HEADER), home));
}

/** Für alle Seiten und Actions unter /admin. Leitet sonst zur Anmeldung. */
export async function requireStaff(): Promise<SessionUser> {
  const user = await getStaffUser();
  if (!user) return loginRedirect("/admin/login", "/admin");
  return user;
}

/** Nur Administratoren (z. B. Kosten, Team). Techniker landen auf dem Dashboard. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireStaff();
  if (user.role !== "ADMIN") redirect("/admin?hinweis=kein-zugriff");
  return user;
}

/* ------------------------------------------------------------------ */
/* Kundenportal (<kuerzel>.<hauptdomain>)                              */
/* ------------------------------------------------------------------ */

export type PortalCompany = { id: string; name: string; slug: string };

/** Firmenkunde zur Subdomain (nur aktive Firmenkunden, keine Unterkunden). */
export const getPortalCompany = cache(async (slug: string): Promise<PortalCompany | null> => {
  const company = await db.company.findFirst({
    where: { slug, parentId: null, active: true },
    select: { id: true, name: true, slug: true },
  });
  return company && company.slug ? { id: company.id, name: company.name, slug: company.slug } : null;
});

export type PortalContext = {
  user: SessionUser;
  /** Firmenkunde, dem die Subdomain gehört */
  root: PortalCompany;
  /** Firma des Benutzers: der Firmenkunde selbst oder einer seiner Unterkunden */
  company: { id: string; name: string; parentId: string | null };
  /** Hauptansprechpartner (Firmenkunde oder Unterkunde) */
  isAdmin: boolean;
  /** Hauptansprechpartner des Firmenkunden: verwaltet auch alle Unterkunden */
  isRootAdmin: boolean;
  /** Firmen, deren Tickets und Benutzer dieser Benutzer sehen darf */
  scopeCompanyIds: string[];
};

export const getPortalContext = cache(async (): Promise<PortalContext | null> => {
  const slug = await getPortalSlugFromHost();
  if (!slug) return null;
  const root = await getPortalCompany(slug);
  if (!root) return null;

  const user = await getCurrentUser();
  if (!user || !user.company) return null;
  if (user.role !== "CUSTOMER_ADMIN" && user.role !== "CUSTOMER_USER") return null;

  const userRootId = user.company.parentId ?? user.company.id;
  if (userRootId !== root.id) return null;

  const isAdmin = user.role === "CUSTOMER_ADMIN";
  const isRootAdmin = isAdmin && user.company.parentId === null;

  let scopeCompanyIds = [user.company.id];
  if (isRootAdmin) {
    const children = await db.company.findMany({ where: { parentId: root.id }, select: { id: true } });
    scopeCompanyIds = [root.id, ...children.map((c) => c.id)];
  }

  return {
    user,
    root,
    company: { id: user.company.id, name: user.company.name, parentId: user.company.parentId },
    isAdmin,
    isRootAdmin,
    scopeCompanyIds,
  };
});

/** Für alle Seiten und Actions im Kundenportal. Leitet sonst zur Portal-Anmeldung. */
export async function requirePortalContext(): Promise<PortalContext> {
  const ctx = await getPortalContext();
  if (!ctx) return loginRedirect("/login", "/");
  return ctx;
}

/** Nur Hauptansprechpartner (Benutzer- und Unterkundenverwaltung). */
export async function requirePortalAdmin(): Promise<PortalContext> {
  const ctx = await requirePortalContext();
  if (!ctx.isAdmin) redirect("/?hinweis=kein-zugriff");
  return ctx;
}

/** Nur Hauptansprechpartner des Firmenkunden (Unterkunden anlegen und bearbeiten). */
export async function requirePortalRootAdmin(): Promise<PortalContext> {
  const ctx = await requirePortalContext();
  if (!ctx.isRootAdmin) redirect("/?hinweis=kein-zugriff");
  return ctx;
}
