import type { z } from "zod";
import { blockSchema, type Block } from "@/cms/schema";

/**
 * Standardinhalte der Kernseiten. Werden verwendet, solange eine Seite noch nicht im Editor
 * veröffentlicht wurde, und beim ersten Öffnen im Editor als Ausgangspunkt übernommen.
 *
 * Kontaktdaten stehen nie fest im Text, sondern als Platzhalter ({firma}, {telefon}, {email} …),
 * damit Änderungen in den Firmendaten überall ankommen. Zusätzlich kennt die Darstellung
 * {firmierung}, {hosting}, {log_tage} und {portal_beispiel} (siehe src/cms/placeholders.ts).
 */

export type DefaultPage = {
  title: string;
  description?: string;
  navLabel?: string;
  showInNav: boolean;
  showInFooter: boolean;
  navOrder: number;
  blocks: Block[];
};

/** Modul in Eingabeform (Felder mit Standardwert dürfen fehlen). */
export type DefaultBlockInput = z.input<typeof blockSchema>;

export type DefaultPageSource = Omit<DefaultPage, "blocks"> & { blocks: DefaultBlockInput[] };

/* ------------------------------------------------------------------ */
/* Hilfen zum Schreiben                                                */
/* ------------------------------------------------------------------ */

/** Absätze mit Leerzeile verbinden */
const md = (...parts: string[]) => parts.join("\n\n");
/** Aufzählung mit "- " */
const list = (...items: string[]) => items.map((item) => `- ${item}`).join("\n");
/** Nummerierte Liste */
const numbered = (...items: string[]) => items.map((item, i) => `${i + 1}. ${item}`).join("\n");

const RESPONSE_NOTE = md(
  "**Gilt für Firmenkunden mit Betreuungsvertrag, innerhalb der Servicezeiten.** Was nach Ende der Servicezeit eingeht, bearbeiten wir ab Beginn der nächsten, sofern im Vertrag nichts anderes vereinbart ist.",
  "Reaktionszeit heißt: In dieser Zeit meldet sich ein Techniker bei Ihnen und fängt mit der Arbeit an. Wie lange die Behebung dauert, hängt von der Ursache ab – ein defektes Netzteil ist schneller getauscht als ein Server neu aufgesetzt.",
);

const CTA_DEFAULT_PRIMARY = { label: "Anfrage stellen", href: "/kontakt" };
const CTA_DEFAULT_SECONDARY = { label: "Zum Kundenportal", href: "/login" };

/* ------------------------------------------------------------------ */
/* Leistungsbereiche (Startseite und /leistungen)                      */
/* ------------------------------------------------------------------ */

type Service = {
  id: string;
  icon: "monitor" | "wifi" | "mail" | "server" | "shield" | "phone";
  title: string;
  linkLabel: string;
  audience: string;
  short: string;
  text: string[];
  tasks: string[];
};

const SERVICES: Service[] = [
  {
    id: "arbeitsplaetze",
    icon: "monitor",
    title: "Arbeitsplätze & Hardware",
    linkLabel: "Mehr zu Arbeitsplätzen",
    audience: "Für Unternehmen und Privatkunden",
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
  },
  {
    id: "netzwerk",
    icon: "wifi",
    title: "Netzwerk & WLAN",
    linkLabel: "Mehr zu Netzwerk und WLAN",
    audience: "Für Unternehmen und Privatkunden",
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
  },
  {
    id: "microsoft-365",
    icon: "mail",
    title: "Microsoft 365 & E-Mail",
    linkLabel: "Mehr zu Microsoft 365",
    audience: "Für Unternehmen",
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
  },
  {
    id: "server-backup",
    icon: "server",
    title: "Server & Datensicherung",
    linkLabel: "Mehr zu Server und Datensicherung",
    audience: "Für Unternehmen",
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
  },
  {
    id: "sicherheit",
    icon: "shield",
    title: "IT-Sicherheit",
    linkLabel: "Mehr zu IT-Sicherheit",
    audience: "Für Unternehmen und Privatkunden",
    short: "Virenschutz, Firewall, Updates und klare Regeln, wer worauf zugreifen darf.",
    text: [
      "Sicherheit besteht aus vielen kleinen Dingen, die zuverlässig erledigt werden müssen: Updates, ein zentral überwachter Virenschutz, eine sauber eingestellte Firewall und Benutzerkonten ohne unnötige Administratorrechte.",
      "Wenn trotzdem etwas passiert ist – eine verdächtige Rechnung wurde geöffnet, ein Passwort ist in falsche Hände geraten –, rufen Sie bitte gleich an. Wir trennen betroffene Geräte vom Netz und sagen Ihnen, was als Nächstes zu tun ist.",
    ],
    tasks: [
      "Virenschutz mit zentraler Übersicht",
      "Firewall und abgesicherte Fernzugänge",
      "Updates für Windows und Programme verwalten",
      "Verdächtige E-Mails und Anhänge prüfen",
      "Kurze Schulung: gefälschte E-Mails erkennen",
    ],
  },
  {
    id: "telefonie",
    icon: "phone",
    title: "Telefonie",
    linkLabel: "Mehr zu Telefonie",
    audience: "Für Unternehmen",
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
  },
];

/* ------------------------------------------------------------------ */
/* Startseite                                                          */
/* ------------------------------------------------------------------ */

