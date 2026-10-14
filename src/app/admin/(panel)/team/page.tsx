import type { Metadata } from "next";
import Link from "next/link";
import { RoleBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { aboveRowLinkClass, rowLinkClass } from "@/components/admin/companies/list-tools";
import { AccessBadge } from "@/components/admin/companies/status-badges";
import { requireAdmin } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { STAFF_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdmin();

  const [staff, invitedIds, locationCount] = await Promise.all([
    db.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        position: true,
        role: true,
        active: true,
        lastLoginAt: true,
        location: { select: { name: true, active: true } },
      },
    }),
    db.user.findMany({ where: { role: { in: [...STAFF_ROLES] }, passwordHash: null }, select: { id: true } }),
    db.location.count(),
  ]);
  const invited = new Set(invitedIds.map((u) => u.id));
  const admins = staff.filter((u) => u.active && u.role === "ADMIN").length;
  const technicians = staff.filter((u) => u.active && u.role === "TECHNICIAN").length;
  const showLocation = locationCount > 0;

  return (
    <div>
      <PageHeader
        title="Team"
        description="Zugänge zur Verwaltung. Techniker bearbeiten Tickets und Anfragen, Administratoren zusätzlich Kunden, Kosten und das Team."
        meta={
          <span className="text-sm text-ink-muted">
            {admins === 1 ? "1 Administrator" : `${admins} Administratoren`} ·{" "}
            {technicians === 1 ? "1 Techniker" : `${technicians} Techniker`}
          </span>
        }
        actions={<ButtonLink href="/admin/team/neu">Person einladen</ButtonLink>}
      />

      <Table stack>
        <THead>
          <tr>
            <TH>Name</TH>
            {showLocation ? <TH>Standort</TH> : null}
            <TH>Rolle</TH>
            <TH>Zugang</TH>
            <TH className="text-right">Letzte Anmeldung</TH>
          </tr>
        </THead>
        <tbody>
          {staff.map((u) => (
            <TR key={u.id} className={cn("relative", !u.active && "text-ink-muted")}>
              <TD className="min-w-[15rem]">
                <span className="min-w-0">
                  <Link
                    href={`/admin/team/${u.id}`}
                    className={cn("font-semibold break-words text-ink hover:underline", rowLinkClass)}
                  >
                    {u.name}
                  </Link>
                  {u.id === me.id ? <span className="ml-1.5 text-xs font-semibold text-ink-muted">(Sie)</span> : null}
                  {u.position ? <span className="text-xs text-ink-muted"> · {u.position}</span> : null}
                  <span className="block text-xs text-ink-muted">
                    <a href={`mailto:${u.email}`} className={cn("break-words hover:text-ink hover:underline", aboveRowLinkClass)}>
                      {u.email}
                    </a>
                    {u.phone ? <span className="whitespace-nowrap"> · {u.phone}</span> : null}
                  </span>
                </span>
              </TD>
              {showLocation ? (
                <TD label="Standort">
                  {u.location ? (
                    <span className={u.location.active ? "text-ink" : "text-ink-muted"}>
                      {u.location.name}
                      {u.location.active ? null : " (deaktiviert)"}
                    </span>
                  ) : (
                    <span className="text-ink-muted">–</span>
                  )}
                </TD>
              ) : null}
              <TD label="Rolle">
                <RoleBadge role={u.role} />
              </TD>
              <TD label="Zugang">
                <AccessBadge active={u.active} invited={invited.has(u.id)} />
              </TD>
              <TD label="Letzte Anmeldung" className="text-right whitespace-nowrap">
                {u.lastLoginAt ? (
                  <time dateTime={u.lastLoginAt.toISOString()} title={formatDateTime(u.lastLoginAt)}>
                    {formatRelative(u.lastLoginAt)}
                  </time>
                ) : (
                  <span className="text-ink-muted">noch nie</span>
                )}
              </TD>
            </TR>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
