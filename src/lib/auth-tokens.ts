import "server-only";
import { db } from "@/lib/db";
import { generateToken, sha256 } from "@/lib/crypto";

export type TokenPurpose = "INVITE" | "RESET";

const TTL: Record<TokenPurpose, number> = {
  INVITE: 7 * 24 * 60 * 60 * 1000,
  RESET: 60 * 60 * 1000,
};

/** Erstellt ein Einmal-Token (Einladung oder Passwort zurücksetzen). Ältere offene Tokens gleichen Zwecks verfallen. */
export async function createAuthToken(userId: string, purpose: TokenPurpose): Promise<string> {
  const token = generateToken(32);
  await db.$transaction([
    db.authToken.updateMany({ where: { userId, purpose, usedAt: null }, data: { usedAt: new Date() } }),
    db.authToken.create({
      data: { tokenHash: sha256(token), userId, purpose, expiresAt: new Date(Date.now() + TTL[purpose]) },
    }),
  ]);
  return token;
}

/** Prüft ein Token, ohne es zu verbrauchen (für die Anzeige des Formulars). */
export async function findValidAuthToken(token: string) {
  if (!token || token.length > 200) return null;
  const record = await db.authToken.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          active: true,
          company: {
            select: { id: true, name: true, slug: true, parentId: true, active: true, parent: { select: { slug: true, active: true } } },
          },
        },
      },
    },
  });
  if (!record || record.usedAt || record.expiresAt.getTime() < Date.now() || !record.user.active) return null;
  // Gesperrte Firmen (oder deren Firmenkunde) können keine Einladungen/Passwort-Links einlösen
  const company = record.user.company;
  if (company && (!company.active || company.parent?.active === false)) return null;
  return record;
}

/** Markiert ein Token als verbraucht. Gibt false zurück, wenn es bereits verwendet wurde. */
export async function consumeAuthToken(id: string): Promise<boolean> {
  const result = await db.authToken.updateMany({ where: { id, usedAt: null }, data: { usedAt: new Date() } });
  return result.count === 1;
}

/** Subdomain, unter der sich ein Kundenbenutzer anmeldet (Unterkunden nutzen das Portal ihres Firmenkunden). */
export function portalSlugOfCompany(company: { slug: string | null; parent?: { slug: string | null } | null } | null) {
  if (!company) return null;
  return company.parent?.slug ?? company.slug ?? null;
}
