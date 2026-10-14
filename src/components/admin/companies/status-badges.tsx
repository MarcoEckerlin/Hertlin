import { Badge } from "@/components/ui/badge";

/** Zugang eines Benutzers: aktiv, Einladung offen oder deaktiviert. */
export function AccessBadge({ active, invited }: { active: boolean; invited: boolean }) {
  if (!active) return <Badge tone="gray">Deaktiviert</Badge>;
  if (invited) return <Badge tone="amber">Einladung offen</Badge>;
  return <Badge tone="green">Aktiv</Badge>;
}

export function CompanyActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge tone="green">Aktiv</Badge> : <Badge tone="gray">Deaktiviert</Badge>;
}
