"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  BookOpen,
  Building2,
  ClipboardList,
  Euro,
  Globe,
  Inbox,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Network,
  Phone,
  Plus,
  ReceiptText,
  Ticket,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { LogoMark } from "@/components/ui/logo";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const icons = {
  dashboard: LayoutDashboard,
  tickets: Ticket,
  newTicket: Plus,
  inquiries: Inbox,
  companies: Building2,
  subCustomers: Network,
  users: UsersRound,
  costs: Euro,
  team: ClipboardList,
  profile: UserRound,
  calls: Phone,
  website: Globe,
  invoices: ReceiptText,
  catalog: BookOpen,
  locations: MapPin,
} as const;

export type ShellIcon = keyof typeof icons;

export type ShellNavItem = {
  href: string;
  label: string;
  icon: ShellIcon;
  /** Nur bei exakt gleichem Pfad aktiv (z. B. Dashboard "/") */
  exact?: boolean;
  /** Kleine Zahl rechts, z. B. neue Anfragen */
  count?: number;
};

export type ShellNavGroup = { label?: string; items: ShellNavItem[] };

type Props = {
  areaLabel: string;
  areaSubLabel?: string;
  homeHref: string;
  groups: ShellNavGroup[];
  user: { name: string; email: string; roleLabel: string };
  profileHref: string;
  logoutAction: () => Promise<void>;
  /**
   * Optionales Element für die Kopfzeile (mobil) bzw. oben rechts in der Seitenleiste (Desktop),
   * z. B. der Sprachumschalter im Kundenportal. Wird immer nur an einer Stelle eingehängt.
   */
  toolbar?: ReactNode;
  children: ReactNode;
};

/* ---------- Breakpoint für die Werkzeugleiste ---------- */

const DESKTOP_QUERY = "(min-width: 64rem)";

