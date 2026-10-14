# Hertlin – Website, Kundenportal und Ticketsystem

Website, Kundenportal und interne Verwaltung für den IT-Dienstleister Hertlin. Alles läuft in einer Next.js-Anwendung mit einer Datenbank:

| Bereich | Adresse | Für wen |
| --- | --- | --- |
| Website | `hertlin.de` | Interessenten, Privatkunden |
| Anfrageformular (Neukunden) | `hertlin.de/kontakt` | Interessenten (Firma oder privat) |
| Hilfe für Privatkunden | `hertlin.de/privatkunden#hilfe-anfordern` | Privatkunden ohne Konto, Stand über persönlichen Status-Link |
| Kundenportal | `<kuerzel>.hertlin.de` | Firmenkunden und ihre Unterkunden |
| Verwaltung | `hertlin.de/admin` | Hertlin-Team (Administratoren, Techniker) |

## Funktionen

**Website**
- Startseite, Leistungen, Seiten für Unternehmen und Privatkunden, Über uns, Support, Impressum, Datenschutz
- Anfrageformular für Neukunden (Firma oder privat), landet als Anfrage in der Verwaltung
- Formular für Privatkunden: Ticket ohne Konto, Status-Link per E-Mail, Antworten und Anhänge über den Link

**Kundenportal (eigene Subdomain je Firmenkunde)**
- Störungen melden und Anfragen stellen, mit Priorität, Bereich und Anhängen
- Ticketverlauf mit Antworten von Hertlin, Rückfragen, „Problem gelöst“ und „Wieder öffnen“
- Beliebig viele Unterkunden (z. B. Filialen, Standorte, Tochterfirmen), jede mit eigenen Benutzern und Tickets
- Benutzerverwaltung mit zwei Rollen: Hauptansprechpartner (sieht alle Tickets der Firma) und Mitarbeiter (sieht nur eigene Tickets)

**Live und mehrsprachig**
- Ticket- und Anfragen-Chats sind per WebSocket live verbunden: neue Nachrichten erscheinen sofort, mit Anzeige „schreibt gerade …“ und wer gerade im Gespräch ist
- Wer live dabei ist, bekommt keine zusätzliche E-Mail
- Chat-Übersetzer: Nachrichten werden automatisch in die Sprache des Lesers übersetzt, das Original bleibt abrufbar
- Website-Übersetzer: Sprachauswahl übersetzt die sichtbaren Texte der Website und des Kundenportals maschinell

**Verwaltung**
- Übersicht, Ticketliste mit Filtern (auch nach Standort), Tickets im Namen von Kunden anlegen
- Antworten an Kunden und interne Notizen, Status, Priorität, Bearbeiter, Standort, Ereignisprotokoll
- **Leistungen und Material im Ticket**: Administratoren und Techniker erfassen, was gebraucht wurde (Arbeitszeit, Anfahrt/Fahrtkosten, Material, Pauschalen) und wer es erbracht hat. Schnellwahl aus dem **Kostenkatalog** (Standardpositionen mit Preis); neue Positionen landen automatisch im Katalog. **Preise und Summen sehen nur Administratoren**; Positionen von Technikern ohne Katalogpreis sind als „Preis fehlt“ markiert, bis ein Administrator ihn einträgt
- Kostenübersicht pro Konto (Firmenkunde inkl. Unterkunden, Privatkunden), Zeitraumfilter, Abrechnungsstatus, CSV-Export
- **Rechnungen**: aus offenen Positionen je Empfänger (Firmenkunde, Unterkunde mit eigener Rechnung, Privatkunde), fortlaufende Nummern, PDF mit allen Pflichtangaben, Versand per E-Mail an die **Rechnungs-E-Mail des Kunden**, bezahlt/storniert (Stornorechnung, nie löschen); Hauptansprechpartner sehen ihre Rechnungen im Kundenportal
- **Standorte**: mehrere Hertlin-Standorte mit Anschrift, Telefon und Öffnungszeiten, Hauptsitz; Zuordnung von Kunden, Mitarbeitern und Tickets; Anzeige auf der Website (Modul „Standorte“, Fußzeile)
- **Hell- und Dunkelmodus** für Website, Portal und Verwaltung (Umschalter „Wie Gerät / Hell / Dunkel“)
- Anfragen von Neukunden bearbeiten und direkt als Firmenkunden anlegen
- Kunden, Subdomains, Unterkunden und Benutzer verwalten, Einladungen per E-Mail
- Team-Verwaltung (Administratoren und Techniker)
- Website-Editor: Seiten aus Modulen zusammensetzen (Kopfbereich, Text, Kacheln, Ablauf, FAQ, Formulare …), Entwurf, Vorschau, Veröffentlichen; eigene Seiten, AGB, Impressum, Datenschutz; Firmendaten und Bilder
- Telefonanlage: eingehende Anrufe erscheinen live mit erkanntem Kunden, Anrufliste, verpasste Anrufe, „Ticket aus Anruf“

