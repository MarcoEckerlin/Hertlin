import type { Metadata } from "next";
import Link from "next/link";
import { RoleBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { AccessBadge } from "@/components/admin/companies/status-badges";
import { requireAdmin } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";
import { db } from "@/lib/db";
import { formatDateTime, formatRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const me = await requireAdmin();

  const [staff, invitedIds] = await Promise.all([
    db.user.findMany({
      where: { role: { in: [...STAFF_ROLES] } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: { id: true, name: true, email: true, phone: true, position: true, role: true, active: true, lastLoginAt: true },
    }),
    db.user.findMany({ where: { role: { in: [...STAFF_ROLES] }, passwordHash: null }, select: { id: true } }),
  ]);
  const invited = new Set(invitedIds.map((u) => u.id));
  const admins = staff.filter((u) => u.active && u.role === "ADMIN").length;
  const technicians = staff.filter((u) => u.active && u.role === "TECHNICIAN").length;

  return (
    <div>
      <PageHeader
        title="Team"
        description="Alle Zugänge zur Verwaltung. Administratoren sehen zusätzlich Kosten, verwalten Kunden und das Team; Techniker bearbeiten Tickets und Anfragen."
        meta={
          <span className="text-sm text-ink-muted">
            {admins === 1 ? "1 Administrator" : `${admins} Administratoren`} · {technicians === 1 ? "1 Techniker" : `${technicians} Techniker`}
          </span>
        }
        actions={<ButtonLink href="/admin/team/neu">Person einladen</ButtonLink>}
      />

      <Table>
        <THead>
          <tr>
            <TH>Name</TH>
            <TH>Kontakt</TH>
            <TH>Rolle</TH>
            <TH>Zugang</TH>
            <TH className="text-right">Letzte Anmeldung</TH>
          </tr>
        </THead>
        <tbody>
          {staff.map((u) => (
            <TR key={u.id} className={u.active ? undefined : "text-ink-muted"}>
              <TD className="min-w-[12rem]">
                <Link href={`/admin/team/${u.id}`} className="font-semibold break-words text-ink hover:underline">
                  {u.name}
                </Link>
                {u.id === me.id ? <span className="ml-1.5 text-xs font-semibold text-ink-muted">(Sie)</span> : null}
                {u.position ? <p className="text-xs text-ink-muted">{u.position}</p> : null}
              </TD>
              <TD className="min-w-[12rem]">
                <a href={`mailto:${u.email}`} className="break-all hover:underline">
                  {u.email}
                </a>
                {u.phone ? <p className="text-xs">{u.phone}</p> : null}
              </TD>
              <TD>
                <RoleBadge role={u.role} />
              </TD>
              <TD>
                <AccessBadge active={u.active} invited={invited.has(u.id)} />
              </TD>
              <TD className="text-right whitespace-nowrap">
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
