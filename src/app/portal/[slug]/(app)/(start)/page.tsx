import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, ClipboardList, Wrench } from "lucide-react";
import { db } from "@/lib/db";
import { requirePortalContext } from "@/lib/auth";
import { customerTicketSelect, portalTicketWhere } from "@/lib/permissions";
import { OPEN_STATUSES, TYPE_HINTS } from "@/lib/constants";
import { getSiteSettings } from "@/lib/settings";
import { cn } from "@/lib/cn";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ContactBox } from "@/components/portal/contact-box";
import { portalContact } from "@/components/portal/portal-data";
import { RecentTickets } from "@/components/portal/ticket-list";

export const metadata: Metadata = { title: "Übersicht" };

const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * DAY);
}

/** Begrüßung nach Tageszeit in deutscher Zeit. */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("de-DE", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Berlin" }).format(new Date()),
  );
  if (hour >= 5 && hour < 11) return "Guten Morgen";
  if (hour >= 18 || hour < 5) return "Guten Abend";
  return "Guten Tag";
}

export default async function PortalDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requirePortalContext();
  const { hinweis } = await searchParams;
  const scope = portalTicketWhere(ctx);
  const since = daysAgo(30);

  const [site, contact, openCount, waitingCount, resolvedCount, recent] = await Promise.all([
    getSiteSettings(),
    portalContact({ companyId: ctx.company.id }),
    db.ticket.count({ where: { AND: [scope, { status: { in: [...OPEN_STATUSES] } }] } }),
    db.ticket.count({ where: { AND: [scope, { status: "WAITING_CUSTOMER" }] } }),
    db.ticket.count({
      where: {
        AND: [
          scope,
          { status: { in: ["RESOLVED", "CLOSED"] } },
          { OR: [{ resolvedAt: { gte: since } }, { closedAt: { gte: since } }] },
        ],
      },
    }),
    db.ticket.findMany({
      where: scope,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 6,
      select: customerTicketSelect,
    }),
  ]);

  const isSubCustomer = ctx.company.parentId !== null;
  const multipleCompanies = ctx.scopeCompanyIds.length > 1;

  const waitingNote =
    waitingCount === 0
      ? "Gerade wartet keine Rückfrage."
      : ctx.isAdmin
        ? "Wir warten auf eine Antwort von Ihnen oder Ihrem Team."
        : "Wir brauchen Ihre Antwort, um weiterzumachen.";

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${ctx.user.name}`}
        description={
          isSubCustomer ? (
            <>
              {ctx.company.name} <span className="text-ink-muted">· Unterkunde von {ctx.root.name}</span>
            </>
          ) : (
            ctx.company.name
          )
        }
        actions={<ButtonLink href="/tickets/neu">Neues Ticket</ButtonLink>}
      />

      {hinweis === "kein-zugriff" ? (
        <Alert tone="warning" className="mb-6">
          Für diese Seite fehlen Ihrem Zugang die Rechte. Wenn Sie sie brauchen, wenden Sie sich bitte an Ihren
          Hauptansprechpartner.
        </Alert>
      ) : null}

      {/* Kennzahlen: auf dem Handy drei kleine Kacheln nebeneinander */}
      <section aria-label="Ihre Tickets in Zahlen" className="grid grid-cols-3 gap-2 sm:gap-4">
        <StatCard href="/tickets" label="Offene Tickets" value={openCount} note="neu, in Bearbeitung oder mit Rückfrage" />
        <StatCard
          href="/tickets?status=wartet"
          label={ctx.isAdmin ? "Rückfrage offen" : "Rückfrage an Sie"}
          value={waitingCount}
          note={waitingNote}
          highlight={waitingCount > 0}
        />
        <StatCard href="/tickets?status=erledigt" label="Erledigt" value={resolvedCount} note="in den letzten 30 Tagen" />
      </section>

      {/* Schnellaktionen */}
      <section aria-label="Schnell melden" className="mt-2 grid grid-cols-2 gap-2 sm:mt-4 sm:gap-4">
        <QuickAction
          href="/tickets/neu?art=stoerung"
          title="Störung melden"
          text={TYPE_HINTS.STOERUNG}
          icon={<Wrench className="size-5" aria-hidden />}
        />
        <QuickAction
          href="/tickets/neu?art=anfrage"
          title="Anfrage stellen"
          text={TYPE_HINTS.ANFRAGE}
          icon={<ClipboardList className="size-5" aria-hidden />}
        />
      </section>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 sm:mt-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardHeader
              title="Zuletzt aktualisiert"
              description={
                ctx.isAdmin
                  ? multipleCompanies
                    ? `${ctx.root.name} und Unterkunden`
                    : `Alle Tickets von ${ctx.company.name}`
                  : "Ihre eigenen Tickets"
              }
              actions={
                recent.length > 0 ? (
                  <Link href="/tickets?status=alle" className="text-sm font-semibold text-brand-700 hover:underline">
                    Alle Tickets
                  </Link>
                ) : undefined
              }
            />
            {recent.length > 0 ? (
              <RecentTickets tickets={recent} showCompany={multipleCompanies} />
            ) : (
              <div className="px-5 py-10 text-center sm:px-6">
                <p className="font-semibold text-ink">Noch keine Tickets</p>
                <p className="mx-auto mt-1.5 max-w-sm text-sm text-ink-soft">
                  Hier sehen Sie später den Stand Ihrer Störungen und Anfragen und unsere Antworten.
                </p>
                <div className="mt-5">
                  <ButtonLink href="/tickets/neu" variant="secondary" size="sm">
                    Erstes Ticket anlegen
                  </ButtonLink>
                </div>
              </div>
            )}
          </Card>

          {ctx.isAdmin ? <AdminHint isRootAdmin={ctx.isRootAdmin} /> : null}
        </div>

        <ContactBox site={site} contact={contact} />
      </div>
    </>
  );
}

function StatCard({
  href,
  label,
  value,
  note,
  highlight = false,
}: {
  href: string;
  label: string;
  value: number;
  note: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex min-w-0 flex-col rounded-2xl border p-3 shadow-card transition-colors sm:p-5",
        highlight
          ? "border-caution-line bg-caution-soft hover:border-caution-solid"
          : "border-line bg-surface hover:border-brand-300 hover:bg-brand-50/40",
      )}
    >
      <span className={cn("text-xs leading-snug font-semibold sm:text-sm", highlight ? "text-caution-ink" : "text-ink-soft")}>
        {label}
      </span>
      <span
        className={cn(
          "mt-0.5 text-2xl font-bold tracking-tight tabular-nums sm:mt-1 sm:text-3xl",
          highlight ? "text-caution-ink" : "text-ink",
        )}
      >
        {value}
      </span>
      {/* Erklärung nur auf größeren Bildschirmen; auf dem Handy reichen Titel und Zahl */}
      <span className={cn("mt-1 hidden text-sm sm:block", highlight ? "text-caution-ink" : "text-ink-muted")}>{note}</span>
      {highlight ? (
        <span className="mt-auto hidden items-center gap-1 pt-3 text-sm font-semibold text-caution-ink group-hover:underline sm:inline-flex">
          Jetzt antworten
          <ArrowRight className="size-3.5" aria-hidden />
        </span>
      ) : null}
    </Link>
  );
}

function QuickAction({ href, title, text, icon }: { href: string; title: string; text: string; icon: ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-card transition-colors hover:border-brand-300 hover:bg-brand-50/40 sm:items-start sm:gap-4 sm:p-5"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-800 sm:size-11">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-sm leading-tight font-bold text-ink sm:text-base">
          {title}
          <ArrowRight
            className="hidden size-4 text-ink-muted transition-transform group-hover:translate-x-0.5 sm:block"
            aria-hidden
          />
        </span>
        <span className="mt-1 hidden text-sm leading-relaxed text-ink-soft sm:block">{text}</span>
      </span>
    </Link>
  );
}

function AdminHint({ isRootAdmin }: { isRootAdmin: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-2xl border border-dashed border-line-strong px-5 py-3.5 text-sm sm:px-6">
      <p className="text-ink-soft">
        <span className="font-semibold text-ink">Zugänge für Ihr Team</span>
        {isRootAdmin ? " – Filialen und Standorte bekommen eigene Unterkunden." : " legen Sie unter „Benutzer“ an."}
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 font-semibold">
        <Link href="/benutzer" className="text-brand-700 hover:underline">
          Benutzer verwalten
        </Link>
        {isRootAdmin ? (
          <Link href="/unterkunden" className="text-brand-700 hover:underline">
            Unterkunden verwalten
          </Link>
        ) : null}
      </div>
    </div>
  );
}
