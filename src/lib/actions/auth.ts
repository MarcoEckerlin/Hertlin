"use server";

import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import {
  createSession,
  destroyAllSessions,
  destroySession,
  getPortalCompany,
  getPortalSlugFromHost,
  isMainHost,
} from "@/lib/auth";
import { consumeAuthToken, createAuthToken, findValidAuthToken, portalSlugOfCompany } from "@/lib/auth-tokens";
import { clientIp, rateLimit, rateLimitReached, resetRateLimit } from "@/lib/rate-limit";
import { errorState, fromZodError, successState, type FormState } from "@/lib/forms";
import { email as emailSchema, password as passwordSchema } from "@/lib/validation";
import { mainUrl, portalUrl, safeLocalPath } from "@/lib/hosts";
import { sendPasswordResetMail } from "@/lib/notifications";
import { getSiteSettings } from "@/lib/settings";

type Area = { kind: "staff" } | { kind: "portal"; slug: string; companyId: string };

/** Bereich anhand des Hosts: Hauptdomain = Verwaltung, Subdomain = Kundenportal. */
async function currentArea(): Promise<Area | null> {
  if (await isMainHost()) return { kind: "staff" };
  const slug = await getPortalSlugFromHost();
  if (!slug) return null;
  const company = await getPortalCompany(slug);
  return company ? { kind: "portal", slug, companyId: company.id } : null;
}

/** Kundenportal zur Subdomain gibt es nicht (mehr) oder es ist deaktiviert. */
async function portalUnavailable(): Promise<FormState> {
  const site = await getSiteSettings();
  return errorState(
    `Dieses Kundenportal ist gerade nicht erreichbar. Bitte prüfen Sie die Adresse oder rufen Sie uns an: ${site.phone}.`,
  );
}

/** Darf sich dieser Benutzer in diesem Bereich anmelden? */
function userBelongsToArea(
  user: { role: string; company: { id: string; parentId: string | null } | null },
  area: Area,
): boolean {
  if (area.kind === "staff") return user.role === "ADMIN" || user.role === "TECHNICIAN";
  if (user.role !== "CUSTOMER_ADMIN" && user.role !== "CUSTOMER_USER") return false;
  if (!user.company) return false;
  return (user.company.parentId ?? user.company.id) === area.companyId;
}

let dummyHash: Promise<string> | null = null;
/** Vergleichs-Hash für unbekannte Konten, damit die Antwortzeit nichts verrät. */
function getDummyHash(): Promise<string> {
  return (dummyHash ??= hashPassword("kein-echtes-passwort"));
}

/** Ziel nach der Anmeldung: nur Pfade auf diesem Host (siehe safeLocalPath). */
function safeNext(next: unknown, fallback: string): string {
  return safeLocalPath(next, fallback);
}

const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Bitte Passwort eingeben.").max(200),
});

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const area = await currentArea();
  if (!area) return portalUnavailable();

  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  if (!parsed.success) return fromZodError(parsed.error, formData);
  const { email, password } = parsed.data;

  const ip = await clientIp();
  const key = `login:${ip}:${email}`;
  const limit = rateLimit(key, 8, 15 * 60 * 1000);
  // Fehlversuche je Adresse über alle Konten. Nur Fehlversuche zählen: Hinter einem NAT (oder ohne
  // Proxy-Header, dann ist die Adresse für alle "unknown") melden sich viele Personen korrekt an.
  const ipKey = `login-ip:${ip}`;
  // Fehlversuche je Konto über alle Adressen, falls die IP nicht verlässlich ist (z. B. falsch eingerichteter Proxy)
  const accountKey = `login-account:${email}`;
  if (!limit.ok || rateLimitReached(ipKey, 40) || rateLimitReached(accountKey, 20)) {
    return errorState("Zu viele Anmeldeversuche. Bitte warten Sie 15 Minuten und versuchen Sie es dann erneut.", formData);
  }

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      role: true,
      active: true,
      passwordHash: true,
      company: { select: { id: true, parentId: true, active: true, parent: { select: { active: true } } } },
    },
  });

  // Passwort immer prüfen, damit die Antwortzeit nichts über das Konto verrät
  const passwordOk = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));
  const companyActive = !user?.company || (user.company.active && (user.company.parent?.active ?? true));

  if (!user || !passwordOk || !user.active || !companyActive || !userBelongsToArea(user, area)) {
    rateLimit(accountKey, 20, 15 * 60 * 1000);
    rateLimit(ipKey, 40, 15 * 60 * 1000);
    return errorState("E-Mail-Adresse oder Passwort stimmen nicht.", formData);
  }

  resetRateLimit(key);
  resetRateLimit(accountKey);
  await createSession(user.id);
  redirect(safeNext(formData.get("next"), area.kind === "staff" ? "/admin" : "/"));
}

export async function logoutAction(): Promise<void> {
  const staff = await isMainHost();
  await destroySession();
  redirect(staff ? "/admin/login" : "/login");
}

const resetRequestSchema = z.object({ email: emailSchema });

