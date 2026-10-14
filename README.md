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

**Verwaltung**
- Übersicht, Ticketliste mit Filtern, Tickets im Namen von Kunden anlegen
- Antworten an Kunden und interne Notizen, Status, Priorität, Bearbeiter, Ereignisprotokoll
- Kosten pro Ticket (Arbeitszeit, Anfahrt, Material, Pauschalen) – **nur für Administratoren sichtbar**
- Kostenübersicht pro Konto (Firmenkunde inkl. Unterkunden, Privatkunden), Zeitraumfilter, Abrechnungsstatus, CSV-Export
- Anfragen von Neukunden bearbeiten und direkt als Firmenkunden anlegen
- Kunden, Subdomains, Unterkunden und Benutzer verwalten, Einladungen per E-Mail
- Team-Verwaltung (Administratoren und Techniker)

## Rollen und Rechte

| Rolle | Wo | Darf |
| --- | --- | --- |
| Administrator | Verwaltung | alles, inkl. Kosten, Kundenverwaltung, Team |
| Techniker | Verwaltung | Tickets und Anfragen bearbeiten, Kunden ansehen – **keine Kosten** |
| Hauptansprechpartner | Kundenportal | alle Tickets seiner Firma (beim Firmenkunden inkl. aller Unterkunden), Benutzer verwalten, Unterkunden anlegen (nur Firmenkunde) |
| Mitarbeiter | Kundenportal | eigene Tickets erstellen und sehen |

Kosten werden ausschließlich in Verwaltungsseiten für Administratoren geladen. Kunden und Techniker bekommen sie weder angezeigt noch per E-Mail.

## Lokale Entwicklung

Voraussetzung: Node.js 22.

```bash
npm install
cp .env.example .env
npx prisma migrate dev     # legt prisma/dev.db an und spielt die Beispieldaten ein
npm run dev
```

- Website und Verwaltung: http://localhost:3000 bzw. http://localhost:3000/admin
- Kundenportal der Beispielfirma: http://muster.localhost:3000 (Browser lösen `*.localhost` automatisch auf)

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

Datenbank neu aufsetzen: `npm run db:reset`

## Vor dem Livegang anpassen

1. **Firmenangaben** in `src/config/site.ts`: Firmierung, Anschrift, Telefon, E-Mail, USt-IdNr., Öffnungszeiten, Reaktionszeiten, Fernwartungslink. Alle Werte mit `TODO` ersetzen. Impressum und Datenschutzerklärung ziehen sich die Daten von dort – lassen Sie beide Texte bitte rechtlich prüfen.
2. **Preisvorschläge** für das Kostenformular in `src/config/pricing.ts`.
3. **Ersten Administrator** anlegen (statt Beispieldaten):
   ```bash
   npm run create-admin -- --email anna@hertlin.de --name "Anna Hertlin"
   ```
   Der ausgegebene Link führt zur Seite, auf der das Passwort festgelegt wird.

## Konfiguration

| Variable | Bedeutung |
| --- | --- |
| `DATABASE_URL` | SQLite-Datei, z. B. `file:/data/hertlin.db` |
| `ROOT_DOMAIN` | Hauptdomain ohne Protokoll, z. B. `hertlin.de` |
| `APP_PROTOCOL` | `https` (Standard) oder `http` für lokal |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` | Mailserver für Benachrichtigungen |
| `MAIL_FROM` | Absender, z. B. `Hertlin <support@hertlin.de>` |
| `STAFF_NOTIFY_EMAIL` | Empfänger für neue Tickets und Anfragen |
| `UPLOAD_DIR` | Ablage für Ticket-Anhänge |

## Betrieb

### DNS und Zertifikat

- `A`/`AAAA`-Eintrag für `hertlin.de` und `www.hertlin.de` auf den Server
- **Wildcard-Eintrag** `*.hertlin.de` auf denselben Server – damit funktioniert jede Kunden-Subdomain sofort, ohne DNS-Änderung pro Kunde
- Ein Wildcard-Zertifikat für `*.hertlin.de` (Let's Encrypt per DNS-Challenge, z. B. mit Caddy und dem Plugin Ihres DNS-Anbieters oder certbot)

Reservierte Kürzel, die nie an Kunden vergeben werden (z. B. `www`, `admin`, `mail`, `autodiscover`), stehen in `src/lib/hosts.ts`.

### Reverse Proxy

Die Anwendung erwartet den originalen Hostnamen (`Host` oder `X-Forwarded-Host`) und die Client-IP in `X-Forwarded-For`. Der Proxy muss `X-Forwarded-For` **selbst setzen** (nicht vom Client übernehmen), sonst greifen die Schutzgrenzen gegen zu viele Anmeldeversuche nicht zuverlässig.

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
npm start          # Port 3000 (Next.js + WebSocket-Server aus server.ts), z. B. als systemd-Dienst
```

## Tests

```bash
npm run typecheck
npm run lint
npm test             # Unit-Tests (Vitest)
npm run build && npm run test:e2e   # Ende-zu-Ende-Tests (Playwright, eigene Datenbank prisma/e2e.db)
```

## Technik

Next.js 16 (App Router, Server Actions), React 19, TypeScript, Tailwind CSS 4, Prisma mit SQLite, Zod, Nodemailer.

- `src/proxy.ts` ordnet Anfragen anhand des Hostnamens der Website oder einem Kundenportal zu (intern `/portal/<kuerzel>/…`).
- Sitzungen sind an den Host gebunden: Eine Anmeldung im Portal `muster` gilt nicht für andere Portale oder die Verwaltung.
- Berechtigungen werden in jeder Seite und jeder Server Action geprüft (`src/lib/auth.ts`, `src/lib/permissions.ts`).
- Anhänge liegen außerhalb des öffentlichen Ordners und werden nur nach Rechteprüfung ausgeliefert.
