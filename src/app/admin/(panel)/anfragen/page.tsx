import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Alert } from "@/components/ui/alert";
import { Badge, InquiryStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { FilterPill, SearchForm, firstParam } from "@/components/admin/companies/list-tools";
import { requireStaff } from "@/lib/auth";
import { INQUIRY_TOPIC_LABELS, labelOf, type InquiryStatus } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, formatInquiryNumber, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Anfragen" };

const PAGE_SIZE = 30;

const STATUS_FILTERS = [
  { key: "offen", label: "Offen", statuses: ["NEW", "CONTACTED", "OFFER_SENT"] },
  { key: "neu", label: "Neu", statuses: ["NEW"] },
  { key: "gewonnen", label: "Auftrag erhalten", statuses: ["WON"] },
  { key: "verloren", label: "Kein Auftrag", statuses: ["LOST"] },
  { key: "alle", label: "Alle", statuses: null },
] as const satisfies ReadonlyArray<{ key: string; label: string; statuses: readonly InquiryStatus[] | null }>;
type StatusKey = (typeof STATUS_FILTERS)[number]["key"];

const TYPE_FILTERS = [
  { key: "", label: "Alle Kunden", value: null },
  { key: "unternehmen", label: "Unternehmen", value: "BUSINESS" },
  { key: "privat", label: "Privatkunden", value: "PRIVATE" },
] as const;
type TypeKey = (typeof TYPE_FILTERS)[number]["key"];

type Filters = { status: StatusKey; typ: TypeKey; q: string };

function filterHref(filters: Filters, change: Partial<Filters>): string {
  const f = { ...filters, ...change };
  const params = new URLSearchParams();
  if (f.status !== "offen") params.set("status", f.status);
  if (f.typ) params.set("typ", f.typ);
  if (f.q) params.set("q", f.q);
  const s = params.toString();
  return s ? `/admin/anfragen?${s}` : "/admin/anfragen";
}

export default async function InquiriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireStaff();
  const sp = await searchParams;

  const statusParam = firstParam(sp.status);
  const typParam = firstParam(sp.typ);
  const filters: Filters = {
    status: STATUS_FILTERS.find((f) => f.key === statusParam)?.key ?? "offen",
    typ: TYPE_FILTERS.find((f) => f.key === typParam)?.key ?? "",
    q: firstParam(sp.q).slice(0, 80),
  };
  const deleted = firstParam(sp.geloescht).match(/^A-\d{1,9}$/)?.[0] ?? null;
  const page = parsePage(sp.seite);

  const statusFilter = STATUS_FILTERS.find((f) => f.key === filters.status)!;
  const typeFilter = TYPE_FILTERS.find((f) => f.key === filters.typ)!;

  const and: Prisma.InquiryWhereInput[] = [];
  if (statusFilter.statuses) and.push({ status: { in: [...statusFilter.statuses] } });
  if (typeFilter.value) and.push({ customerType: typeFilter.value });
  if (filters.q) {
    const number = filters.q.match(/^(?:A-?)?0*(\d{1,9})$/i);
    and.push({
      OR: [
        { name: { contains: filters.q } },
        { companyName: { contains: filters.q } },
        { email: { contains: filters.q } },
        { phone: { contains: filters.q } },
        { zipCity: { contains: filters.q } },
        ...(number ? [{ id: Number(number[1]) }] : []),
      ],
    });
  }
  const where: Prisma.InquiryWhereInput = and.length ? { AND: and } : {};

  const [total, inquiries, openCount, anyInquiry] = await Promise.all([
    db.inquiry.count({ where }),
    db.inquiry.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        customerType: true,
        name: true,
        companyName: true,
        email: true,
        zipCity: true,
        topic: true,
        status: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
      },
    }),
    db.inquiry.count({ where: { status: { in: ["NEW", "CONTACTED", "OFFER_SENT"] } } }),
    db.inquiry.count({ take: 1 }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();
  const filtered = filters.status !== "offen" || filters.typ !== "" || filters.q !== "";

  return (
    <div>
      <PageHeader
        title="Anfragen"
        description="Anfragen von Interessenten über das Kontaktformular der Website. Bestandskunden melden sich über ihr Kundenportal."
      />

      {deleted ? (
        <Alert tone="success" className="mb-5">
          Die Anfrage {deleted} wurde gelöscht.
        </Alert>
      ) : null}

      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <nav aria-label="Filter" className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <FilterPill key={f.key} href={filterHref(filters, { status: f.key })} active={filters.status === f.key}>
              {f.label}
              {f.key === "offen" && openCount > 0 ? <span className="tabular-nums opacity-75">{openCount}</span> : null}
            </FilterPill>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-line sm:block" aria-hidden />
          {TYPE_FILTERS.map((f) => (
            <FilterPill key={f.key || "alle"} href={filterHref(filters, { typ: f.key })} active={filters.typ === f.key}>
              {f.label}
            </FilterPill>
          ))}
        </nav>
        <SearchForm
          action="/admin/anfragen"
          id="anfragen-suche"
          value={filters.q}
          label="Anfragen durchsuchen"
          placeholder="Name, Firma, E-Mail oder Nummer"
          keep={{ status: filters.status !== "offen" ? filters.status : undefined, typ: filters.typ || undefined }}
        />
      </div>

      {inquiries.length === 0 ? (
        anyInquiry === 0 ? (
          <EmptyState title="Noch keine Anfragen">
            Sobald jemand das Kontaktformular auf der Website abschickt, erscheint die Anfrage hier. Zusätzlich geht eine
            E-Mail an das Team.
          </EmptyState>
        ) : (
          <EmptyState
            title={filters.status === "offen" && !filters.q && !filters.typ ? "Keine offenen Anfragen" : "Keine Anfragen für diese Auswahl"}
            action={
              filtered || filters.status === "offen" ? (
                <ButtonLink href="/admin/anfragen?status=alle" variant="secondary">
                  Alle Anfragen anzeigen
                </ButtonLink>
              ) : null
            }
          >
            {filters.q
              ? `Zu „${filters.q}“ gibt es keine Anfrage. Prüfen Sie die Schreibweise oder suchen Sie unter „Alle“.`
              : filters.status === "offen"
                ? "Alles beantwortet. Abgeschlossene Anfragen finden Sie unter „Alle“."
                : "Ändern Sie die Filter oben."}
          </EmptyState>
        )
      ) : (
        <>
          <p className="mb-3 text-sm text-ink-muted">{total === 1 ? "1 Anfrage" : `${total} Anfragen`}</p>
          <Table>
            <THead>
              <tr>
                <TH>Nummer</TH>
                <TH>Name / Firma</TH>
                <TH>Thema</TH>
                <TH>Typ</TH>
                <TH>Status</TH>
                <TH className="text-right">Eingang</TH>
              </tr>
            </THead>
            <tbody>
              {inquiries.map((i) => (
                <TR key={i.id}>
                  <TD className="whitespace-nowrap">
                    <Link href={`/admin/anfragen/${i.id}`} className="font-semibold text-brand-700 hover:underline">
                      {formatInquiryNumber(i.id)}
                    </Link>
                  </TD>
                  <TD className="min-w-[12rem]">
                    <Link href={`/admin/anfragen/${i.id}`} className="font-semibold break-words text-ink hover:underline">
                      {i.companyName || i.name}
                    </Link>
                    <p className="text-xs break-words text-ink-muted">
                      {i.companyName ? i.name : i.email}
                      {i.zipCity ? ` · ${i.zipCity}` : ""}
                    </p>
                  </TD>
                  <TD className="min-w-[12rem]">{labelOf(INQUIRY_TOPIC_LABELS, i.topic)}</TD>
                  <TD>
                    <Badge tone={i.customerType === "BUSINESS" ? "blue" : "gray"}>
                      {i.customerType === "BUSINESS" ? "Unternehmen" : "Privat"}
                    </Badge>
                  </TD>
                  <TD>
                    <InquiryStatusBadge status={i.status} />
                    {i.company ? <p className="mt-1 text-xs text-ink-muted">Kunde: {i.company.name}</p> : null}
                  </TD>
                  <TD className="text-right whitespace-nowrap">
                    <time dateTime={i.createdAt.toISOString()} title={formatDateTime(i.createdAt)}>
                      {formatRelative(i.createdAt, now)}
                    </time>
                  </TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={Math.min(page, pageCount)}
            pageCount={pageCount}
            basePath="/admin/anfragen"
            baseQuery={{
              status: filters.status !== "offen" ? filters.status : undefined,
              typ: filters.typ || undefined,
              q: filters.q || undefined,
            }}
          />
        </>
      )}
    </div>
  );
}