export async function requestPasswordResetAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const area = await currentArea();
  if (!area) return portalUnavailable();

  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const ip = await clientIp();
  const limit = rateLimit(`reset:${ip}`, 5, 60 * 60 * 1000);
  if (!limit.ok) {
    const minutes = Math.max(1, Math.ceil(limit.retryAfterMs / 60_000));
    return errorState(
      `Zu viele Versuche. Bitte warten Sie ${minutes === 1 ? "eine Minute" : `${minutes} Minuten`} und versuchen Sie es dann noch einmal.`,
      formData,
    );
  }

  const user = await db.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      company: { select: { id: true, parentId: true, active: true, parent: { select: { active: true } } } },
    },
  });
  // Wie bei der Anmeldung: Bei deaktivierter Firma oder Unterkunde gibt es keinen Link. Er wäre ohnehin ungültig
  // (findValidAuthToken) und würde nach dem Reaktivieren innerhalb der Stunde wieder funktionieren.
  const companyActive = !user?.company || (user.company.active && (user.company.parent?.active ?? true));

  // Je Konto nur wenige Links pro Stunde, auch wenn die Anfragen von wechselnden Adressen kommen
  if (
    user &&
    user.active &&
    companyActive &&
    userBelongsToArea(user, area) &&
    rateLimit(`reset-account:${user.id}`, 5, 60 * 60 * 1000).ok
  ) {
    const { id, name, email } = user;
    // Erst nach der Antwort: Sonst verrät die längere Antwortzeit, dass es das Konto gibt
    after(async () => {
      try {
        const token = await createAuthToken(id, "RESET");
        const link = area.kind === "staff" ? mainUrl(`/admin/passwort/${token}`) : portalUrl(area.slug, `/passwort/${token}`);
        await sendPasswordResetMail({ to: email, name, link });
      } catch (error) {
        console.error("[auth] Link zum Zurücksetzen konnte nicht verschickt werden:", error instanceof Error ? error.message : error);
      }
    });
  }

  // Immer dieselbe Antwort, damit nicht erkennbar ist, ob es das Konto gibt
  return successState(
    "Falls zu dieser Adresse ein Zugang besteht, haben wir Ihnen gerade eine E-Mail mit einem Link geschickt. Der Link ist eine Stunde gültig.",
  );
}

const setPasswordSchema = z
  .object({
    token: z.string().min(10).max(200),
    password: passwordSchema,
    passwordConfirm: z.string(),
  })
  .refine((d) => d.password === d.passwordConfirm, {
    path: ["passwordConfirm"],
    message: "Die beiden Passwörter stimmen nicht überein.",
  });

export async function setPasswordAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const area = await currentArea();
  if (!area) return portalUnavailable();

  const parsed = setPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) return fromZodError(parsed.error);

  const record = await findValidAuthToken(parsed.data.token);
  if (!record) return errorState("Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordern Sie einen neuen an.");

  const user = record.user;
  const belongs =
    area.kind === "staff"
      ? user.role === "ADMIN" || user.role === "TECHNICIAN"
      : portalSlugOfCompany(user.company) === area.slug;
  if (!belongs) {
    return errorState(
      "Dieser Link gehört zu einem anderen Zugang. Bitte öffnen Sie ihn direkt aus Ihrer E-Mail oder fordern Sie einen neuen an.",
    );
  }

  if (!(await consumeAuthToken(record.id))) {
    return errorState("Der Link wurde bereits verwendet. Bitte fordern Sie einen neuen an.");
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    // Andere offene Einladungs- und Passwortlinks verfallen, sonst ließe sich das Passwort darüber erneut setzen
    db.authToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  await destroyAllSessions(user.id);
  await createSession(user.id);
  redirect(area.kind === "staff" ? "/admin" : "/");
}

const portalFinderSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Bitte das Kürzel Ihres Portals eingeben.")
    .max(60)
    .transform((v) => v.replace(/^https?:\/\//, "").split(".")[0] ?? ""),
});

/** Hauptdomain /login: leitet Firmenkunden zur Anmeldeseite ihres Portals. */
export async function findPortalAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = portalFinderSchema.safeParse({ slug: formData.get("slug") });
  if (!parsed.success) return fromZodError(parsed.error, formData);

  const ip = await clientIp();
  if (!rateLimit(`finder:${ip}`, 30, 15 * 60 * 1000).ok) {
    return errorState("Zu viele Versuche. Bitte warten Sie einige Minuten.", formData);
  }

  const company = await getPortalCompany(parsed.data.slug);
  if (!company) {
    // Deaktivierter Firmenkunde: nicht „unbekanntes Kürzel“ melden, sonst sucht der Kunde einen Tippfehler
    const suspended = await db.company.count({ where: { slug: parsed.data.slug, parentId: null, active: false } });
    if (suspended > 0) {
      const site = await getSiteSettings();
      return errorState(`Dieses Kundenportal ist derzeit gesperrt. Bei Fragen rufen Sie uns bitte an: ${site.phone}.`, formData);
    }
    return errorState(
      "Zu diesem Kürzel haben wir kein Kundenportal gefunden. Das Kürzel steht in Ihrer Einladungs-E-Mail, z. B. „firma“ in firma.hertlin.de.",
      formData,
      { slug: "Unbekanntes Kürzel" },
    );
  }
  redirect(portalUrl(company.slug, "/login"));
}