## Rollen und Rechte

| Rolle | Wo | Darf |
| --- | --- | --- |
| Administrator | Verwaltung | alles, inkl. Preise, Kostenübersicht, Rechnungen, Katalog, Standorte, Kundenverwaltung, Team |
| Techniker | Verwaltung | Tickets und Anfragen bearbeiten, Leistungen und Material im Ticket erfassen (eigene ändern, solange nicht abgerechnet), Kunden ansehen – **keine Preise, Summen oder Rechnungen** |
| Hauptansprechpartner | Kundenportal | alle Tickets seiner Firma (beim Firmenkunden inkl. aller Unterkunden), Rechnungen, Benutzer verwalten, Unterkunden anlegen (nur Firmenkunde) |
| Mitarbeiter | Kundenportal | eigene Tickets erstellen und sehen |

Preise und Summen werden ausschließlich für Administratoren geladen. Techniker sehen nur Mengen und Leistungen, Kunden nur ihre versendeten Rechnungen.

## Lokale Entwicklung

Voraussetzung: [Node.js 22](https://nodejs.org) (LTS) und Git. Funktioniert unter Windows, macOS und Linux.

```bash
git clone https://github.com/MarcoEckerlin/Hertlin.git
cd Hertlin
git checkout claude/hertlin-website-ticketsystem   # solange der Stand noch nicht in main ist
npm install
npm run setup     # legt .env an, richtet die Datenbank ein und lädt Beispieldaten
npm run dev
```

Danach im Browser (Chrome, Edge oder Firefox):

- Website: http://localhost:3000
- Verwaltung: http://localhost:3000/admin
- Kundenportal der Beispielfirma: http://muster.localhost:3000 – Browser lösen `*.localhost` automatisch auf, eine Änderung an der hosts-Datei ist nicht nötig

Der erste Seitenaufruf dauert im Entwicklungsmodus ein paar Sekunden, weil die Seite dann erst übersetzt wird. Beenden mit Strg + C.

Beispielzugänge (Passwort `demo-passwort-2026`):

| Zugang | E-Mail |
| --- | --- |
| Administrator | `admin@hertlin.de` |
| Techniker | `technik@hertlin.de` |
| Portal `muster`, Hauptansprechpartnerin | `berger@muster.example` |
| Portal `muster`, Mitarbeiter | `yilmaz@muster.example` |
| Portal `muster`, Unterkunde „Büro Ulm“ | `ulm@muster.example` |
| Portal `baeckerei` | `chef@baeckerei.example` |

Ohne SMTP-Zugang werden E-Mails nicht verschickt, sondern in `storage/mails.log` geschrieben. Dort finden Sie auch Einladungs- und Passwort-Links.

Datenbank neu aufsetzen (löscht alle lokalen Daten): `npm run db:reset`

## Vor dem Livegang anpassen

1. **Firmenangaben** in `src/config/site.ts`: Firmierung, Anschrift, Telefon, E-Mail, USt-IdNr., Öffnungszeiten, Reaktionszeiten, Fernwartungslink. Alle Werte mit `TODO` ersetzen. Impressum und Datenschutzerklärung ziehen sich die Daten von dort – lassen Sie beide Texte bitte rechtlich prüfen.
2. **Kostenkatalog** (Verwaltung → Einstellungen → Kostenkatalog): Preise der Standardpositionen (Arbeitszeit, Anfahrt, Fahrtkosten je km …) an die eigene Preisliste anpassen.
3. **Rechnungseinstellungen** (Verwaltung → Rechnungen → Einstellungen): Steuernummer, Kleinunternehmer ja/nein, Bankverbindung, Zahlungsziel, Texte. Solange Pflichtangaben fehlen, lassen sich keine Rechnungen erstellen. Für jeden Firmenkunden die **Rechnungs-E-Mail** eintragen. Ohne SMTP-Mailserver werden Rechnungen nicht verschickt – dann das PDF herunterladen, selbst senden und „Als versendet markieren“.
4. **Standorte** (Verwaltung → Einstellungen → Standorte), z. B. „Hauptsitz aus den Firmendaten übernehmen“ und weitere Standorte anlegen.
5. **Ersten Administrator** anlegen (statt Beispieldaten):
   ```bash
   npm run create-admin -- --email anna@hertlin.de --name "Anna Hertlin"
   ```
   Der ausgegebene Link führt zur Seite, auf der das Passwort festgelegt wird.

### E-Rechnung

PDF-Rechnungen per E-Mail an Geschäftskunden sind bis Ende 2026 zulässig (mit Zustimmung des Empfängers). Ab 2027 brauchen Unternehmen mit mehr als 800.000 € Vorjahresumsatz strukturierte E-Rechnungen (XRechnung oder ZUGFeRD), ab 2028 alle – an Privatkunden und für Kleinbeträge bis 250 € bleibt PDF erlaubt. Die Rechnungsdaten liegen vollständig in der Datenbank, eine ZUGFeRD-Ausgabe lässt sich ergänzen. Rechnungen (Datenbank und `UPLOAD_DIR/invoices`) 8 Jahre aufbewahren und regelmäßig sichern.

## Telefonanlage

Die Anrufe selbst nimmt Ihre Telefonanlage an – Ihre Mitarbeiter nutzen dafür die App des Anbieters (z. B. sipgate, Placetel, 3CX) oder einen SIP-Softphone-Client wie Linphone oder Zoiper auf Handy und PC. Die Anlage meldet jeden Anruf per Webhook an `https://hertlin.de/api/telefonie?token=…`. Die Verwaltung zeigt den Anruf sofort an, erkennt den Kunden an der Telefonnummer und führt eine Anrufliste.

- Einrichtung und Anleitung (sipgate.io Push-API, JSON-Format für Asterisk/FreePBX/3CX): Verwaltung → Anrufe → Einrichtung
- Zugang: `TELEPHONY_WEBHOOK_TOKEN` setzen (z. B. `openssl rand -hex 32`, mindestens 24 Zeichen – kürzere lehnt der Webhook ab); optional `TELEPHONY_ALLOWED_IPS`
- Mit „Testanruf simulieren“ lässt sich die Live-Anzeige ohne Anlage prüfen

## Übersetzung

Mit einem Schlüssel für DeepL (`DEEPL_API_KEY`, empfohlen) oder Claude (`ANTHROPIC_API_KEY`) werden Chat-Nachrichten automatisch übersetzt und der Sprachumschalter auf der Website erscheint. Ohne Schlüssel bleibt alles auf Deutsch. Übersetzungen werden in der Datenbank zwischengespeichert, jeder Text wird also nur einmal übersetzt. Der Website-Übersetzer ist pro Besucher und Tag begrenzt (`TRANSLATION_DAILY_LIMIT`).

Kunden stellen ihre Sprache im Kundenportal unter „Profil“ ein, Privatkunden auf ihrer Statusseite, Interessenten im Anfragen-Chat.

## Website bearbeiten

Unter Verwaltung → Website (nur Administratoren):
- **Seiten**: Module hinzufügen, verschieben, ausblenden; als Entwurf speichern, in der Vorschau ansehen, veröffentlichen. Eigene Seiten mit eigener Adresse anlegen.
- **Firmendaten**: Anschrift, Telefon, Öffnungszeiten, Reaktionszeiten – erscheinen auf der Website, im Impressum und in E-Mails.
- **Medien**: Bilder für die Website hochladen.

In Texten lassen sich Platzhalter verwenden, z. B. `{telefon}`, `{email}`, `{firma}`, `{adresse}`; als Link-Ziel `{fernwartung}`.

## Konfiguration

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | SQLite-Datei, z. B. `file:/data/hertlin.db` |
| `ROOT_DOMAIN` | Hauptdomain ohne Protokoll, z. B. `hertlin.de` |
| `APP_PROTOCOL` | `https` (Standard) oder `http` für lokal |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Mailserver für Benachrichtigungen |
| `MAIL_FROM` | Absender, z. B. `Hertlin <support@hertlin.de>` |
| `STAFF_NOTIFY_EMAIL` | Empfänger für neue Tickets und Anfragen |
| `UPLOAD_DIR` | Ablage für Ticket-Anhänge und Website-Bilder |
| `DEEPL_API_KEY` / `ANTHROPIC_API_KEY` | Übersetzung (siehe oben), `TRANSLATION_PROVIDER` erzwingt einen Anbieter |
| `TELEPHONY_WEBHOOK_TOKEN` | Zugang für die Telefonanlage, `TELEPHONY_ALLOWED_IPS` optional |
| `SESSION_IDLE_HOURS` | Abmeldung nach so vielen Stunden ohne Aktivität (Standard 72; Sitzungen gelten höchstens 14 Tage) |

## Betrieb

### DNS und Zertifikat

- `A`/`AAAA`-Eintrag für `hertlin.de` und `www.hertlin.de` auf den Server
- **Wildcard-Eintrag** `*.hertlin.de` auf denselben Server – damit funktioniert jede Kunden-Subdomain sofort, ohne DNS-Änderung pro Kunde
- Ein Wildcard-Zertifikat für `*.hertlin.de` (Let's Encrypt per DNS-Challenge, z. B. mit Caddy und dem Plugin Ihres DNS-Anbieters oder certbot)

Reservierte Kürzel, die nie an Kunden vergeben werden (z. B. `www`, `admin`, `mail`, `autodiscover`), stehen in `src/lib/hosts.ts`.

### Reverse Proxy

Die Anwendung erwartet den originalen Hostnamen (`Host` oder `X-Forwarded-Host`) und die Client-IP in `X-Forwarded-For`. Der Proxy muss `X-Forwarded-For` **selbst setzen** (nicht vom Client übernehmen), sonst greifen die Schutzgrenzen gegen zu viele Anmeldeversuche nicht zuverlässig. Ausgewertet wird der letzte Eintrag. Die Anwendung selbst darf nur für den Proxy erreichbar sein (Docker: Port nur an `127.0.0.1`, ohne Docker: `LISTEN_HOST=127.0.0.1`) – direkt aus dem Netz könnte jeder Client die IP frei angeben.

Beispiel nginx:

```nginx
server {
    listen 443 ssl http2;
    server_name hertlin.de www.hertlin.de *.hertlin.de;
    # ssl_certificate ... (Wildcard-Zertifikat)

    client_max_body_size 60m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket für Live-Chats (/_ws)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_read_timeout 1h;
    }
}

# im http-Block:
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

### Sicherheit im Betrieb

- Sitzungs-Cookie unter HTTPS als `__Host-hertlin_session` (nur Secure, nur für genau diesen Host), HttpOnly, SameSite=Lax
- Header: HSTS (inkl. Subdomains), Content-Security-Policy, X-Frame-Options, nosniff, Referrer-Policy
- Anmeldungen, Formulare, Webhook und Übersetzer sind pro IP begrenzt; der Reverse Proxy muss dafür `X-Forwarded-For` setzen (siehe oben)
- Uploads: höchstens 5 Dateien à 10 MB pro Nachricht. Begrenzen Sie die Größe zusätzlich im Reverse Proxy (`client_max_body_size`) und – bei Bedarf – die Zahl gleichzeitiger Verbindungen pro IP (`limit_conn`)
- Regelmäßige Sicherung des Verzeichnisses `/data` (Datenbank, Anhänge, Website-Bilder)

### Docker

```bash
cp .env.example .env.production   # Werte für Produktion eintragen (ROOT_DOMAIN, APP_PROTOCOL=https, SMTP …)
docker compose up -d --build
docker compose exec hertlin npm run create-admin -- --email anna@hertlin.de --name "Anna Hertlin"
```

Datenbank und Anhänge liegen im Volume `hertlin-data` (`/data`). Sichern Sie dieses Verzeichnis regelmäßig.

### Ohne Docker

```bash
npm ci
npx prisma migrate deploy
npm run build
LISTEN_HOST=127.0.0.1 npm start   # Port 3000 (Next.js + WebSocket-Server aus server.ts), nur für den Reverse Proxy erreichbar, z. B. als systemd-Dienst
```

## Tests

```bash
npm run typecheck
npm run lint
npm test             # Unit-Tests (Vitest)
npm run build && npm run test:e2e   # Ende-zu-Ende-Tests (Playwright, eigene Datenbank prisma/e2e.db)
```

### Ende-zu-Ende-Tests (Playwright)

Die Tests in `tests/e2e/` laufen im echten Browser (Chromium) gegen den Produktions-Build. Vorher einmal den Browser installieren: `npx playwright install chromium`.

- `npm run build` baut die Anwendung, `npm run test:e2e` startet dann selbst einen Testserver auf Port 3200 – den eigenen Server aus `server.ts` mit WebSocket, `NODE_ENV=production`, `ROOT_DOMAIN=localhost:3200`. Port 3200 muss frei sein.
- Vor jedem Lauf legt `tests/e2e/prepare-db.ts` die Testdatenbank `prisma/e2e.db` neu an (Migrationen + Beispieldaten aus `prisma/seed.ts`). Das Skript bricht ab, wenn `DATABASE_URL` auf eine andere Datenbank zeigt – `prisma/dev.db` bleibt unberührt.
- Anhänge landen in `storage/e2e-uploads`, E-Mails wie immer in `storage/mails.log` (die Tests lesen Einladungs- und Status-Links von dort). Übersetzung ist im Testserver ausgeschaltet, der Telefonie-Webhook hat einen festen Testschlüssel (`tests/e2e/env.ts`).
- Kundenportale laufen unter `<kuerzel>.localhost:3200`; Chromium löst `*.localhost` ohne Eintrag in `/etc/hosts` auf.
- Einzelne Bereiche: `npx playwright test costs.spec.ts`, einzelner Test: `npx playwright test -g "Techniker sieht"`. Bei Fehlern liegt unter `test-results/` ein Trace (`npx playwright show-trace …`).

| Datei | Prüft |
| --- | --- |
| `auth.spec.ts` | Anmeldung, Sitzungen je Subdomain, Portal-Finder, Passwort zurücksetzen |
| `public.spec.ts` | alle Website-Seiten und Hauptmenü, Neukunden-Anfrage mit Live-Chat, Hilfe-Formular mit Anhang und Status-Link, Status-Link neu anfordern |
| `portal.spec.ts` | Tickets mit Anhang, Antworten, „Problem ist gelöst“/„Wieder öffnen“, Unterkunden und Einladungen, Rechte von Mitarbeitern |
| `costs.spec.ts` | Preise nur für Administratoren: Erfassung, Summe, Techniker sehen Leistungen ohne Beträge, Kunden nichts, Übersicht pro Konto, CSV-Export |
| `catalog.spec.ts` | Kostenkatalog: Schnellwahl im Ticket, neue Positionen landen im Katalog, Techniker-Position ohne Preis, Admin trägt Preis nach |
| `invoices.spec.ts` | Rechnungen: Pflichtangaben, Erstellen mit Nummer und PDF, Versand bzw. „selbst verschickt“, Unterkunde als eigener Empfänger, bezahlt, Storno, Portal-Sichtbarkeit, keine Rechnungen für Techniker |
| `locations.spec.ts` | Standorte: anlegen, Website und Fußzeile, Hauptsitz, Mitarbeiter zuordnen, Ticket- und Kundenfilter, Löschen nur ohne Zuordnungen |
| `staff.spec.ts` | interne Notiz und Antwort, Statuswechsel, Ticket für Privatkunden, neuer Firmenkunde mit Subdomain, Techniker einladen |
| `realtime.spec.ts` | Live-Chat: Anwesenheit, „schreibt gerade …“, Antworten ohne Neuladen, interne Notizen nicht beim Kunden |
| `telephony.spec.ts` | Webhook der Telefonanlage, Live-Hinweis mit erkanntem Kunden, verpasste Anrufe, Ticket aus Anruf, Zugangsschlüssel |
| `cms.spec.ts` | Website-Editor: Entwurf, Vorschau, Veröffentlichen, eigene Seite im Menü, Firmendaten in der Fußzeile, kein Zugriff für Techniker |
| `security.spec.ts` | Mandantentrennung (Tickets, Anhänge, Benutzer), WebSocket-Kanäle und Origin, Open Redirect über `?next=` |

## Technik

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, Prisma mit SQLite, Zod, Nodemailer, ws (WebSocket).

- `server.ts` startet Next.js und den WebSocket-Server (`/_ws`) in einem Prozess. Über den Socket laufen nur Signale (neue Nachricht, Status, tippt gerade); Inhalte lädt der Browser über die rechtegeprüften Seiten nach.

- `src/proxy.ts` ordnet Anfragen anhand des Hostnamens der Website oder einem Kundenportal zu (intern `/portal/<kuerzel>/…`).
- Sitzungen sind an den Host gebunden: Eine Anmeldung im Portal `muster` gilt nicht für andere Portale oder die Verwaltung.
- Berechtigungen werden in jeder Seite und jeder Server Action geprüft (`src/lib/auth.ts`, `src/lib/permissions.ts`).
- Anhänge liegen außerhalb des öffentlichen Ordners und werden nur nach Rechteprüfung ausgeliefert.