function subscribeDesktop(callback: () => void) {
  const query = window.matchMedia(DESKTOP_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

/**
 * Hängt children nur ein, wenn der Bildschirm zur gewünschten Stelle passt.
 * So läuft z. B. der Sprachumschalter nie doppelt (Kopfzeile und Seitenleiste gleichzeitig).
 * Auf dem Server und während der Hydration ist die Breite unbekannt – dann erscheint nichts.
 */
function ResponsiveSlot({ desktop, children }: { desktop: boolean; children: ReactNode }) {
  const isDesktop = useSyncExternalStore<boolean | null>(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => null,
  );
  if (isDesktop === null || isDesktop !== desktop) return null;
  return <>{children}</>;
}

function isActive(pathname: string, item: ShellNavItem) {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AppShell({
  areaLabel,
  areaSubLabel,
  homeHref,
  groups,
  user,
  profileHref,
  logoutAction,
  toolbar,
  children,
}: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Menü schließen, sobald sich die Seite ändert
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  /** Nach dem Schließen per Escape/Knopf den Fokus zurück auf „Menü öffnen“ setzen */
  const restoreFocusRef = useRef(false);

  function closeMenu() {
    restoreFocusRef.current = true;
    setOpen(false);
  }

  // Mobiles Menü als modaler Dialog: Fokus hinein, Escape schließt, Tab bleibt im Menü
  useEffect(() => {
    if (!open) {
      if (restoreFocusRef.current) {
        restoreFocusRef.current = false;
        menuButtonRef.current?.focus();
      }
      return;
    }
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        restoreFocusRef.current = true;
        setOpen(false);
        return;
      }
      const drawer = drawerRef.current;
      if (event.key !== "Tab" || !drawer) return;
      const items = drawer.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea");
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = drawer.contains(document.activeElement);
      if (event.shiftKey && (!inside || document.activeElement === first)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (!inside || document.activeElement === last)) {
        event.preventDefault();
        first.focus();
      }
    }

    // Wird das Fenster breit genug für die feste Seitenleiste, braucht es das Menü nicht mehr
    const desktop = window.matchMedia(DESKTOP_QUERY);
    function onDesktopChange() {
      if (desktop.matches) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    desktop.addEventListener("change", onDesktopChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      desktop.removeEventListener("change", onDesktopChange);
    };
  }, [open]);

  // Bei mehreren passenden Einträgen gewinnt der spezifischste (längster Pfad)
  const allItems = groups.flatMap((g) => g.items);
  const activeHref = allItems
    .filter((i) => isActive(pathname, i))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  // Im mobilen Menü liegt oben rechts der Schließen-Knopf, daher dort mehr Abstand rechts
  const renderSidebar = (inDrawer: boolean) => (
    <div className="flex h-full flex-col">
      <div className={cn("flex items-center gap-3 px-5 pt-5 pb-6", toolbar ? "pr-20" : inDrawer ? "pr-14" : null)}>
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5">
          <LogoMark />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[0.95rem] font-extrabold tracking-tight text-ink">{areaLabel}</span>
            {areaSubLabel ? <span className="block truncate text-xs font-medium text-ink-muted">{areaSubLabel}</span> : null}
          </span>
        </Link>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3" aria-label="Hauptnavigation">
        {groups.map((group, gi) => (
          <div key={gi}>
            {group.label ? (
              <p className="mb-1.5 px-3 text-[0.7rem] font-bold tracking-wider text-ink-muted uppercase">{group.label}</p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = icons[item.icon];
                const active = item.href === activeHref;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-[0.9rem] font-semibold transition-colors",
                        active ? "bg-brand-100 text-ink" : "text-ink-soft hover:bg-brand-50 hover:text-ink",
                      )}
                    >
                      <Icon className={cn("size-[1.05rem]", active ? "text-brand-700" : "text-ink-muted")} aria-hidden />
                      <span className="flex-1">{item.label}</span>
                      {item.count ? (
                        <span className="rounded-full bg-primary px-2 py-0.5 text-[0.7rem] font-bold text-on-primary">{item.count}</span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-3">
        <Link href={profileHref} className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-brand-50">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-800"
            aria-hidden
          >
            {initials(user.name)}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="sr-only">Mein Profil: </span>
            <span className="block truncate text-sm font-semibold text-ink">{user.name}</span>
            <span className="block truncate text-xs text-ink-muted">{user.roleLabel}</span>
          </span>
        </Link>
        <div className="mt-1 flex items-center justify-between gap-2 px-3 py-1.5">
          <span className="text-xs font-semibold text-ink-muted">Darstellung</span>
          <ThemeToggle compact />
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-brand-50 hover:text-ink"
          >
            <LogOut className="size-4 text-ink-muted" aria-hidden />
            Abmelden
          </button>
        </form>
      </div>
    </div>
  );

  const menuButton = (
    <button
      ref={menuButtonRef}
      type="button"
      onClick={() => setOpen(true)}
      className="grid size-10 place-items-center rounded-full text-ink hover:bg-brand-50"
      aria-label="Menü öffnen"
      aria-expanded={open}
    >
      <Menu className="size-5" aria-hidden />
    </button>
  );

  return (
    <div className="min-h-dvh bg-mist">
      <a
        href="#inhalt"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-on-ink"
      >
        Zum Inhalt springen
      </a>
      {/* Desktop-Seitenleiste */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-surface lg:block">
        {renderSidebar(false)}
        {toolbar ? (
          <div className="absolute top-5 right-3">
            <ResponsiveSlot desktop>{toolbar}</ResponsiveSlot>
          </div>
        ) : null}
      </aside>

      {/* Mobile Kopfzeile */}
      {/* Mit Werkzeugleiste ohne backdrop-blur: Ein Filter würde fest positionierte Elemente darin
          (z. B. den Hinweis „Maschinell übersetzt“) an die Kopfzeile statt an das Fenster binden. */}
      <header
        inert={open}
        className={cn(
          "sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line px-4 lg:hidden",
          toolbar ? "bg-surface" : "bg-surface/95 backdrop-blur",
        )}
      >
        <Link href={homeHref} className="flex min-w-0 items-center gap-2">
          <LogoMark className="size-7" />
          <span className="max-w-[12rem] truncate text-sm font-extrabold">{areaLabel}</span>
        </Link>
        {toolbar ? (
          <div className="flex shrink-0 items-center gap-1">
            <ResponsiveSlot desktop={false}>{toolbar}</ResponsiveSlot>
            {menuButton}
          </div>
        ) : (
          menuButton
        )}
      </header>

      {/* Mobile Seitenleiste */}
      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menü">
          {/* Klick auf den abgedunkelten Hintergrund schließt; per Tastatur gibt es den Knopf im Menü */}
          <button type="button" className="absolute inset-0 bg-navy/50" onClick={closeMenu} tabIndex={-1} aria-hidden />
          <div ref={drawerRef} className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface-raised shadow-lift">
            <button
              ref={closeButtonRef}
              type="button"
              onClick={closeMenu}
              className="absolute top-4 right-3 grid size-9 place-items-center rounded-full hover:bg-brand-50"
              aria-label="Menü schließen"
            >
              <X className="size-5" aria-hidden />
            </button>
            {renderSidebar(true)}
          </div>
        </div>
      ) : null}

      <main id="inhalt" inert={open} className="lg:pl-64">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">{children}</div>
      </main>
    </div>
  );
}
