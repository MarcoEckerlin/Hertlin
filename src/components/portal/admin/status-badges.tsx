import { Badge } from "@/components/ui/badge";
import type { UserAccessStatus } from "@/components/portal/admin/types";

const USER_STATUS: Record<UserAccessStatus, { label: string; tone: "green" | "amber" | "gray" }> = {
  ACTIVE: { label: "Aktiv", tone: "green" },
  INVITED: { label: "Einladung offen", tone: "amber" },
  INACTIVE: { label: "Deaktiviert", tone: "gray" },
};

export function UserStatusBadge({ status }: { status: UserAccessStatus }) {
  const s = USER_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export function CompanyStatusBadge({ active }: { active: boolean }) {
  return active ? <Badge tone="green">Aktiv</Badge> : <Badge tone="gray">Deaktiviert</Badge>;
}
