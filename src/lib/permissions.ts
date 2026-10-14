import "server-only";
import type { Prisma } from "@prisma/client";
import type { PortalContext } from "@/lib/auth";

/**
 * Welche Tickets ein Portalbenutzer sehen darf:
 * - Hauptansprechpartner: alle Tickets seiner Firma (beim Firmenkunden inkl. aller Unterkunden)
 * - Mitarbeiter: nur selbst erstellte Tickets
 */
export function portalTicketWhere(ctx: PortalContext): Prisma.TicketWhereInput {
  if (ctx.isAdmin) return { companyId: { in: ctx.scopeCompanyIds } };
  return { companyId: { in: ctx.scopeCompanyIds }, createdById: ctx.user.id };
}

/** Benutzer, die ein Hauptansprechpartner verwalten darf. */
export function portalManageableUserWhere(ctx: PortalContext): Prisma.UserWhereInput {
  if (!ctx.isAdmin) return { id: "__none__" };
  return { companyId: { in: ctx.scopeCompanyIds }, role: { in: ["CUSTOMER_ADMIN", "CUSTOMER_USER"] } };
}

/** Firmen, denen ein Portalbenutzer ein neues Ticket zuordnen darf. */
export function portalAssignableCompanyIds(ctx: PortalContext): string[] {
  return ctx.isRootAdmin ? ctx.scopeCompanyIds : [ctx.company.id];
}

/**
 * Felder eines Tickets, die Kunden sehen dürfen. Kosten, interne Notizen,
 * Bearbeiter-Interna und der Status-Link sind bewusst nicht enthalten.
 */
export const customerTicketSelect = {
  id: true,
  subject: true,
  type: true,
  category: true,
  priority: true,
  status: true,
  companyId: true,
  company: { select: { id: true, name: true, parentId: true } },
  createdById: true,
  createdBy: { select: { id: true, name: true } },
  assignee: { select: { name: true } },
  contactName: true,
  contactEmail: true,
  contactPhone: true,
  createdAt: true,
  updatedAt: true,
  resolvedAt: true,
  closedAt: true,
} satisfies Prisma.TicketSelect;

/** Nachrichten für Kunden: nie interne Notizen. */
export const customerMessagesWhere = { internal: false } satisfies Prisma.TicketMessageWhereInput;

/**
 * Kosten im Ticket: Alle Hertlin-Mitarbeiter erfassen Leistungen und Material (Menge, Einheit, Katalogposition).
 * Preise, Summen, Kostenübersichten und Rechnungen sehen nur Administratoren.
 */
export function canRecordCosts(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "TECHNICIAN";
}

export function canSeeCostAmounts(role: string | null | undefined): boolean {
  return role === "ADMIN";
}
