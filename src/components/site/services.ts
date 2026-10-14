import { Mail, Monitor, Phone, Server, ShieldCheck, Wifi, type LucideIcon } from "lucide-react";

export type Service = {
  /** Anker auf /leistungen */
  id: string;
  icon: LucideIcon;
  title: string;
  /** Ein Satz für die Übersicht auf der Startseite */
  short: string;
  /** Ausführliche Beschreibung auf /leistungen */
  text: string[];
  /** Konkrete Beispiele, was wir in diesem Bereich erledigen */
  tasks: string[];
  audience: Array<"Unternehmen" | "Privatkunden">;
};

/** Leistungsbereiche – gemeinsame Grundlage für Startseite und /leistungen. */
export const services: Service[] = [
  {
    id: "arbeitsplaetze",
    icon: Monitor,
    title: "Arbeitsplätze & Hardware",
    short: "PCs und Notebooks auswählen, einrichten und austauschen – samt Daten vom alten Gerät.",
    text: [
      "Ein neuer Arbeitsplatz ist erst fertig, wenn man morgens damit anfangen kann: mit den eigenen Programmen, dem Drucker, den Netzlaufwerken und dem Postfach. Wir beraten bei der Auswahl, bestellen auf Wunsch, richten die Geräte vor und stellen sie bei Ihnen auf.",
      "Alte Geräte löschen wir so, dass sich keine Daten mehr wiederherstellen lassen. Das gilt auch für Festplatten aus Druckern und Kopierern.",
    ],
    tasks: [
      "Notebooks und PCs vorbereiten und vor Ort aufstellen",
      "Daten und Einstellungen vom alten Gerät übernehmen",
      "Drucker, Scanner und Multifunktionsgeräte einbinden",
      "Windows, Treiber und Programme aktuell halten",
      "Altgeräte sicher löschen",
    ],
    audience: ["Unternehmen", "Privatkunden"],
  },
  {
    id: "netzwerk",
    icon: Wifi,
    title: "Netzwerk & WLAN",
    short: "WLAN, das in allen Räumen reicht, ein getrenntes Gästenetz und ein Plan, was wo angeschlossen ist.",
    text: [
      "Hinter der Meldung „Das Internet ist langsam“ steckt oft das eigene Netzwerk: ein überlasteter Router, ein Access Point an der falschen Stelle oder ein beschädigtes Kabel. Wir messen nach, statt zu raten, und richten Router, Firewall, Switches und Access Points so ein, dass sie zusammenpassen.",
      "Am Ende bekommen Sie einen Netzwerkplan. Darauf steht, welches Gerät wo hängt und wie man es erreicht.",
    ],
    tasks: [
      "WLAN-Abdeckung messen und Access Points setzen",
      "Gäste-WLAN getrennt vom Firmennetz",
      "Router, Firewall und Switches einrichten",
      "VPN-Zugang für Homeoffice und Außendienst",
      "Netzwerkplan mit Anschlüssen und Zugängen",
    ],
    audience: ["Unternehmen", "Privatkunden"],
  },
  {
    id: "microsoft-365",
    icon: Mail,
    title: "Microsoft 365 & E-Mail",
    short: "Postfächer, Teams, OneDrive und SharePoint einrichten und den Umzug vom alten Anbieter übernehmen.",
    text: [
      "Wir richten Microsoft 365 so ein, dass neue Mitarbeiter am ersten Tag arbeiten können und die Zugänge ausgeschiedener Mitarbeiter am letzten Tag gesperrt werden. Gemeinsame Postfächer, Verteiler und Kalender gehören genauso dazu wie die Anmeldung mit einem zweiten Faktor.",
      "Wechseln Sie von einem anderen E-Mail-Anbieter, ziehen wir Postfächer, Kontakte und Dateien mit um und stellen die Domain so um, dass keine Mail verloren geht.",
    ],
    tasks: [
      "Benutzer anlegen, Lizenzen zuweisen, Konten sperren",
      "E-Mail-Umzug vom bisherigen Anbieter",
      "Gemeinsame Postfächer, Verteiler und Kalender",
      "Dateiablage in Teams, OneDrive und SharePoint",
      "Anmeldung mit zweitem Faktor einrichten",
    ],
    audience: ["Unternehmen"],
  },
  {
    id: "server-backup",
    icon: Server,
    title: "Server & Datensicherung",
    short: "Server, NAS und Datensicherungen, die überwacht und regelmäßig zur Probe zurückgespielt werden.",
    text: [
      "Eine Datensicherung ist nur so gut wie die letzte erfolgreiche Wiederherstellung. Wir richten Sicherungen nach der 3-2-1-Regel ein: drei Kopien Ihrer Daten, auf zwei verschiedenen Speichern, eine davon außer Haus. Schlägt eine Sicherung fehl, bekommen wir eine Meldung und kümmern uns darum.",
      "Ihre Server und NAS-Systeme halten wir aktuell, ordnen Freigaben und Berechtigungen und tauschen Festplatten, sobald sie Fehler melden.",
    ],
    tasks: [
      "Sicherungskonzept mit Kopie außer Haus",
      "Überwachung der Sicherungen mit Fehlermeldung",
      "Probe-Wiederherstellung von Dateien und ganzen Systemen",
      "Windows-Server und NAS pflegen und aktualisieren",
      "Freigaben und Zugriffsrechte aufräumen",
    ],
    audience: ["Unternehmen"],
  },
  {
    id: "sicherheit",
    icon: ShieldCheck,
    title: "IT-Sicherheit",
    short: "Virenschutz, Firewall, Updates und klare Regeln, wer worauf zugreifen darf.",
    text: [
      "Sicherheit besteht aus vielen kleinen Dingen, die zuverlässig erledigt werden müssen: Updates, ein zentral überwachter Virenschutz, eine sauber eingestellte Firewall und Benutzerkonten ohne unnötige Administratorrechte.",
      "Wenn trotzdem etwas passiert ist – eine verdächtige Rechnung wurde geöffnet, ein Passwort ist in falsche Hände geraten –, helfen wir sofort, trennen betroffene Geräte vom Netz und sagen Ihnen, was als Nächstes zu tun ist.",
    ],
    tasks: [
      "Virenschutz mit zentraler Übersicht",
      "Firewall und abgesicherte Fernzugänge",
      "Updates für Windows und Programme verwalten",
      "Verdächtige E-Mails und Anhänge prüfen",
      "Kurze Schulung: gefälschte E-Mails erkennen",
    ],
    audience: ["Unternehmen", "Privatkunden"],
  },
  {
    id: "telefonie",
    icon: Phone,
    title: "Telefonie",
    short: "Telefonanlage aus der Cloud, Tischtelefone, Ansagen und Weiterleitung aufs Handy.",
    text: [
      "Wenn die alte Telefonanlage ersetzt werden muss oder ein Umzug ansteht, stellen wir auf eine Telefonanlage aus der Cloud um. Ihre Rufnummern nehmen Sie dabei mit.",
      "Wir richten Ansagen, Warteschleife und Zeitsteuerung ein und sorgen dafür, dass Anrufe auch im Homeoffice oder auf dem Handy ankommen.",
    ],
    tasks: [
      "Cloud-Telefonanlage einrichten, Rufnummern mitnehmen",
      "Tischtelefone, Headsets und Telefon-App am PC",
      "Ansagen, Warteschleife und Öffnungszeiten-Steuerung",
      "Weiterleitung aufs Handy und ins Homeoffice",
    ],
    audience: ["Unternehmen"],
  },
];
