import type { Metadata } from "next";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { locationOptions } from "@/lib/locations";
import { ACCEPT_ATTRIBUTE, ALLOWED_EXTENSIONS_LABEL, MAX_FILES, MAX_FILE_SIZE } from "@/lib/uploads";
import { Card, CardBody } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { loadCustomerGroups, loadStaffOptions, type ContactUserOption } from "@/components/admin/tickets/data";
import { PRIVATE_CUSTOMER } from "@/components/admin/tickets/filters";
import {
  NewTicketForm,
  type NewTicketCustomerGroup,
  type NewTicketDefaults,
} from "@/components/admin/tickets/new-ticket-form";

export const metadata: Metadata = { title: "Ticket anlegen" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function param(params: Awaited<SearchParams>, key: string, max: number): string {
  const value = params[key];
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/**
 * Ticket anlegen, z. B. nach einem Anruf oder einer E-Mail.
 * Vorbelegung über die Adresse (Links aus Anfragen, Anrufen und der Kundenansicht):
 * ?firma=<id oder „privat“>&kontaktName=…&kontaktEmail=…&kontaktTelefon=…&kontaktAnschrift=…&betreff=…
 */
export default async function NewStaffTicketPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireStaff();
  const params = await searchParams;

  const [customers, staff, locations, companyLocations, mainLocation] = await Promise.all([
    loadCustomerGroups({ activeOnly: true, withUsers: true }),
    loadStaffOptions(),
    locationOptions(),
    db.company.findMany({
      where: { active: true },
      select: { id: true, location: { select: { name: true, active: true } } },
    }),
    db.location.findFirst({ where: { isMain: true, active: true }, orderBy: { sortOrder: "asc" }, select: { name: true } }),
  ]);
  // Standort je Firma (nur aktive Standorte); Unterkunden ohne eigenen erben den des Firmenkunden
  const ownLocation = new Map(companyLocations.map((c) => [c.id, c.location?.active ? c.location.name : null]));

  const groups: NewTicketCustomerGroup[] = customers.map((root) => {
    const rootAdmins = root.users.filter((u) => u.role === "CUSTOMER_ADMIN");
    return {
      id: root.id,
      name: root.name,
      companies: [
        {
          id: root.id,
          name: root.name,
          label: root.name,
          isRoot: true,
          users: root.users,
          rootAdmins: [],
          locationLabel: ownLocation.get(root.id) ?? null,
        },
        ...root.children.map((child) => ({
          id: child.id,
          name: child.name,
          label: `${root.name} › ${child.name}`,
          isRoot: false,
          users: child.users,
          rootAdmins,
          locationLabel: ownLocation.get(child.id) ?? ownLocation.get(root.id) ?? null,
        })),
      ],
    };
  });
  const companies = groups.flatMap((g) => g.companies);

  // Vorbelegung: Firma aus der Adresse („privat“ für Privatkunden);
  // Ansprechpartner, wenn die E-Mail-Adresse zu einem Benutzer passt
  const firma = param(params, "firma", 40) || param(params, "kunde", 40);
  const contactEmail = param(params, "kontaktEmail", 200).toLowerCase();
  let customer = firma === PRIVATE_CUSTOMER || companies.some((c) => c.id === firma) ? firma : "";
  let contactUserId = "";
  if (contactEmail) {
    const matches = (u: ContactUserOption) => u.email.toLowerCase() === contactEmail;
    const candidates = customer === PRIVATE_CUSTOMER ? [] : customer ? companies.filter((c) => c.id === customer) : companies;
    for (const c of candidates) {
      const hit = [...c.users, ...c.rootAdmins].find(matches);
      if (hit) {
        customer = c.id;
        contactUserId = hit.id;
        break;
      }
    }
  }

  const defaults: NewTicketDefaults = {
    customer,
    contactUserId,
    contactName: param(params, "kontaktName", 120),
    contactEmail,
    contactPhone: param(params, "kontaktTelefon", 40),
    contactAddress: param(params, "kontaktAnschrift", 300),
    subject: param(params, "betreff", 150),
  };

  return (
    <>
      <PageHeader
        breadcrumbs={[
          { label: "Übersicht", href: "/admin" },
          { label: "Tickets", href: "/admin/tickets" },
          { label: "Ticket anlegen" },
        ]}
        title="Ticket anlegen"
        description="Für Meldungen, die per Telefon, E-Mail oder vor Ort ankommen. Das Ticket erscheint beim Kunden im Portal bzw. über seinen Status-Link."
      />

      <Card className="max-w-3xl">
        <CardBody className="sm:px-8 sm:py-7">
          <NewTicketForm
            groups={groups}
            staff={staff.map((s) => ({ id: s.id, name: s.name }))}
            currentUserId={user.id}
            defaults={defaults}
            uploadRules={{
              accept: ACCEPT_ATTRIBUTE,
              maxFiles: MAX_FILES,
              maxFileSize: MAX_FILE_SIZE,
              allowedLabel: ALLOWED_EXTENSIONS_LABEL,
            }}
            locations={{ options: locations, mainLabel: mainLocation?.name ?? null }}
          />
        </CardBody>
      </Card>
    </>
  );
}
