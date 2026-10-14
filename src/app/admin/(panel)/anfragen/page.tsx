import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { MessageSquare } from "lucide-react";
import { Badge, InquiryStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { SegmentedTabs } from "@/components/ui/segmented-tabs";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { FlashToast } from "@/components/ui/toaster";
import { ListFilters, ListResults, ListSearchForm } from "@/components/admin/companies/list-filters";
import { aboveRowLinkClass, firstParam, rowLinkClass } from "@/components/admin/companies/list-tools";
import { requireStaff } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { INQUIRY_TOPIC_LABELS, labelOf, type InquiryStatus } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, formatInquiryNumber, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Anfragen" };

const PAGE_SIZE = 30;

const OPEN_INQUIRY_STATUSES: InquiryStatus[] = ["NEW", "CONTACTED", "OFFER_SENT"];

const STATUS_FILTERS = [
  { key: "offen", label: "Offen", statuses: OPEN_INQUIRY_STATUSES },
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
  const deleted = firstParam(sp.geloescht).match(/^A-\d{1,9}$/)?.[0] ?? undefined;
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

  const [total, inquiries, openCount, newCount, anyInquiry] = await Promise.all([
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
        _count: { select: { messages: true } },
        // Letzte Chat-Nachricht: Kommt sie vom Interessenten, wartet er auf Antwort
        messages: {
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 1,
          select: { fromStaff: true, createdAt: true },
        },
      },
    }),
    db.inquiry.count({ where: { status: { in: OPEN_INQUIRY_STATUSES } } }),
    db.inquiry.count({ where: { status: "NEW" } }),
    db.inquiry.count({ take: 1 }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const now = new Date();
  const filtered = filters.status !== "offen" || filters.typ !== "" || filters.q !== "";

  return (
    <div>
      <FlashToast
        param="geloescht"
        value={deleted}
        messages={deleted ? { [deleted]: `Die Anfrage ${deleted} wurde gelöscht.` } : {}}
      />
      <PageHeader title="Anfragen" description="Anfragen von Interessenten über das Kontaktformular der Website." />

      <ListFilters>
        <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <SegmentedTabs
            label="Status"
            tabs={STATUS_FILTERS.map((f) => ({
              href: filterHref(filters, { status: f.key }),
              label: f.label,
              active: filters.status === f.key,
              count: f.key === "offen" ? openCount : f.key === "neu" ? newCount : undefined,
              highlight: f.key === "neu",
            }))}
          />
          <ListSearchForm
            action="/admin/anfragen"
            id="anfragen-suche"
            value={filters.q}
            label="Anfragen durchsuchen"
            placeholder="Name, Firma, E-Mail oder Nummer"
            keep={{ status: filters.status !== "offen" ? filters.status : undefined }}
            className="xl:w-auto"
          >
            <div className="w-full sm:w-44">
              <label htmlFor="anfragen-typ" className="sr-only">
                Art des Kunden
              </label>
              <Select id="anfragen-typ" name="typ" defaultValue={filters.typ} className="h-9 text-sm">
                {TYPE_FILTERS.map((f) => (
                  <option key={f.key || "alle"} value={f.key}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </div>
          </ListSearchForm>
        </div>

        <ListResults>
          {inquiries.length === 0 ? (
            anyInquiry === 0 ? (
              <EmptyState title="Noch keine Anfragen">
                Sobald jemand das Kontaktformular auf der Website abschickt, erscheint die Anfrage hier. Zusätzlich geht eine
                E-Mail an das Team.
              </EmptyState>
            ) : (
              <EmptyState
                title={
                  filters.status === "offen" && !filters.q && !filters.typ
                    ? "Keine offenen Anfragen"
                    : "Keine Anfragen für diese Auswahl"
                }
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
              <Table stack>
                <THead>
                  <tr>
                    <TH>Anfrage</TH>
                    <TH>Thema</TH>
                    <TH>Status</TH>
                    <TH>Chat</TH>
                    <TH className="text-right">Eingang</TH>
                  </tr>
                </THead>
                <tbody>
                  {inquiries.map((i) => {
                    const chatCount = i._count.messages;
                    const lastChat = i.messages[0] ?? null;
                    const awaitingReply = lastChat !== null && !lastChat.fromStaff;
                    const business = i.customerType === "BUSINESS";
                    return (
                      <TR key={i.id} className="relative">
                        <TD className="min-w-[14rem]">
                          <span className="min-w-0">
                            <Link
                              href={`/admin/anfragen/${i.id}`}
                              className={cn("font-semibold break-words text-ink hover:underline", rowLinkClass)}
                            >
                              {i.companyName || i.name}
                            </Link>
                            <span className="block text-xs break-words text-ink-muted">
                              {[formatInquiryNumber(i.id), i.companyName ? i.name : i.email, i.zipCity]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                        </TD>
                        <TD label="Thema" className="min-w-[11rem]">
                          <span>
                            {labelOf(INQUIRY_TOPIC_LABELS, i.topic)}
                            <span className="block text-xs text-ink-muted">{business ? "Unternehmen" : "Privatkunde"}</span>
                          </span>
                        </TD>
                        <TD label="Status">
                          <span>
                            <InquiryStatusBadge status={i.status} />
                            {i.company ? (
                              <span className="mt-1 block text-xs text-ink-muted">Kunde: {i.company.name}</span>
                            ) : null}
                          </span>
                        </TD>
                        <TD label="Chat" className="whitespace-nowrap">
                          {chatCount === 0 ? (
                            <span className="text-ink-muted" title="Noch keine Chat-Nachrichten">
                              –
                            </span>
                          ) : (
                            <span className="inline-flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:justify-start">
                              <span className="inline-flex items-center gap-1.5 text-ink-soft">
                                <MessageSquare className="size-4 shrink-0" aria-hidden />
                                <span className="font-semibold tabular-nums">{chatCount}</span>
                                <span className="sr-only">{chatCount === 1 ? "Chat-Nachricht" : "Chat-Nachrichten"}</span>
                              </span>
                              {awaitingReply && lastChat ? (
                                <Badge tone="amber">
                                  Antwort offen
                                  <time
                                    dateTime={lastChat.createdAt.toISOString()}
                                    title={`Letzte Nachricht des Interessenten: ${formatDateTime(lastChat.createdAt)}`}
                                    className={cn("font-normal", aboveRowLinkClass)}
                                  >
                                    {formatRelative(lastChat.createdAt, now)}
                                  </time>
                                </Badge>
                              ) : null}
                            </span>
                          )}
                        </TD>
                        <TD label="Eingang" className="text-right whitespace-nowrap">
                          <time dateTime={i.createdAt.toISOString()} title={formatDateTime(i.createdAt)}>
                            {formatRelative(i.createdAt, now)}
                          </time>
                        </TD>
                      </TR>
                    );
                  })}
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
        </ListResults>
      </ListFilters>
    </div>
  );
}