const HOME: DefaultPageSource = {
  title: "Startseite",
  description:
    "{firma} betreut die IT kleiner Firmen und hilft Privatkunden bei PC, WLAN und Drucker. Störungen melden Firmenkunden im eigenen Kundenportal.",
  showInNav: false,
  showInFooter: false,
  navOrder: 0,
  blocks: [
    {
      id: "einstieg",
      type: "hero",
      visual: "portal",
      tone: "blue",
      eyebrow: "Für Firmen und Privatkunden",
      title: "IT-Service, bei dem Sie wissen, woran Sie sind",
      text: md(
        "Wir betreuen die IT kleiner und mittlerer Unternehmen – vom Arbeitsplatz über das Netzwerk bis zu Microsoft 365. Privatkunden helfen wir, wenn zu Hause der Laptop, das WLAN oder der Drucker nicht mitspielt.",
        "Jede Störung bekommt ein Ticket. Darin sehen Sie, wer sich darum kümmert und was gemacht wurde.",
        "**Steht bei Ihnen der Betrieb still?** Rufen Sie an: {telefon}. Andere Störungen melden Firmenkunden im Kundenportal.",
      ),
      primary: { label: "Anfrage stellen", href: "/kontakt" },
      secondary: { label: "Zum Kundenportal", href: "/login" },
    },
    {
      id: "zwei-wege",
      type: "split",
      tone: "white",
      title: "Für Firmen und für Privatleute",
      intro:
        "Firmen brauchen jemanden, der ihre IT kennt und dauerhaft im Blick behält. Privatleute brauchen meistens schnelle Hilfe bei einem konkreten Problem. Beides machen wir – aber nicht auf dieselbe Art.",
      panels: [
        {
          title: "Für Unternehmen",
          text: "Für Büros, Praxen, Kanzleien und Handwerksbetriebe ohne eigene IT-Abteilung – oder mit einer, die Verstärkung braucht.",
          points: [
            "Feste Ansprechpartner, die Ihre Umgebung kennen",
            "Kundenportal unter eigener Adresse, z. B. **{portal_beispiel}**",
            "Verbindliche Reaktionszeiten mit Betreuungsvertrag",
            "Eine Dokumentation Ihrer IT, die Ihnen gehört",
          ],
          link: { label: "Mehr für Unternehmen", href: "/unternehmen" },
        },
        {
          title: "Für Privatkunden",
          text: "Wenn zu Hause etwas nicht funktioniert und im Bekanntenkreis niemand weiterweiß – oder Sie nicht schon wieder fragen möchten.",
          points: [
            "Neuen PC oder Laptop einrichten, Daten vom alten Gerät übernehmen",
            "WLAN, Drucker und E-Mail-Programm wieder zum Laufen bringen",
            "Hilfe per Fernwartung oder als Termin bei Ihnen zu Hause",
            "Kein Konto nötig: Den Stand sehen Sie über einen persönlichen Link",
          ],
          link: { label: "Mehr für Privatkunden", href: "/privatkunden" },
        },
      ],
    },
    {
      id: "leistungen",
      type: "cards",
      tone: "white",
      layout: "columns",
      columns: 3,
      title: "Leistungen im Überblick",
      intro: md(
        "Von der Einrichtung eines einzelnen Notebooks bis zur Betreuung mehrerer Standorte. Liegt etwas außerhalb dessen, was wir gut können, sagen wir Ihnen das offen.",
        "[Alle Leistungen im Detail](/leistungen)",
      ),
      items: SERVICES.map((s) => ({
        title: s.title,
        text: s.short,
        icon: s.icon,
        link: { label: s.linkLabel, href: `/leistungen#${s.id}` },
      })),
    },
    {
      id: "ablauf",
      type: "steps",
      tone: "blue",
      layout: "cards",
      title: "So läuft eine Störungsmeldung ab",
      intro:
        "Vom Drucker, der nicht mehr druckt, bis zum ausgefallenen Server: Jede Störung läuft bei uns gleich ab. So weiß jeder, was als Nächstes passiert.",
      items: [
        {
          title: "Sie melden die Störung",
          text: "Im Kundenportal mit kurzer Beschreibung und gern einem Foto der Fehlermeldung. Oder Sie rufen an, dann legen wir das Ticket für Sie an.",
        },
        {
          title: "Wir melden uns",
          text: "Innerhalb der vereinbarten Reaktionszeit ruft ein Techniker zurück oder schreibt ins Ticket – oft mit ein, zwei Rückfragen.",
        },
        {
          title: "Fernwartung oder Termin vor Ort",
          text: "Vieles lässt sich per Fernwartung beheben, während Sie zusehen. Muss ein Gerät getauscht oder ein Kabel geprüft werden, kommen wir vorbei.",
        },
        {
          title: "Abschluss im Ticket",
          text: "Im Ticket steht, was die Ursache war und was wir geändert haben. Auch Monate später lässt sich das noch nachlesen.",
        },
      ],
    },
    {
      id: "kundenportal",
      type: "cards",
      tone: "white",
      layout: "rows",
      columns: 2,
      title: "Ein Portal für Ihre Firma – mit allen Standorten",
      intro: md(
        "Firmenkunden bekommen ein eigenes Kundenportal. Darin melden Ihre Mitarbeiter Störungen, stellen Anfragen und sehen, wie weit wir sind.",
        "[Mehr zum Kundenportal](/unternehmen#kundenportal) · [Zur Anmeldung](/login)",
      ),
      items: [
        {
          title: "Eine eigene Adresse für Ihre Firma",
          text: "Ihr Kundenportal erreichen Sie unter einer eigenen Subdomain, z. B. **{portal_beispiel}**. Dort melden sich nur Ihre Leute an, andere Kunden sehen davon nichts.",
        },
        {
          title: "Unterkunden – so viele Sie brauchen",
          text: "Filialen, Standorte, Abteilungen oder die Homeoffice-Gruppe legen Sie als Unterkunden an. Eine Obergrenze gibt es nicht.",
        },
        {
          title: "Jeder Mitarbeiter mit eigenem Zugang",
          text: "Kein gemeinsames Passwort für alle. Mitarbeiter sehen ihre eigenen Tickets, der Hauptansprechpartner sieht alle.",
        },
        {
          title: "Alles zu einem Problem an einem Ort",
          text: "Beschreibung, Screenshots, Rückfragen und Antworten stehen im Ticket. Niemand muss mehr alte E-Mails durchsuchen.",
        },
      ],
    },
    {
      id: "reaktionszeiten",
      type: "responseTimes",
      tone: "white",
      title: "Wie schnell wir uns melden",
      intro: "Je dringender das Problem, desto schneller sind wir dran. Die Dringlichkeit legen Sie beim Melden fest.",
      note: RESPONSE_NOTE,
    },
    {
      id: "abschluss",
      type: "cta",
      tone: "blue",
      title: "Erzählen Sie uns, worum es geht",
      text: "Schreiben Sie uns kurz, was los ist, oder rufen Sie während der Servicezeiten an. Sie sprechen dann direkt mit jemandem, der sich auskennt.",
      primary: CTA_DEFAULT_PRIMARY,
      secondary: CTA_DEFAULT_SECONDARY,
      showPhone: true,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Leistungen                                                          */
/* ------------------------------------------------------------------ */

const LEISTUNGEN: DefaultPageSource = {
  title: "Leistungen",
  description:
    "Arbeitsplätze, Netzwerk, Microsoft 365, Server, Datensicherung, IT-Sicherheit und Telefonie: was {firma} übernimmt und wie wir abrechnen.",
  navLabel: "Leistungen",
  showInNav: true,
  showInFooter: false,
  navOrder: 10,
  blocks: [
    {
      id: "kopf",
      type: "hero",
      visual: "none",
      tone: "blue",
      eyebrow: "Leistungen",
      title: "Was wir für Sie übernehmen",
      text: md(
        "Wir kümmern uns um Computer, Netzwerk und Telefon – im Büro und zu Hause. Manche Kunden rufen uns nur, wenn etwas kaputt ist. Andere geben uns die komplette Betreuung ihrer IT.",
        "Hier steht, was wir in den einzelnen Bereichen konkret tun – von [Arbeitsplätzen](#arbeitsplaetze) über [Netzwerk](#netzwerk), [Microsoft 365](#microsoft-365), [Server und Datensicherung](#server-backup) und [IT-Sicherheit](#sicherheit) bis zur [Telefonie](#telefonie).",
      ),
      primary: { label: "Anfrage stellen", href: "/kontakt" },
      secondary: { label: "Wie wir abrechnen", href: "#abrechnung" },
    },
    ...SERVICES.map(
      (s): DefaultBlockInput => ({
        id: `bereich-${s.id}`,
        type: "text",
        tone: "white",
        width: "wide",
        anchor: s.id,
        title: s.title,
        intro: s.audience,
        body: md(...s.text, "### Typische Aufgaben", list(...s.tasks)),
      }),
    ),
    {
      id: "abrechnung",
      type: "cards",
      tone: "blue",
      layout: "rows",
      columns: 2,
      anchor: "abrechnung",
      title: "Wie wir abrechnen",
      intro: md(
        "Sie sollen vorher wissen, worauf Sie sich einlassen. Deshalb rechnen wir nachvollziehbar ab und sprechen größere Arbeiten vorher mit Ihnen ab.",
        "Auf der Rechnung steht, wann wir was gemacht haben – mit Verweis auf das passende Ticket. Unsere aktuellen Preise nennen wir Ihnen gern am Telefon oder im Angebot.",
      ),
      items: [
        {
          title: "Arbeitszeit",
          text: "Nach tatsächlichem Aufwand, abgerechnet im 15-Minuten-Takt. Eine kurze Fernwartung kostet also nicht gleich eine volle Stunde.",
        },
        {
          title: "Anfahrt",
          text: "Für Termine vor Ort berechnen wir eine Anfahrtspauschale. Die Höhe nennen wir Ihnen vorher.",
        },
        {
          title: "Material und Hardware",
          text: "Nach Absprache. Bei größeren Anschaffungen bekommen Sie vorher ein Angebot und entscheiden selbst.",
        },
        {
          title: "Betreuungsvertrag",
          text: "Firmenkunden können einen Vertrag mit festen Reaktionszeiten abschließen. Was er umfasst, steht schwarz auf weiß im Angebot.",
        },
      ],
    },
    {
      id: "abschluss",
      type: "cta",
      tone: "blue",
      title: "Nicht sicher, ob wir das machen?",
      text: "Fragen Sie einfach. Beschreiben Sie kurz, worum es geht. Wir sagen Ihnen, ob wir helfen können und was ungefähr auf Sie zukommt.",
      primary: CTA_DEFAULT_PRIMARY,
      secondary: CTA_DEFAULT_SECONDARY,
      showPhone: true,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Für Unternehmen                                                     */
/* ------------------------------------------------------------------ */

const UNTERNEHMEN: DefaultPageSource = {
  title: "IT-Betreuung für Unternehmen",
  description:
    "IT-Betreuung für kleine und mittlere Unternehmen: feste Ansprechpartner, eigenes Kundenportal, Unterkunden für Standorte, verbindliche Reaktionszeiten.",
  navLabel: "Für Unternehmen",
  showInNav: true,
  showInFooter: false,
  navOrder: 20,
  blocks: [
    {
      id: "kopf",
      type: "hero",
      visual: "none",
      tone: "blue",
      eyebrow: "Für Unternehmen",
      title: "IT-Betreuung für Firmen ohne eigene IT-Abteilung",
      text: "Wir betreuen Firmen mit fünf bis fünfzig Arbeitsplätzen, gern auch mit mehreren Standorten. Wir kümmern uns laufend um Ihre IT, kennen Ihre Umgebung und sind erreichbar, wenn etwas nicht funktioniert.",
      primary: { label: "Erstgespräch anfragen", href: "/kontakt" },
      secondary: { label: "Zum Kundenportal", href: "/login" },
    },
    {
      id: "kurz",
      type: "checklist",
      tone: "blue",
      eyebrow: "Kurz zusammengefasst",
      items: [
        "Feste Ansprechpartner, die Ihre Umgebung kennen",
        "Eigenes Kundenportal, z. B. **{portal_beispiel}**",
        "Unterkunden für Filialen, Standorte und Homeoffice",
        "Verbindliche Reaktionszeiten mit Betreuungsvertrag",
        "Dokumentation, die Ihnen gehört",
      ],
    },
    {
      id: "betreuung",
      type: "cards",
      tone: "white",
      layout: "rows",
      columns: 2,
      title: "Was zur laufenden Betreuung gehört",
      intro:
        "Ein großer Teil der Betreuung passiert, bevor etwas kaputtgeht. Darum kümmern wir uns laufend:",
      items: [
        {
          title: "Überwachung",
          text: "Wir behalten Datensicherung, Virenschutz und Speicherplatz im Blick und reagieren, wenn etwas nicht stimmt – oft, bevor Sie es bemerken.",
        },
        {
          title: "Updates",
          text: "Updates für Windows, Server und Programme spielen wir geplant ein. Muss neu gestartet werden, dann außerhalb Ihrer Kernarbeitszeit.",
        },
        {
          title: "Neue und ausscheidende Mitarbeiter",
          text: "Neue Mitarbeiter bekommen pünktlich ihren Arbeitsplatz und ihre Zugänge. Wer das Unternehmen verlässt, wird am letzten Tag überall gesperrt.",
        },
        {
          title: "Wir telefonieren für Sie",
          text: "Wir sprechen für Sie mit dem Internetanbieter, dem Kopierer-Service oder dem Hersteller Ihrer Branchensoftware.",
        },
        {
          title: "Vorausplanen",
          text: "Garantien, Lizenzen und das Alter Ihrer Geräte haben wir im Blick und sagen rechtzeitig, was bald ersetzt werden sollte.",
        },
        {
          title: "Dokumentation",
          text: "Geräte, Netzwerk, Zugänge und Sicherungen sind dokumentiert – verständlich auch für jemanden, der Ihre IT nicht kennt.",
        },
      ],
    },
    {
      id: "kundenportal",
      type: "text",
      tone: "blue",
      width: "narrow",
      anchor: "kundenportal",
      title: "Ihr eigenes Portal unter eigener Adresse",
      body: md(
        "Jeder Firmenkunde bekommt ein Kundenportal mit eigener Subdomain, zum Beispiel **{portal_beispiel}**. Dort melden Ihre Mitarbeiter Störungen, stellen Anfragen, laden Screenshots hoch und lesen unsere Antworten.",
        "Für Filialen, Standorte, Abteilungen oder eine Homeoffice-Gruppe legen Sie Unterkunden an – so viele, wie Sie brauchen. Jede Unterkunde hat eigene Benutzer und eigene Tickets, gemeldet wird über dieselbe Adresse.",
      ),
    },
    {
      id: "rollen",
      type: "cards",
      tone: "blue",
      layout: "columns",
      columns: 3,
      title: "Wer im Portal was sieht",
      intro: "Jeder bekommt einen eigenen Zugang. Was jemand sehen und tun darf, hängt von seiner Rolle ab.",
      items: [
        {
          title: "Hauptansprechpartner der Firma",
          text: md(
            "Meist die Geschäftsführung oder Büroleitung.",
            list(
              "Sieht alle Tickets der Firma und aller Unterkunden",
              "Lädt Mitarbeiter ein und sperrt Zugänge",
              "Legt Unterkunden an, z. B. eine neue Filiale",
            ),
          ),
        },
        {
          title: "Hauptansprechpartner einer Unterkunde",
          text: md(
            "Zum Beispiel die Leitung einer Filiale. Sieht nur den eigenen Standort.",
            list(
              "Sieht alle Tickets dieser Unterkunde",
              "Lädt Mitarbeiter des Standorts ein und sperrt Zugänge",
              "Meldet Störungen und stellt Anfragen für den Standort",
            ),
          ),
        },
        {
          title: "Mitarbeiter",
          text: md(
            "Alle, die Probleme melden sollen.",
            list(
              "Meldet Störungen und stellt Anfragen",
              "Sieht nur die eigenen Tickets",
              "Bekommt Antworten per E-Mail und im Portal",
            ),
          ),
        },
      ],
    },
    {
      id: "zusammenarbeit",
      type: "steps",
      tone: "white",
      layout: "list",
      title: "Wie eine Zusammenarbeit beginnt",
      intro:
        "Bevor wir Verantwortung für Ihre IT übernehmen, müssen wir sie kennen. Deshalb beginnt jede Zusammenarbeit mit denselben vier Schritten.",
      items: [
        {
          title: "Kennenlernen",
          text: "Sie erzählen uns, wie Ihre Firma arbeitet und wo es hakt. Wir fragen nach Arbeitsplätzen, Standorten, Programmen und bisheriger Betreuung.",
        },
        {
          title: "Bestandsaufnahme vor Ort",
          text: "Wir sehen uns Server, Netzwerk, Arbeitsplätze, Datensicherung und Zugänge an. Was dringend ist, sagen wir Ihnen sofort – nicht erst im Bericht.",
        },
        {
          title: "Dokumentation und Angebot",
          text: "Sie bekommen eine Dokumentation Ihrer IT und ein Angebot für die Betreuung mit Reaktionszeiten. Die Dokumentation gehört Ihnen, egal wie Sie sich entscheiden.",
        },
        {
          title: "Laufende Betreuung",
          text: "Wir richten Ihr Kundenportal ein, laden Ihre Mitarbeiter ein und übernehmen Überwachung, Updates und Störungen.",
        },
      ],
    },
    {
      id: "reaktionszeiten",
      type: "responseTimes",
      tone: "blue",
      anchor: "reaktionszeiten",
      title: "Reaktionszeiten nach Dringlichkeit",
      intro: "Beim Melden wählen Sie, wie dringend es ist. Danach richtet sich, wie schnell wir uns melden.",
      note: RESPONSE_NOTE,
    },
    {
      id: "fragen",
      type: "faq",
      tone: "white",
      title: "Was Firmen uns oft fragen",
      intro: "Ihre Frage ist nicht dabei? Rufen Sie an unter {telefon} oder schreiben Sie uns über das [Kontaktformular](/kontakt).",
      items: [
        {
          question: "Was passiert, wenn unser bisheriger Dienstleister nicht mehr verfügbar ist?",
          answer: md(
            "Dann starten wir mit einer Bestandsaufnahme und klären zuerst, ob alle wichtigen Zugänge vorhanden sind: Router und Firewall, Server, Microsoft 365, Domain und Datensicherung. Fehlt etwas, stellen wir den Zugriff gemeinsam mit den Herstellern und Anbietern wieder her.",
            "Ist gerade etwas ausgefallen, kümmern wir uns zuerst darum und machen die Bestandsaufnahme danach.",
          ),
        },
        {
          question: "Können Filialen getrennt Tickets stellen?",
          answer:
            "Ja. Jede Filiale wird als Unterkunde angelegt und bekommt eigene Benutzer. Die Tickets sind dann der Filiale zugeordnet. Der Hauptansprechpartner der Firma sieht trotzdem alle. Soll eine Filialleitung nur die Tickets ihres Standorts sehen, wird sie Hauptansprechpartnerin dieser Unterkunde.",
        },
        {
          question: "Wer sieht unsere Tickets?",
          answer:
            "Mitarbeiter sehen ihre eigenen Tickets, Hauptansprechpartner alle Tickets ihrer Firma bzw. ihrer Unterkunde. Bei {firma} sehen unsere Techniker Ihre Tickets, denn sie bearbeiten sie. Andere Kunden haben keinen Zugriff: Jedes Kundenportal ist von den anderen getrennt, die Anmeldung funktioniert nur unter Ihrer eigenen Adresse.",
        },
        {
          question: "Brauchen wir einen Betreuungsvertrag?",
          answer:
            "Nicht zwingend. Sie können uns auch nur bei Bedarf beauftragen und nach Aufwand bezahlen. Die [Reaktionszeiten](#reaktionszeiten) gelten allerdings nur mit Vertrag. Ohne Vertrag bearbeiten wir Ihre Meldung so schnell, wie es die übrigen Termine zulassen.",
        },
        {
          question: "Wie rechnen Sie ab?",
          answer:
            "Arbeitszeit nach Aufwand im 15-Minuten-Takt, Anfahrt pauschal, Material nach Absprache. Was ein Betreuungsvertrag umfasst, steht im Angebot. Mehr dazu unter [Wie wir abrechnen](/leistungen#abrechnung).",
        },
        {
          question: "Können wir neue Mitarbeiter selbst ins Portal einladen?",
          answer:
            "Ja. Hauptansprechpartner laden neue Benutzer im Portal per E-Mail ein und sperren Zugänge von Mitarbeitern, die das Unternehmen verlassen. Das Benutzerkonto in Microsoft 365 oder auf dem Server richten wir für Sie ein – am einfachsten über ein Ticket vom Typ „Anfrage“.",
        },
        {
          question: "Was passiert, wenn wir die Zusammenarbeit beenden?",
          answer:
            "Sie bekommen die Dokumentation Ihrer IT und alle Zugangsdaten. Wenn Sie zu einem anderen Dienstleister wechseln, übergeben wir geordnet und beantworten dessen Fragen.",
        },
      ],
    },
    {
      id: "abschluss",
      type: "cta",
      tone: "blue",
      title: "Erzählen Sie uns von Ihrer Firma",
      text: "Schreiben Sie uns kurz, wie viele Arbeitsplätze Sie haben und was Sie gerade beschäftigt. Wir melden uns und vereinbaren ein erstes Gespräch – am Telefon oder bei Ihnen vor Ort.",
      primary: CTA_DEFAULT_PRIMARY,
      secondary: CTA_DEFAULT_SECONDARY,
      showPhone: true,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Für Privatkunden                                                    */
/* ------------------------------------------------------------------ */

const PRIVATKUNDEN: DefaultPageSource = {
  title: "Computerhilfe für Privatkunden",
  description:
    "Hilfe zu Hause bei PC, Laptop, WLAN, Drucker und verdächtigen E-Mails – per Fernwartung oder vor Ort. Formular ohne Konto, mit persönlichem Status-Link.",
  navLabel: "Für Privatkunden",
  showInNav: true,
  showInFooter: false,
  navOrder: 30,
  blocks: [
    {
      id: "kopf",
      type: "hero",
      visual: "none",
      tone: "blue",
      eyebrow: "Für Privatkunden",
      title: "Hilfe bei Computerproblemen zu Hause",
      text: md(
        "Der neue Laptop soll eingerichtet werden, der Drucker druckt nicht mehr oder eine E-Mail kommt Ihnen merkwürdig vor? Schildern Sie uns das Problem im Formular. Wir melden uns, helfen per Fernwartung oder kommen zu Ihnen.",
        "**Lieber anrufen?** {telefon}",
      ),
      primary: { label: "Problem schildern", href: "#hilfe-anfordern" },
    },
    {
      id: "gut-zu-wissen",
      type: "checklist",
      tone: "blue",
      eyebrow: "Gut zu wissen",
      items: [
        "Sie brauchen kein Kundenkonto und kein Passwort.",
        "Den Stand Ihres Tickets sehen Sie über einen persönlichen Link, den wir Ihnen per E-Mail schicken.",
        "Abgerechnet wird nach Aufwand im 15-Minuten-Takt. Vor-Ort-Termine kosten zusätzlich eine Anfahrtspauschale.",
      ],
    },
    {
      id: "hilfe",
      type: "cards",
      tone: "white",
      layout: "columns",
      columns: 3,
      title: "Wobei wir zu Hause helfen",
      intro:
        "Die Liste ist nicht vollständig. Wenn Ihr Problem nicht dabei ist, beschreiben Sie es trotzdem – wir sagen Ihnen, ob wir helfen können.",
      items: [
        {
          icon: "monitor",
          title: "PC oder Laptop einrichten",
          text: "Windows einrichten, Updates einspielen, unnötige vorinstallierte Programme entfernen und die Programme installieren, die Sie wirklich brauchen.",
        },
        {
          icon: "network",
          title: "Daten übertragen",
          text: "Fotos, Dokumente, E-Mails und Lesezeichen vom alten auf das neue Gerät. Danach prüfen wir mit Ihnen zusammen, ob alles da ist.",
        },
        {
          icon: "wifi",
          title: "WLAN und Internet",
          text: "Kein Empfang im Arbeitszimmer, Router nach dem Anbieterwechsel neu einrichten, Repeater oder Mesh-System aufstellen.",
        },
        {
          icon: "printer",
          title: "Drucker und Scanner",
          text: "Drucker ins WLAN bringen, Scannen auf den PC einrichten, Fehlermeldungen und Treiberprobleme beheben.",
        },
        {
          icon: "shield",
          title: "Viren und verdächtige E-Mails",
          text: "Wir schauen uns an, ob eine Nachricht echt ist, prüfen Ihr Gerät und helfen nach einem Betrugsversuch, Passwörter zu ändern und Konten zu sichern.",
        },
        {
          icon: "headset",
          title: "Fernhilfe",
          text: "Vieles klären wir per Fernwartung, ohne dass jemand vorbeikommen muss. Sie sehen auf Ihrem Bildschirm, was wir tun.",
        },
      ],
    },
    {
      id: "ablauf",
      type: "steps",
      tone: "blue",
      layout: "list",
      title: "So läuft die Hilfe ab",
      intro: "Sie brauchen weder ein Konto noch eine App. Nach drei Schritten ist Ihr Problem in Arbeit.",
      items: [
        {
          title: "Formular ausfüllen",
          text: "Beschreiben Sie, was nicht funktioniert und seit wann. Ein Foto der Fehlermeldung hilft uns sehr. Danach bekommen Sie eine E-Mail mit Ihrem persönlichen Status-Link.",
        },
        {
          title: "Wir melden uns",
          text: "In der Regel innerhalb eines Werktags, telefonisch oder per Nachricht. Oft haben wir zuerst ein, zwei Fragen, um das Problem einzugrenzen.",
        },
        {
          title: "Fernhilfe oder Termin",
          text: "Lässt sich das Problem aus der Ferne lösen, verbinden wir uns nach Absprache mit Ihrem Gerät. Sonst vereinbaren wir einen Termin bei Ihnen zu Hause.",
        },
      ],
    },
    {
      id: "status-link",
      type: "text",
      tone: "blue",
      width: "note",
      title: "Was der Status-Link kann",
      body: "Über den Link aus unserer E-Mail sehen Sie jederzeit, wie weit wir sind, lesen unsere Antworten und können selbst antworten. Geben Sie den Link bitte nicht weiter – wer ihn kennt, kann Ihr Ticket lesen.",
    },
    {
      id: "formular",
      type: "privateSupportForm",
      tone: "white",
      anchor: "hilfe-anfordern",
      title: "Problem schildern",
      intro: md(
        "Beschreiben Sie in Ruhe, was los ist. Je genauer die Beschreibung, desto schneller können wir helfen.",
        "## Das hilft uns weiter",
        list(
          "Um welches Gerät geht es (z. B. Laptop, Drucker), und welches Modell?",
          "Der genaue Wortlaut der Fehlermeldung – oder ein Foto davon",
          "Seit wann tritt das Problem auf, und was hat sich davor geändert?",
          "Was Sie selbst schon ausprobiert haben",
        ),
        "**Dringend?** Rufen Sie uns während der Servicezeiten an: {telefon}",
        "**Link verloren?** Unter [Status-Link anfordern](/status) schicken wir ihn erneut an Ihre E-Mail-Adresse.",
      ),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Über uns                                                            */
/* ------------------------------------------------------------------ */

const UEBER_UNS: DefaultPageSource = {
  title: "Über uns",
  description:
    "Wer {firma} ist und wie wir arbeiten: verständliche Erklärungen, saubere Dokumentation, feste Ansprechpartner und ehrliche Empfehlungen.",
  navLabel: "Über uns",
  showInNav: true,
  showInFooter: false,
  navOrder: 40,
  blocks: [
    {
      id: "kopf",
      type: "hero",
      visual: "none",
      tone: "blue",
      eyebrow: "Über uns",
      title: "IT für Leute, die eigentlich etwas anderes zu tun haben",
      text: "{firma} ist ein IT-Dienstleister für kleine und mittlere Unternehmen und für Privatkunden. Wir arbeiten für Firmen ohne eigene IT-Abteilung – etwa Büros, Praxen, Kanzleien und Handwerksbetriebe – und für Menschen, die zu Hause einfach wollen, dass der Computer funktioniert.",
      primary: { label: "Anfrage stellen", href: "/kontakt" },
      secondary: { label: "Unsere Leistungen", href: "/leistungen" },
    },
    {
      id: "arbeitsweise",
      type: "text",
      tone: "white",
      width: "wide",
      title: "Wie wir arbeiten",
      intro:
        "Diese vier Grundsätze gelten bei uns für jeden Auftrag, vom einzelnen Notebook bis zum Server.",
      body: md(
        "## Wir erklären, was wir tun",
        "Sie müssen kein Technikexperte werden. Aber Sie sollen verstehen, warum ein Gerät ersetzt werden muss oder was eine Änderung bringt, bevor wir loslegen.",
        "Im Ticket steht hinterher in normalen Worten, was die Ursache war und was wir geändert haben.",
        "## Wir dokumentieren Ihre IT so, dass auch ein anderer Dienstleister damit arbeiten könnte",
        "Geräteliste, Netzwerkplan, Zugänge und Sicherungskonzept liegen geordnet vor und gehören Ihnen.",
        "Das macht Sie unabhängig von uns. Wir finden: Kunden sollen bleiben, weil sie zufrieden sind, nicht weil nur wir wissen, wie alles zusammenhängt.",
        "## Sie haben feste Ansprechpartner",
        "Jeder Firmenkunde hat bei uns feste Techniker, die seine Umgebung und seine Mitarbeiter kennen. Sie müssen nicht bei jedem Anruf neu erklären, wie Ihr Netzwerk aufgebaut ist oder welches Programm in der Buchhaltung läuft.",
        "## Wir sagen auch, wenn sich etwas nicht lohnt",
        "Manchmal ist ein neues Gerät günstiger als die Reparatur. Manchmal ist es umgekehrt, und das fünf Jahre alte Notebook läuft mit einer neuen SSD noch ein paar Jahre gut.",
        "Wir empfehlen, was für Sie sinnvoll ist – auch wenn es der kleinere Auftrag ist.",
      ),
    },
    {
      id: "einsatzgebiet",
      type: "contact",
      tone: "blue",
      title: "Wo wir unterwegs sind",
      intro: md(
        "Für Termine vor Ort fahren wir zu Firmen und Privatkunden in unserer Region. Fernwartung funktioniert dagegen unabhängig vom Ort – vorausgesetzt, das Gerät hat eine Internetverbindung.",
        "Sie sind unsicher, ob Ihr Ort zu unserem Einsatzgebiet gehört? Fragen Sie kurz nach, bevor Sie eine Anfrage schreiben.",
      ),
      showAddress: true,
      showHours: true,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Support                                                             */
/* ------------------------------------------------------------------ */

const SUPPORT: DefaultPageSource = {
  title: "Support für Bestandskunden",
  description:
    "Störung melden, Status einer Anfrage abrufen, Fernwartung starten: der schnellste Weg zu {firma} für Firmen- und Privatkunden.",
  navLabel: "Support",
  showInNav: false,
  showInFooter: true,
  navOrder: 93,
  blocks: [
    {
      id: "kopf",
      type: "hero",
      visual: "none",
      tone: "blue",
      eyebrow: "Support",
      title: "Hilfe für Bestandskunden",
      text: md(
        "Hier finden Sie den schnellsten Weg zu uns – je nachdem, ob Sie als Firma unser Kundenportal nutzen oder als Privatkunde eine Anfrage gestellt haben.",
        "Noch kein Kunde? Dann schreiben Sie uns über das [Kontaktformular](/kontakt).",
      ),
    },
    {
      id: "wege",
      type: "split",
      tone: "white",
      panels: [
        {
          title: "Firmenkunden",
          text: md(
            "Melden Sie Störungen und Anfragen im Kundenportal Ihrer Firma. Dort sehen Sie auch, wie weit wir mit Ihren Tickets sind, und können Screenshots oder Dokumente anhängen.",
            "Ihre Portal-Adresse steht in Ihrer Einladungs-E-Mail, zum Beispiel **{portal_beispiel}**. Kennen Sie nur das Kürzel Ihrer Firma, hilft Ihnen die Anmeldeseite weiter.",
          ),
          points: [],
          link: { label: "Zum Kundenportal", href: "/login" },
        },
        {
          title: "Privatkunden",
          text: md(
            "Neues Problem? Schildern Sie es im Formular für Privatkunden, ein Konto brauchen Sie dafür nicht.",
            "Sie haben schon ein Ticket? Den Stand sehen Sie über den persönlichen Link aus unserer Bestätigungs-E-Mail. Wenn Sie die E-Mail nicht mehr finden, schicken wir Ihnen den Link erneut zu: [Status-Link anfordern](/status)",
          ),
          points: [],
          link: { label: "Problem schildern", href: "/privatkunden#hilfe-anfordern" },
        },
      ],
    },
    {
      id: "fernwartung",
      type: "steps",
      tone: "white",
      layout: "list",
      anchor: "fernwartung",
      title: "So funktioniert die Fernwartung",
      intro:
        "Bei einer Fernwartung sehen wir Ihren Bildschirm und können Maus und Tastatur bedienen. So lassen sich viele Probleme lösen, ohne dass jemand vorbeikommen muss.",
      items: [
        { title: "Anrufen", text: "Rufen Sie uns an, oder wir rufen Sie zum vereinbarten Termin an." },
        {
          title: "Programm starten",
          text: "Klicken Sie unten auf „Fernwartung herunterladen“ und öffnen Sie die Datei. Installieren müssen Sie in der Regel nichts.",
        },
        { title: "ID durchgeben", text: "Das Programm zeigt eine ID und ein Kennwort. Lesen Sie uns beides am Telefon vor." },
        {
          title: "Zusehen",
          text: "Sie sehen alles, was wir tun, und können die Verbindung jederzeit beenden. Schließen Sie danach das Programm – ohne es kommen wir nicht auf Ihren Rechner.",
        },
      ],
    },
    {
      id: "fernwartung-start",
      type: "cta",
      tone: "dark",
      title: "Nur nach Absprache am Telefon",
      text: "Starten Sie eine Fernwartung nur, wenn Sie gerade mit uns telefonieren oder einen Termin vereinbart haben. Wir fordern Sie nie unangekündigt dazu auf. Ruft jemand unaufgefordert an, gibt sich als {firma}, Microsoft oder Ihre Bank aus und will auf Ihren Rechner: auflegen und uns Bescheid geben.",
      primary: { label: "Fernwartung herunterladen", href: "{fernwartung}" },
      showPhone: false,
    },
    {
      id: "erreichbarkeit",
      type: "contact",
      tone: "blue",
      title: "Telefon und Servicezeiten",
      intro: md(
        "**Wenn nichts mehr geht:** Steht der Betrieb still, rufen Sie bitte an, statt nur ein Ticket zu schreiben.",
        "**Per E-Mail** an {support_email} erreichen Sie uns für alles, was nicht eilt. Störungen melden Firmenkunden bitte im Kundenportal, Privatkunden über das Formular.",
        "Tickets und Formulare können Sie jederzeit abschicken. Was außerhalb der Servicezeiten eingeht, bearbeiten wir ab Beginn der nächsten.",
        "Wie schnell wir uns bei Firmenkunden mit Betreuungsvertrag melden, steht in der Übersicht der [Reaktionszeiten](/unternehmen#reaktionszeiten).",
      ),
      showAddress: false,
      showHours: true,
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Kontakt                                                             */
/* ------------------------------------------------------------------ */

const KONTAKT: DefaultPageSource = {
  title: "Kontakt und Anfrage",
  description:
    "Schreiben Sie uns, was ansteht – IT-Betreuung für Ihre Firma oder Hilfe für zu Hause. Wir melden uns in der Regel innerhalb eines Werktags.",
  navLabel: "Kontakt",
  showInNav: true,
  showInFooter: false,
  navOrder: 50,
  blocks: [
    {
      id: "kopf",
      type: "hero",
      visual: "none",
      tone: "blue",
      eyebrow: "Kontakt",
      title: "Schreiben Sie uns, was ansteht",
      text: md(
        "Sie suchen jemanden, der sich dauerhaft um die IT Ihrer Firma kümmert? Oder Sie brauchen Hilfe mit einem neuen Notebook? Schildern Sie kurz Ihr Anliegen.",
        "Wir melden uns in der Regel innerhalb eines Werktags – bei Firmen meist mit einem Terminvorschlag für ein erstes Kennenlernen.",
      ),
    },
    {
      id: "bestandskunden",
      type: "cards",
      tone: "blue",
      layout: "columns",
      columns: 2,
      items: [
        {
          icon: "building",
          title: "Schon Firmenkunde bei uns?",
          text: "Störungen und Anfragen melden Sie im Kundenportal Ihrer Firma. Dort sehen Sie auch den Stand aller Tickets. Steht der Betrieb still, rufen Sie bitte an.",
          link: { label: "Zum Kundenportal", href: "/login" },
        },
        {
          icon: "home",
          title: "Privat und es klemmt gerade?",
          text: "Wenn PC, Drucker oder WLAN streiken, nutzen Sie bitte das Hilfe-Formular für Privatkunden. Sie bekommen sofort eine Ticketnummer und einen Link, über den Sie den Stand sehen.",
          link: { label: "Zum Hilfe-Formular", href: "/privatkunden#hilfe-anfordern" },
        },
      ],
    },
    {
      id: "anfrage",
      type: "inquiryForm",
      tone: "white",
      anchor: "anfrage",
      title: "Ihre Anfrage",
      defaultType: "BUSINESS",
      intro: md(
        "Felder ohne den Zusatz „optional“ brauchen wir, um Ihnen antworten zu können.",
        "## So geht es weiter",
        numbered(
          "Sie bekommen direkt eine Bestätigung per E-Mail mit Ihrer Anfragenummer und einem persönlichen Link, über den Sie uns schreiben können.",
          "Wir melden uns in der Regel innerhalb eines Werktags – so, wie Sie es im Formular wählen.",
          "Firmen bekommen meist einen Terminvorschlag für ein erstes Gespräch. Bei Privatkunden klären wir, ob wir per Fernwartung helfen können oder vorbeikommen.",
        ),
        "Link zu Ihrer Anfrage verloren? Rufen Sie uns kurz an unter {telefon}, dann schicken wir ihn noch einmal. Den Status-Link zu einem Ticket aus dem Hilfe-Formular für Privatkunden können Sie [selbst neu anfordern](/status).",
      ),
    },
    {
      id: "direkt",
      type: "contact",
      tone: "blue",
      title: "Lieber direkt?",
      intro:
        "Rufen Sie uns an oder schreiben Sie eine E-Mail. Während der Servicezeiten sprechen Sie direkt mit jemandem, der sich auskennt.",
      showAddress: true,
      showHours: true,
    },
    {
      // Erscheint nur, wenn unter Verwaltung › Standorte Standorte für die Website eingetragen sind
      id: "standorte",
      type: "locations",
      tone: "white",
      anchor: "standorte",
      title: "Unsere Standorte",
      intro:
        "Sie möchten ein Gerät vorbeibringen oder abholen? Rufen Sie bitte vorher kurz am jeweiligen Standort an, damit jemand für Sie da ist.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Impressum                                                           */
/* ------------------------------------------------------------------ */

const IMPRESSUM: DefaultPageSource = {
  title: "Impressum",
  description: "Anbieterkennzeichnung von {firmierung} nach § 5 DDG.",
  navLabel: "Impressum",
  showInNav: false,
  showInFooter: true,
  navOrder: 90,
  blocks: [
    { id: "kopf", type: "hero", visual: "none", tone: "blue", eyebrow: "Rechtliches", title: "Impressum" },
    { id: "angaben", type: "companyInfo", variant: "impressum", tone: "white", title: "Angaben gemäß § 5 DDG" },
    {
      id: "hinweise",
      type: "text",
      tone: "white",
      width: "narrow",
      body: md(
        "## Verbraucherstreitbeilegung",
        "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
        "## Haftung für Links",
        "Unsere Website enthält Links zu Websites anderer Anbieter, zum Beispiel zur Download-Seite des Fernwartungsprogramms. Für deren Inhalte sind ausschließlich die jeweiligen Anbieter verantwortlich. Zum Zeitpunkt der Verlinkung haben wir keine Rechtsverstöße erkannt. Werden uns solche bekannt, entfernen wir den Link umgehend.",
        "## Urheberrecht",
        "Texte, Grafiken und Gestaltung dieser Website sind urheberrechtlich geschützt. Wenn Sie Inhalte über das gesetzlich Erlaubte hinaus verwenden möchten, etwa auf einer eigenen Website, fragen Sie bitte vorher bei uns nach. Stammen Inhalte von Dritten, beachten wir deren Rechte. Fällt Ihnen trotzdem eine Verletzung auf, geben Sie uns bitte Bescheid – wir entfernen den Inhalt dann umgehend.",
        "## Datenschutz",
        "Wie wir mit personenbezogenen Daten umgehen, erklären wir in unserer [Datenschutzerklärung](/datenschutz).",
      ),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Datenschutzerklärung                                                */
/* ------------------------------------------------------------------ */

const DATENSCHUTZ_TEIL_1 = md(
  "## 2. Das Wichtigste in Kürze",
  list(
    "Wir verarbeiten Ihre Daten nur, soweit das für die Website, Ihre Anfrage oder unseren Vertrag nötig ist.",
    "Wir setzen keine Analyse-, Tracking- oder Werbedienste ein. Schriftarten und Grafiken liegen auf unserem eigenen Server, es werden keine Inhalte von Drittanbietern nachgeladen.",
    "Texte gehen nur dann an einen Übersetzungsdienst, wenn die maschinelle Übersetzung genutzt wird (Abschnitt 9).",
    "Gesprächsinhalte von Telefonaten zeichnen wir nicht auf.",
    "Wir verkaufen keine Daten und geben sie nur weiter, wenn es für die Bearbeitung nötig ist.",
  ),

  "## 3. Hosting und Server-Logdateien",
  "Website und Kundenportal werden bei folgendem Anbieter betrieben: {hosting}.",
  "Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO. Er verarbeitet die Daten nur nach unserer Weisung.",
  "Bei jedem Aufruf einer Seite speichert der Server automatisch technische Angaben in Logdateien: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, übertragene Datenmenge, Statuscode sowie Browser und Betriebssystem (User-Agent). Wir brauchen diese Angaben, um die Website sicher zu betreiben und Fehler zu finden. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse ist ein sicherer und stabiler Betrieb.",
  "Die Logdateien werden nach spätestens {log_tage} Tagen gelöscht, es sei denn, ein konkreter Sicherheitsvorfall muss länger aufgeklärt werden.",
  "Um unsere Formulare vor massenhaften automatischen Einsendungen zu schützen, zählen wir kurzzeitig, wie oft von einer IP-Adresse Formulare abgeschickt werden. Diese Zählung liegt nur im Arbeitsspeicher des Servers und wird nicht dauerhaft gespeichert (Art. 6 Abs. 1 lit. f DSGVO).",

  "## 4. Kontaktformular und Anfragen",
  "Wenn Sie uns über das [Kontaktformular](/kontakt) eine Anfrage schicken, verarbeiten wir die Angaben aus dem Formular: Name, gegebenenfalls Firma, E-Mail-Adresse, Telefonnummer, Postleitzahl und Ort, Thema, Anzahl der Arbeitsplätze, Ihre Nachricht und den gewünschten Kontaktweg. Ohne die Pflichtangaben können wir Ihre Anfrage nicht bearbeiten.",
  "Wir nutzen die Daten, um Ihre Anfrage zu beantworten und gegebenenfalls ein Angebot zu erstellen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen) und, soweit es nicht um einen Vertrag geht, Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, Anfragen zu beantworten).",
  "Beim Absenden bestätigen Sie außerdem Ihre Einwilligung, dass wir Ihre Angaben dafür speichern (Art. 6 Abs. 1 lit. a DSGVO). Sie können diese Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, eine formlose E-Mail genügt. Angaben, die wir für einen laufenden Auftrag oder aufgrund gesetzlicher Pflichten weiter benötigen, löschen wir erst, wenn diese Gründe entfallen.",
  "Wenn Sie Privatkunde sind und über das [Formular für Privatkunden](/privatkunden#hilfe-anfordern) Hilfe anfordern, verarbeiten wir Ihren Namen, Ihre E-Mail-Adresse und Telefonnummer, die Problembeschreibung, gegebenenfalls Ihre Anschrift für einen Termin vor Ort und Ihre Angaben dazu, wann wir Sie am besten erreichen, sowie die Dateien, die Sie anhängen. Daraus entsteht ein Ticket, das wir zur Erfüllung des Auftrags bearbeiten (Art. 6 Abs. 1 lit. b DSGVO).",

  "## 5. Persönlicher Link zu Ihrer Anfrage",
  "Nach dem Absenden einer Anfrage über das Kontaktformular bekommen Sie per E-Mail einen persönlichen Link. Darüber können Sie uns zu Ihrer Anfrage schreiben und unsere Antworten lesen, ohne ein Konto anzulegen. Der Link enthält einen zufällig erzeugten, nicht erratbaren Schlüssel. Wer ihn kennt, kann den Verlauf lesen und Nachrichten schreiben – geben Sie ihn deshalb bitte nicht weiter.",
  "Wir speichern die Nachrichten zusammen mit Ihrer Anfrage, jeweils mit Zeitpunkt und Absender. Wählen Sie eine andere Sprache als Deutsch, speichern wir diese, damit wir Nachrichten übersetzt anzeigen können (Abschnitt 9). Die Seite ist für Suchmaschinen gesperrt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen) bzw. Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, Anfragen zu beantworten).",

  "## 6. Kundenportal und Tickets",
  "Firmenkunden nutzen ein Kundenportal unter einer eigenen Subdomain. Für jedes Benutzerkonto speichern wir Name, E-Mail-Adresse, Firma bzw. Unterkunde und Rolle, auf Wunsch auch Telefonnummer, Position und bevorzugte Sprache. Das Passwort speichern wir nicht im Klartext, sondern nur als nicht umkehrbaren Hashwert. Außerdem speichern wir den Zeitpunkt der letzten Anmeldung und zu jeder aktiven Sitzung die Adresse des Portals, den Browser (User-Agent) und die Zeitpunkte von Anmeldung und letzter Nutzung.",
  "Zu jedem Ticket speichern wir Betreff, Beschreibung, Kategorie, Dringlichkeit, Status, die Nachrichten zwischen Ihnen und uns, angehängte Dateien sowie ein Protokoll, wer wann den Status oder die Zuständigkeit geändert hat.",
  "Wir verarbeiten diese Daten, um unseren Vertrag mit dem Firmenkunden zu erfüllen (Art. 6 Abs. 1 lit. b DSGVO). Sind Sie als Mitarbeiter eines Firmenkunden im Portal angemeldet, ist Ihr Arbeitgeber unser Vertragspartner; die Verarbeitung Ihrer Daten beruht dann auf Art. 6 Abs. 1 lit. f DSGVO, unser berechtigtes Interesse ist die Erfüllung dieses Vertrags. Ihren Namen und Ihre E-Mail-Adresse haben wir in diesem Fall von Ihrem Arbeitgeber erhalten, als er Sie ins Portal eingeladen hat.",
  "Wer welche Tickets sieht: Mitarbeiter sehen ihre eigenen Tickets, Hauptansprechpartner alle Tickets ihrer Firma bzw. ihrer Unterkunde. Bei uns haben die Mitarbeiter Zugriff, die Tickets bearbeiten. Andere Kunden haben keinen Zugriff.",

  "## 7. Status-Link für Privatkunden",
  "Privatkunden bekommen kein Benutzerkonto. Stattdessen schicken wir nach dem Absenden des Formulars einen persönlichen Status-Link per E-Mail. Er enthält einen zufällig erzeugten, nicht erratbaren Schlüssel. Über den Link sehen Sie den Stand Ihrer Anfrage, unsere Antworten und können selbst antworten.",
  "Wer den Link kennt, kann die Anfrage lesen. Geben Sie ihn deshalb bitte nicht weiter. Die Statusseiten sind für Suchmaschinen gesperrt und geben beim Anklicken weiterführender Links keine Adresse an andere Websites weiter. Haben Sie den Link verloren, können Sie ihn über [Status-Link anfordern](/status) erneut an die hinterlegte E-Mail-Adresse schicken lassen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.",
);

const DATENSCHUTZ_TEIL_2 = md(
  "## 8. Live-Chat in Tickets und Anfragen",
  "Im Kundenportal, auf der Seite zum Status-Link und auf der Seite zu Ihrer Anfrage erscheinen neue Nachrichten, ohne dass Sie die Seite neu laden müssen. Außerdem sehen beide Seiten, ob die andere das Gespräch gerade geöffnet hat oder schreibt. Dafür baut Ihr Browser eine dauerhafte Verbindung zu unserem Server auf (WebSocket).",
  "Über diese Verbindung schicken wir nur Signale, etwa „Neue Nachricht im Ticket“ oder „schreibt gerade“. Die Inhalte der Nachrichten laufen nicht darüber – Ihr Browser lädt sie danach wie gewohnt über die geschützte Seite. Um zu prüfen, ob Sie das Gespräch sehen dürfen, nutzt der Browser beim Aufbau der Verbindung das Sitzungs-Cookie des Kundenportals (Abschnitt 12) bzw. den Schlüssel aus Ihrem persönlichen Link. Wie bei jedem Seitenaufruf verarbeitet der Server dabei Ihre IP-Adresse.",
  "Wer gerade verbunden ist und unter welchem Namen er angezeigt wird, hält der Server nur im Arbeitsspeicher vor, solange die Verbindung besteht. Dauerhaft gespeichert wird das nicht.",
  "Die Verbindung ist technisch notwendig, damit der Chat funktioniert (§ 25 Abs. 2 Nr. 2 TDDDG). Rechtsgrundlage für die Verarbeitung ist Art. 6 Abs. 1 lit. b DSGVO bzw. bei Mitarbeitern von Firmenkunden Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, Anliegen schnell und ohne Umwege zu klären).",

  "## 9. Maschinelle Übersetzung",
  "Über die Sprachauswahl oben auf der Website können Sie sich die Seiten in einer anderen Sprache anzeigen lassen. Außerdem können Nachrichten in Tickets und Anfragen in der Sprache des Lesers erscheinen – Sie schreiben uns z. B. auf Türkisch, wir lesen die Nachricht auf Deutsch und umgekehrt. Die Übersetzung erfolgt maschinell; verbindlich ist die deutsche Fassung.",
  "Wird die Übersetzung genutzt, übermitteln wir die zu übersetzenden Texte – Website-Texte bzw. den Text von Chat-Nachrichten – an einen der folgenden Dienste:",
  list(
    "**DeepL SE**, Köln, Deutschland, oder",
    "**Anthropic PBC**, San Francisco, USA.",
  ),
  "Welcher Dienst zum Einsatz kommt, hängt von unserer Einrichtung ab. Der Anbieter verarbeitet die Texte nur, um sie zu übersetzen, und als unser Auftragsverarbeiter nach Art. 28 DSGVO. Bei Anthropic werden Daten in den USA verarbeitet. Diese Übermittlung in ein Drittland stützen wir auf die Standardvertragsklauseln der EU-Kommission (Art. 46 Abs. 2 lit. c DSGVO).",
  "Damit derselbe Text nicht mehrfach übermittelt werden muss, speichern wir fertige Übersetzungen in einem Zwischenspeicher auf unserem Server: die Übersetzung, die Sprache und eine Prüfsumme des Ausgangstextes. Zusätzlich behält Ihr Browser übersetzte Website-Texte im Sitzungsspeicher (sessionStorage), bis Sie den Tab schließen.",
  "Rechtsgrundlage ist für Website-Texte Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, die Website auch Menschen mit anderer Muttersprache verständlich anzubieten), für Chat-Nachrichten Art. 6 Abs. 1 lit. b DSGVO bzw. lit. f DSGVO (Verständigung über Ihr Anliegen). Bitte schreiben Sie keine Passwörter oder Gesundheitsdaten in Nachrichten – das gilt mit und ohne Übersetzung.",

  "## 10. Telefon und Anrufe",
  "Wenn Sie uns anrufen, nimmt ein Mitarbeiter das Gespräch über unsere Telefonanlage an. Die Anlage meldet den Anruf an unser Ticketsystem. Dort speichern wir Ihre Rufnummer (sofern sie übermittelt wird), die angerufene Nummer, Zeitpunkt und Dauer des Anrufs, ob er angenommen wurde und welcher Mitarbeiter ihn angenommen hat, gegebenenfalls eine kurze Notiz zum Anliegen.",
  "Anhand der Rufnummer ordnen wir den Anruf einem Kunden oder Ansprechpartner zu, legen bei Bedarf ein Ticket an oder verknüpfen ihn mit einem bestehenden. So geht kein Rückruf verloren, und die Arbeit ist nachvollziehbar dokumentiert. Den Inhalt der Gespräche zeichnen wir nicht auf. Möchten Sie nicht, dass Ihre Rufnummer gespeichert wird, unterdrücken Sie sie bitte beim Anruf.",
  "Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, soweit es um einen Vertrag mit Ihnen oder dessen Anbahnung geht, sonst Art. 6 Abs. 1 lit. f DSGVO (unser Interesse, Anrufe zuzuordnen und geordnet zu bearbeiten). Betreibt ein Telefonieanbieter die Anlage für uns, verarbeitet er die Verbindungsdaten als unser Auftragsverarbeiter (Art. 28 DSGVO).",

  "## 11. E-Mails",
  "Wir schicken Ihnen E-Mails, wenn es für die Bearbeitung nötig ist: Eingangsbestätigungen, Antworten und Rückfragen zu Tickets und Anfragen, Statusänderungen, Einladungen ins Kundenportal und Links zum Zurücksetzen des Passworts. Die E-Mails enthalten die Ticket- bzw. Anfragenummer, den Betreff und gegebenenfalls einen Auszug der Nachricht. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO bzw. bei Mitarbeitern von Firmenkunden Art. 6 Abs. 1 lit. f DSGVO.",
  "Der Versand läuft über den Mailserver unseres Hosting- bzw. E-Mail-Anbieters. E-Mails werden zwischen den Servern in der Regel verschlüsselt übertragen, sind aber nicht Ende-zu-Ende-verschlüsselt. Schicken Sie uns Passwörter deshalb bitte nie per E-Mail oder im Ticket – wenn wir ein Passwort brauchen, fragen wir am Telefon danach.",

  "## 12. Cookies und Speicher im Browser",
  "Wir verwenden zwei Cookies:",
  list(
    "**hertlin_session** wird nur gesetzt, wenn Sie sich im Kundenportal anmelden (bzw. als Mitarbeiter von {firma} in der internen Verwaltung). Es enthält einen zufälligen Sitzungsschlüssel, mit dem der Server Sie wiedererkennt – auch beim Aufbau der Live-Chat-Verbindung. Das Cookie ist für Skripte im Browser nicht lesbar und wird beim Abmelden gelöscht, spätestens aber nach 72 Stunden ohne Nutzung bzw. 14 Tage nach der Anmeldung ungültig. Bei verschlüsselter Verbindung heißt es __Host-hertlin_session.",
    "**hertlin_lang** wird nur gesetzt, wenn Sie in der Sprachauswahl eine Sprache wählen. Es enthält nur das Sprachkürzel (z. B. „en“), damit die Website beim nächsten Besuch gleich in dieser Sprache erscheint, und gilt ein Jahr. Dieselbe Angabe legt Ihr Browser unter dem gleichen Namen im lokalen Speicher (localStorage) ab.",
  ),
  "Beide sind technisch notwendig, damit die Anmeldung bzw. die von Ihnen gewählte Sprache funktioniert (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1 lit. b bzw. lit. f DSGVO). Eine Einwilligung ist dafür nicht erforderlich. Den Spracheintrag können Sie jederzeit löschen, indem Sie wieder „Deutsch“ wählen oder die Website-Daten in Ihrem Browser löschen. Cookies zu Analyse-, Tracking- oder Werbezwecken setzen wir nicht ein.",
);

const DATENSCHUTZ_TEIL_3 = md(
  "## 13. Fernwartung",
  "Wenn wir Ihnen per Fernwartung helfen, sehen wir während der Sitzung Ihren Bildschirm und damit auch die Daten, die dort angezeigt werden. Die Sitzung starten Sie selbst und nur nach Absprache mit uns; Sie können sie jederzeit beenden. Wir sehen uns nur an, was für die Lösung des Problems nötig ist. Die Verbindung wird über die Server des Anbieters der Fernwartungssoftware hergestellt, der dabei Verbindungsdaten wie IP-Adressen und Gerätekennungen verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.",

  "## 14. Weitergabe von Daten",
  "Neben den genannten Dienstleistern (Hosting, E-Mail, Übersetzung, Telefonie, Fernwartung) geben wir Ihre Daten nur weiter, wenn das für Ihren Auftrag nötig ist – etwa an einen Hersteller im Garantiefall oder an Ihren Internetanbieter bei einer Leitungsstörung – und nur nach Absprache mit Ihnen. Eine Weitergabe an Behörden erfolgt nur, wenn wir gesetzlich dazu verpflichtet sind.",

  "## 15. Speicherdauer",
  list(
    "Server-Logdateien: höchstens {log_tage} Tage (siehe Abschnitt 3).",
    "Sitzungen im Kundenportal: bis zur Abmeldung, höchstens 14 Tage.",
    "Verbindungsdaten des Live-Chats: nur solange die Verbindung besteht.",
    "Anfragen von Interessenten und die Nachrichten dazu: Kommt kein Auftrag zustande, löschen wir die Anfrage samt Nachrichten, sobald sie für Rückfragen nicht mehr gebraucht wird.",
    "Benutzerkonten, Tickets, Nachrichten und Anhänge: für die Dauer der Zusammenarbeit. Nach deren Ende löschen wir sie, soweit keine Aufbewahrungspflichten bestehen.",
    "Einträge der Anrufliste: solange wir sie für die Bearbeitung und Dokumentation brauchen; ist ein Anruf mit einem Ticket verknüpft, so lange wie das Ticket.",
    "Übersetzungen im Zwischenspeicher: bis wir den Zwischenspeicher leeren. Sie enthalten keinen Hinweis darauf, aus welchem Gespräch sie stammen.",
    "Spracheinstellung im Browser: bis Sie sie ändern oder die Website-Daten löschen, das Cookie höchstens ein Jahr.",
    "Unterlagen, die wir nach Handels- und Steuerrecht aufbewahren müssen (z. B. Rechnungen und Geschäftsbriefe): für die gesetzliche Frist von sechs, acht oder zehn Jahren, je nach Art der Unterlage.",
  ),

  "## 16. Ihre Rechte",
  "Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:",
  list(
    "Auskunft über die gespeicherten Daten (Art. 15 DSGVO)",
    "Berichtigung unrichtiger Daten (Art. 16 DSGVO)",
    "Löschung (Art. 17 DSGVO), soweit keine Aufbewahrungspflicht entgegensteht",
    "Einschränkung der Verarbeitung (Art. 18 DSGVO)",
    "Datenübertragbarkeit (Art. 20 DSGVO)",
    "Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Art. 7 Abs. 3 DSGVO)",
    "Widerspruch gegen Verarbeitungen, die auf Art. 6 Abs. 1 lit. f DSGVO beruhen, aus Gründen, die sich aus Ihrer besonderen Situation ergeben (Art. 21 DSGVO)",
  ),
  "Für eine Anfrage genügt eine formlose Nachricht an {email} oder per Post an die oben genannte Anschrift.",

  "## 17. Beschwerderecht",
  "Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, wenn Sie der Meinung sind, dass wir Ihre Daten nicht rechtmäßig verarbeiten (Art. 77 DSGVO). Zuständig ist insbesondere die Aufsichtsbehörde des Bundeslandes, in dem Sie wohnen oder in dem wir unseren Sitz haben.",

  "*Stand: Oktober 2026*",
);

const DATENSCHUTZ: DefaultPageSource = {
  title: "Datenschutzerklärung",
  description:
    "Wie {firmierung} personenbezogene Daten auf der Website, im Kundenportal, im Live-Chat, am Telefon und bei Support-Anfragen verarbeitet.",
  navLabel: "Datenschutz",
  showInNav: false,
  showInFooter: true,
  navOrder: 91,
  blocks: [
    {
      id: "kopf",
      type: "hero",
      visual: "none",
      tone: "blue",
      eyebrow: "Rechtliches",
      title: "Datenschutzerklärung",
      text: "Hier erfahren Sie, welche personenbezogenen Daten wir verarbeiten, wenn Sie unsere Website besuchen, uns eine Anfrage schicken, mit uns chatten oder telefonieren oder das Kundenportal nutzen – und welche Rechte Sie haben.",
    },
    {
      id: "verantwortlicher",
      type: "companyInfo",
      variant: "kontakt",
      tone: "white",
      title: "1. Verantwortlicher",
      intro: "Verantwortlich für die Datenverarbeitung auf dieser Website und im Kundenportal ist:",
    },
    { id: "teil-1", type: "text", tone: "white", width: "narrow", body: DATENSCHUTZ_TEIL_1 },
    { id: "teil-2", type: "text", tone: "white", width: "narrow", body: DATENSCHUTZ_TEIL_2 },
    { id: "teil-3", type: "text", tone: "white", width: "narrow", body: DATENSCHUTZ_TEIL_3 },
  ],
};

/* ------------------------------------------------------------------ */
/* AGB                                                                 */
/* ------------------------------------------------------------------ */

const AGB_TEIL_1 = md(
  "## § 1 Geltungsbereich",
  "(1) Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge zwischen {firmierung} (im Folgenden „wir“) und unseren Kunden über IT-Dienstleistungen, insbesondere die Betreuung, Einrichtung, Wartung und Reparatur von IT-Systemen sowie die Lieferung von Hardware und Software.",
  "(2) Unsere Kunden sind Unternehmer im Sinne von § 14 BGB und Verbraucher im Sinne von § 13 BGB. Regelungen, die nur für eine dieser Gruppen gelten, sind entsprechend gekennzeichnet.",
  "(3) Abweichende Bedingungen des Kunden gelten nur, wenn wir ihnen ausdrücklich in Textform zustimmen. Individuelle Vereinbarungen, etwa in einem Angebot oder einem Betreuungsvertrag, haben Vorrang vor diesen AGB.",

  "## § 2 Vertragsschluss",
  "(1) Angaben auf unserer Website sind kein verbindliches Angebot, sondern eine Einladung, bei uns anzufragen. Unsere Angebote sind freibleibend, sofern sie nicht ausdrücklich als verbindlich bezeichnet sind.",
  "(2) Ein Vertrag kommt zustande, wenn wir einen Auftrag in Textform bestätigen (z. B. per E-Mail oder im Ticket) oder mit der Arbeit beginnen. Meldet ein Unternehmer eine Störung über das Kundenportal oder per Telefon, beauftragt er uns damit, die Störung nach Aufwand zu bearbeiten, soweit nichts anderes vereinbart ist. Bei Verbrauchern kommt ein Auftrag erst zustande, wenn wir ihn nach Rücksprache in Textform bestätigen.",
  "(3) Kostenvoranschläge sind unverbindlich, sofern nicht ausdrücklich ein Festpreis vereinbart ist. Zeichnet sich ab, dass der Aufwand einen Kostenvoranschlag um mehr als 20 Prozent übersteigt, informieren wir den Kunden, bevor wir weiterarbeiten.",

  "## § 3 Leistungsumfang",
  "(1) Art und Umfang unserer Leistungen ergeben sich aus dem Angebot, dem Betreuungsvertrag oder der Beschreibung im Ticket. Wir unterscheiden:",
  list(
    "**Betreuung:** laufende Betreuung der IT eines Kunden auf Grundlage eines Betreuungsvertrags, z. B. Überwachung, Updates und die Bearbeitung von Störungen mit vereinbarten Reaktionszeiten.",
    "**Einzelaufträge:** einzelne Arbeiten nach Bedarf, z. B. die Einrichtung eines Geräts oder die Behebung einer Störung.",
    "**Fernwartung:** Arbeiten über eine Fernwartungsverbindung, die der Kunde für die jeweilige Sitzung selbst freigibt.",
    "**Vor-Ort-Einsätze:** Arbeiten in den Räumen des Kunden nach Terminabsprache.",
  ),
  "(2) Ist nicht ausdrücklich ein bestimmtes Ergebnis vereinbart, schulden wir die fachgerechte Erbringung der vereinbarten Leistungen, nicht einen bestimmten Erfolg (Dienstvertrag). Ist ein bestimmtes Ergebnis vereinbart, etwa die Einrichtung eines Netzwerks nach einem abgestimmten Plan, gilt Werkvertragsrecht.",
  "(3) Wir dürfen für einzelne Arbeiten geeignete Subunternehmer einsetzen. Für deren Leistungen bleiben wir gegenüber dem Kunden verantwortlich.",
  "(4) Für Software und Dienste anderer Hersteller (z. B. Microsoft 365, Virenschutz, Fernwartungsprogramme) gelten zusätzlich deren Lizenz- und Nutzungsbedingungen. Für Verfügbarkeit und Funktion dieser Dienste sind wir nicht verantwortlich, soweit wir sie nicht selbst betreiben.",

  "## § 4 Mitwirkungspflichten des Kunden",
  "(1) Der Kunde unterstützt uns bei der Erbringung der Leistungen. Insbesondere",
  list(
    "sichert er seine Daten regelmäßig und vor jedem Einsatz, soweit die Datensicherung nicht ausdrücklich zu unseren vertraglichen Aufgaben gehört, und weist uns vor Arbeiten auf Daten hin, die nicht gesichert sind,",
    "verschafft er uns die nötigen Zugänge zu Räumen, Geräten und Benutzerkonten und hält Lizenzen sowie Zugangsdaten zu Diensten anderer Anbieter bereit,",
    "benennt er einen Ansprechpartner, der Entscheidungen treffen oder kurzfristig herbeiführen kann,",
    "beschreibt er Störungen möglichst genau, z. B. mit Fehlermeldung, betroffenen Geräten und Zeitpunkt.",
  ),
  "(2) Kommt der Kunde seinen Mitwirkungspflichten nicht nach, verschieben sich vereinbarte Termine und Reaktionszeiten entsprechend. Mehraufwand, der dadurch entsteht, berechnen wir nach Aufwand.",
  "(3) Passwörter teilt der Kunde uns nur auf sicherem Weg mit, z. B. am Telefon, nicht per E-Mail oder im Ticket. Passwörter, die er nur für einen Einsatz vergeben hat, sollte er danach ändern.",

  "## § 5 Termine und Reaktionszeiten",
  "(1) Termine für Vor-Ort-Einsätze und Fernwartung stimmen wir mit dem Kunden ab. Kann eine Seite einen Termin nicht einhalten, sagt sie so früh wie möglich ab.",
  "(2) Reaktionszeiten gelten nur, wenn sie in einem Betreuungsvertrag vereinbart sind, und nur innerhalb unserer Servicezeiten. Die Reaktionszeit beginnt mit dem Eingang der Meldung über das Kundenportal oder per Telefon. Sie ist eingehalten, wenn sich innerhalb der Frist ein Techniker beim Kunden meldet und mit der Bearbeitung beginnt. Eine bestimmte Dauer bis zur Behebung ist damit nicht zugesagt.",
  "(3) Ohne Betreuungsvertrag bearbeiten wir Meldungen so schnell, wie es unsere übrigen Termine zulassen.",
  "(4) Sagt der Kunde einen vereinbarten Vor-Ort-Termin weniger als 24 Stunden vorher ab oder ist er zum Termin nicht anzutreffen, können wir die Anfahrt und die vergeblich aufgewendete Zeit berechnen. Dem Kunden bleibt der Nachweis, dass uns kein oder ein geringerer Aufwand entstanden ist.",

  "## § 6 Vergütung und Abrechnung",
  "(1) Wir rechnen nach tatsächlichem Aufwand ab, sofern kein Festpreis oder keine Pauschale vereinbart ist. Es gelten die Preise aus dem Angebot bzw. Betreuungsvertrag, sonst unsere bei Auftragserteilung gültigen Stundensätze, die wir auf Anfrage nennen.",
  "(2) Arbeitszeit wird im 15-Minuten-Takt abgerechnet; angefangene 15 Minuten zählen voll.",
  "(3) Für Vor-Ort-Einsätze berechnen wir eine Anfahrtspauschale, deren Höhe wir vorher nennen.",
  "(4) Material, Hardware und Lizenzen berechnen wir gesondert. Größere Anschaffungen sprechen wir vorher mit dem Kunden ab. Gelieferte Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.",
  "(5) Pauschalen aus Betreuungsverträgen stellen wir monatlich im Voraus in Rechnung, Leistungen nach Aufwand monatlich im Nachhinein oder nach Abschluss des Auftrags. Auf der Rechnung steht, wann wir was gemacht haben, mit Verweis auf das zugehörige Ticket.",
  "(6) Rechnungen sind innerhalb von 14 Tagen nach Zugang ohne Abzug zu zahlen.",
  "(7) Gegenüber Verbrauchern nennen wir Preise einschließlich der gesetzlichen Umsatzsteuer, gegenüber Unternehmern zuzüglich Umsatzsteuer.",

  "## § 7 Abnahme bei Werkleistungen",
  "(1) Schulden wir ein bestimmtes Ergebnis (§ 3 Abs. 2), nimmt der Kunde die Leistung ab, sobald sie fertiggestellt ist und wir ihm das mitgeteilt haben. Unwesentliche Mängel berechtigen nicht dazu, die Abnahme zu verweigern.",
  "(2) Die Leistung gilt als abgenommen, wenn wir dem Kunden nach Fertigstellung eine angemessene Frist zur Abnahme gesetzt haben und er die Abnahme nicht innerhalb dieser Frist unter Angabe mindestens eines Mangels verweigert. Ist der Kunde Verbraucher, weisen wir ihn zusammen mit der Aufforderung zur Abnahme in Textform auf diese Folge hin.",
);

const AGB_TEIL_2 = md(
  "## § 8 Gewährleistung",
  "(1) Es gelten die gesetzlichen Mängelrechte, soweit im Folgenden nichts anderes bestimmt ist.",
  "(2) Der Kunde meldet Mängel möglichst genau, am besten über das Kundenportal oder das Hilfe-Formular. Bei Werkleistungen beseitigen wir Mängel nach unserer Wahl durch Nachbesserung oder Neuherstellung.",
  "(3) Gegenüber Unternehmern verjähren Mängelansprüche in einem Jahr ab Abnahme bzw. Ablieferung. Das gilt nicht für Schadensersatzansprüche nach § 9 und nicht, soweit das Gesetz zwingend längere Fristen vorsieht. Gegenüber Verbrauchern gelten die gesetzlichen Fristen.",
  "(4) Für Hardware und Software anderer Hersteller gelten zusätzlich deren Garantiebedingungen. Im Garantiefall helfen wir bei der Abwicklung mit dem Hersteller. Ist der Mangel nicht von uns zu vertreten, berechnen wir diese Unterstützung nach Aufwand.",
  "(5) Kein Mangel unserer Leistung liegt vor, wenn eine Störung auf unsachgemäße Bedienung, auf Eingriffe des Kunden oder Dritter, auf Schadsoftware ohne unser Verschulden oder auf Hard- und Software anderer Hersteller zurückgeht.",

  "## § 9 Haftung",
  "(1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei der Verletzung des Lebens, des Körpers oder der Gesundheit, nach dem Produkthaftungsgesetz sowie im Umfang einer von uns übernommenen Garantie.",
  "(2) Bei leichter Fahrlässigkeit haften wir nur, wenn wir eine wesentliche Vertragspflicht verletzen – also eine Pflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung der Kunde regelmäßig vertrauen darf. In diesem Fall ist die Haftung auf den bei Vertragsschluss vorhersehbaren, vertragstypischen Schaden begrenzt.",
  "(3) Für den Verlust von Daten haften wir nur in Höhe des Aufwands, der für die Wiederherstellung nötig gewesen wäre, wenn der Kunde seine Daten regelmäßig gesichert hätte. Das gilt nicht, wenn die Datensicherung ausdrücklich zu unseren vertraglichen Aufgaben gehört.",
  "(4) Diese Haftungsbeschränkungen gelten auch zugunsten unserer Mitarbeiter und Erfüllungsgehilfen.",

  "## § 10 Datenschutz und Auftragsverarbeitung",
  "(1) Wir verarbeiten personenbezogene Daten nach den gesetzlichen Vorschriften. Einzelheiten stehen in unserer [Datenschutzerklärung](/datenschutz).",
  "(2) Erhalten wir bei unserer Arbeit Zugriff auf personenbezogene Daten, für die der Kunde verantwortlich ist – etwa Kunden- oder Mitarbeiterdaten auf seinen Systemen –, schließen wir mit Unternehmern einen Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO. Wir verarbeiten diese Daten nur nach Weisung des Kunden und nur, soweit es für den Auftrag nötig ist.",
  "(3) Unsere Mitarbeiter sind zur Vertraulichkeit verpflichtet. Zugangsdaten und Informationen über die IT des Kunden behandeln wir vertraulich, auch über das Ende des Vertrags hinaus.",

  "## § 11 Laufzeit und Kündigung von Betreuungsverträgen",
  "(1) Betreuungsverträge laufen auf unbestimmte Zeit, sofern keine Mindestlaufzeit vereinbart ist. Beide Seiten können sie mit einer Frist von drei Monaten zum Monatsende kündigen, Verbraucher mit einer Frist von einem Monat.",
  "(2) Ist eine Mindestlaufzeit vereinbart, ist eine ordentliche Kündigung frühestens zu deren Ende möglich. Danach gilt Absatz 1.",
  "(3) Das Recht zur außerordentlichen Kündigung aus wichtigem Grund bleibt unberührt. Ein wichtiger Grund liegt für uns insbesondere vor, wenn der Kunde mit zwei monatlichen Pauschalen in Verzug ist.",
  "(4) Kündigungen sind in Textform zu erklären, z. B. per E-Mail.",
  "(5) Bei Vertragsende übergeben wir dem Kunden die Dokumentation seiner IT und alle Zugangsdaten, die wir für ihn verwalten. Auf Wunsch unterstützen wir einen neuen Dienstleister bei der Übernahme; diesen Aufwand berechnen wir nach Aufwand.",

  "## § 12 Besonderheiten für Verbraucher",
  "(1) Schließt ein Verbraucher einen Vertrag ausschließlich über Fernkommunikationsmittel (z. B. über unsere Website, per E-Mail oder Telefon) oder außerhalb unserer Geschäftsräume, steht ihm ein gesetzliches Widerrufsrecht zu. Die Einzelheiten ergeben sich aus der Widerrufsbelehrung, die wir dem Verbraucher vor Vertragsschluss zur Verfügung stellen.",
  "(2) Möchte der Verbraucher, dass wir vor Ablauf der Widerrufsfrist mit der Arbeit beginnen, muss er das ausdrücklich verlangen. Widerruft er den Vertrag danach, schuldet er Wertersatz für die bis dahin erbrachten Leistungen. Das Widerrufsrecht erlischt, wenn wir die Leistung vollständig erbracht haben und der Verbraucher vorher ausdrücklich zugestimmt und bestätigt hat, dass er sein Widerrufsrecht bei vollständiger Vertragserfüllung verliert.",
  "(3) Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",

  "## § 13 Schlussbestimmungen",
  "(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Gegenüber Verbrauchern gilt diese Rechtswahl nur, soweit ihnen dadurch nicht der Schutz zwingender Vorschriften des Staates entzogen wird, in dem sie ihren gewöhnlichen Aufenthalt haben.",
  "(2) Ist der Kunde Kaufmann, juristische Person des öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist Gerichtsstand für alle Streitigkeiten aus dem Vertrag unser Geschäftssitz.",
  "(3) Ist eine Bestimmung dieser AGB unwirksam, bleibt der Vertrag im Übrigen wirksam. An die Stelle der unwirksamen Bestimmung treten die gesetzlichen Vorschriften.",

  "*Stand: Oktober 2026*",
);

const AGB: DefaultPageSource = {
  title: "Allgemeine Geschäftsbedingungen",
  description:
    "Allgemeine Geschäftsbedingungen von {firmierung} für IT-Betreuung, Einzelaufträge, Fernwartung und Vor-Ort-Einsätze.",
  navLabel: "AGB",
  showInNav: false,
  showInFooter: true,
  navOrder: 92,
  blocks: [
    { id: "kopf", type: "hero", visual: "none", tone: "blue", eyebrow: "Rechtliches", title: "Allgemeine Geschäftsbedingungen" },
    {
      id: "hinweis",
      type: "text",
      tone: "white",
      width: "note",
      body: md(
        "**Muster – vor Verwendung rechtlich prüfen lassen und an Ihre Verträge anpassen.**",
        "Diese AGB sind eine Vorlage für einen IT-Dienstleister und ersetzen keine Rechtsberatung. Prüfen Sie vor allem Fristen, Haftungsregeln und Zahlungsbedingungen und entfernen Sie diesen Hinweis, sobald der Text geprüft ist.",
      ),
    },
    { id: "teil-1", type: "text", tone: "white", width: "narrow", body: AGB_TEIL_1 },
    { id: "teil-2", type: "text", tone: "white", width: "narrow", body: AGB_TEIL_2 },
  ],
};

/* ------------------------------------------------------------------ */
/* Zusammenstellung                                                    */
/* ------------------------------------------------------------------ */

/** Rohfassung der Vorgaben (für Tests und als Vorlage). */
export const DEFAULT_PAGE_SOURCES: Record<string, DefaultPageSource> = {
  "": HOME,
  leistungen: LEISTUNGEN,
  unternehmen: UNTERNEHMEN,
  privatkunden: PRIVATKUNDEN,
  "ueber-uns": UEBER_UNS,
  support: SUPPORT,
  kontakt: KONTAKT,
  impressum: IMPRESSUM,
  datenschutz: DATENSCHUTZ,
  agb: AGB,
};

/** Wandelt die Eingabeform in fertige Module um (Standardwerte ergänzt). Ungültige Module werden ausgelassen. */
function normalize(source: DefaultPageSource, slug: string): DefaultPage {
  const blocks: Block[] = [];
  for (const input of source.blocks) {
    const parsed = blockSchema.safeParse(input);
    if (parsed.success) blocks.push(parsed.data);
    else console.error(`[cms] Ungültiges Standardmodul "${input.id}" auf Seite "/${slug}":`, parsed.error.issues[0]?.message);
  }
  return { ...source, blocks };
}

export const DEFAULT_PAGES: Record<string, DefaultPage> = Object.fromEntries(
  Object.entries(DEFAULT_PAGE_SOURCES).map(([slug, source]) => [slug, normalize(source, slug)]),
);

export function getDefaultPage(slug: string): DefaultPage | null {
  return Object.hasOwn(DEFAULT_PAGES, slug) ? DEFAULT_PAGES[slug] : null;
}
