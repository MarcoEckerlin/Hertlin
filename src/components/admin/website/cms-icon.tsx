import {
  Building2,
  Check,
  Clock,
  Headset,
  House,
  Mail,
  Map as MapIcon,
  Monitor,
  Network,
  Phone,
  Printer,
  Server,
  Shield,
  Ticket,
  Users,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import type { ICONS } from "@/cms/schema";

/** Symbolvorschau im Editor (die Website verwendet dieselben Namen). */
const MAP: Record<(typeof ICONS)[number], LucideIcon> = {
  monitor: Monitor,
  network: Network,
  mail: Mail,
  server: Server,
  shield: Shield,
  phone: Phone,
  printer: Printer,
  wifi: Wifi,
  headset: Headset,
  building: Building2,
  home: House,
  users: Users,
  clock: Clock,
  ticket: Ticket,
  check: Check,
  map: MapIcon,
};

export function CmsIcon({ name, className }: { name: string | undefined; className?: string }) {
  const Icon = name && Object.hasOwn(MAP, name) ? MAP[name as keyof typeof MAP] : null;
  if (!Icon) return null;
  return <Icon className={className} aria-hidden />;
}
