# Hertlin mit Docker betreiben

Ein Container enthält alles: Website, Kundenportale, Verwaltung und den Live-Chat (WebSocket). Die Daten (SQLite-Datenbank, Anhänge, Website-Bilder, Mail-Protokoll) liegen im Volume `hertlin-data` unter `/data`.

Voraussetzung: ein Linux-Server mit Docker und dem Compose-Plugin (`docker compose version` funktioniert, Version 2 oder neuer). Läuft auf amd64 und arm64 (z. B. Raspberry Pi 4/5 mit 64-Bit-System).

Es gibt zwei Konfigurationsdateien, beide liegen neben `docker-compose.yml` und gehören nicht ins Git:

- `docker.env`: Einstellungen der Anwendung (Domain, E-Mail, Schlüssel). Vorlage: `docker.env.example`.
- `.env`: Einstellungen für `docker compose` selbst (welcher Port, ob Caddy mitläuft).

Nach jeder Änderung an einer der beiden Dateien: `docker compose up -d`. Ein einfacher Neustart liest sie nicht neu ein.

## 1. Test im Heimnetz (ohne eigene Domain)

Kundenportale laufen unter eigenen Subdomains (`muster.<hauptdomain>`). Damit das im Heimnetz ohne DNS-Einrichtung klappt, nutzen wir [sslip.io](https://sslip.io): Jeder Name der Form `<irgendwas>.192.168.1.50.sslip.io` zeigt automatisch auf die IP `192.168.1.50`.

```bash
git clone https://github.com/MarcoEckerlin/Hertlin.git
cd Hertlin
git checkout docker
cp docker.env.example docker.env
echo "HERTLIN_PUBLISH=3000" > .env
```

`HERTLIN_PUBLISH=3000` macht die Anwendung im Heimnetz auf Port 3000 erreichbar. Ohne diese Zeile ist sie nur auf dem Server selbst erreichbar (gedacht für den Betrieb hinter Caddy oder einem anderen Reverse Proxy).

In `docker.env` die IP des Docker-Servers eintragen (hier `192.168.1.50`):

```env
ROOT_DOMAIN=192.168.1.50.sslip.io:3000
APP_PROTOCOL=http
SEED_DEMO_DATA=true
```

Starten (der erste Build dauert einige Minuten):

```bash
docker compose up -d --build
docker compose logs -f hertlin     # Beenden der Anzeige mit Strg + C
```

Sobald `Hertlin läuft` erscheint, ist alles bereit:

| | Adresse |
| --- | --- |
| Website | http://192.168.1.50.sslip.io:3000 |
| Verwaltung | http://192.168.1.50.sslip.io:3000/admin |
| Kundenportal der Beispielfirma | http://muster.192.168.1.50.sslip.io:3000 |
| Kundenportal Bäckerei | http://baeckerei.192.168.1.50.sslip.io:3000 |

Beispielzugänge (Passwort `demo-passwort-2026`): `admin@hertlin.de` (Administrator), `technik@hertlin.de` (Techniker), im Portal `muster` z. B. `berger@muster.example`, im Portal `baeckerei` `chef@baeckerei.example`. Die vollständige Liste steht in der README. Das Passwort ist öffentlich bekannt, deshalb gibt es die Beispieldaten nur im Test über `http` (siehe [Von Test auf Produktion wechseln](#von-test-auf-produktion-wechseln)).

**Seite lässt sich nicht öffnen?** Manche Router blockieren Namen, die auf eine Heimnetz-IP zeigen („DNS-Rebind-Schutz“).

- FRITZ!Box: *Heimnetz → Netzwerk → Netzwerkeinstellungen → DNS-Rebind-Schutz*, dort `sslip.io` als Ausnahme eintragen.
- Alternative ohne Router-Änderung: auf dem eigenen PC in die hosts-Datei eintragen (Windows: `C:\Windows\System32\drivers\etc\hosts` als Administrator bearbeiten, Linux/macOS: `/etc/hosts`):

  ```
  192.168.1.50  192.168.1.50.sslip.io  muster.192.168.1.50.sslip.io  baeckerei.192.168.1.50.sslip.io
  ```

  Für jedes weitere Kundenportal eine Subdomain ergänzen.

## 2. Produktion mit eigener Domain und automatischem HTTPS

> **Lief auf diesem Server vorher der Test mit Beispieldaten?** Dann zuerst die Testdaten löschen, siehe [Von Test auf Produktion wechseln](#von-test-auf-produktion-wechseln). Die Demo-Zugänge haben ein öffentlich bekanntes Passwort. Hertlin sperrt sie im HTTPS-Betrieb zwar beim Start automatisch, die Beispielfirmen samt Portalen blieben aber bestehen.

Der mitgelieferte [Caddy](https://caddyserver.com) holt die Zertifikate selbst bei Let's Encrypt, auch für jede Kunden-Subdomain, sobald sie zum ersten Mal aufgerufen wird. Vorher fragt Caddy die Anwendung, ob es diesen Firmenkunden wirklich gibt. Für fremde oder erfundene Subdomains wird also kein Zertifikat beantragt.

**DNS beim Domain-Anbieter** (Beispiel `hertlin.de`):

| Name | Typ | Ziel |
| --- | --- | --- |
| `hertlin.de` | A (und AAAA, falls der Server IPv6 hat) | öffentliche IP des Servers |
| `www.hertlin.de` | A / AAAA | dieselbe IP |
| `*.hertlin.de` | A / AAAA | dieselbe IP |

Ports 80 und 443 müssen aus dem Internet auf den Server zeigen (Router: Portfreigabe). Caddy läuft im Netz des Servers und belegt diese Ports direkt; kein anderer Dienst darf sie nutzen.

**`docker.env`**:

```env
ROOT_DOMAIN=hertlin.de
APP_PROTOCOL=https
ADMIN_EMAIL=anna@hertlin.de
ADMIN_NAME=Anna Hertlin
SMTP_HOST=…
# übrige SMTP-Werte, MAIL_FROM, STAFF_NOTIFY_EMAIL
```

Mit `APP_PROTOCOL=https` werden keine Beispieldaten geladen, auch wenn `SEED_DEMO_DATA=true` noch in der Datei steht.

**`.env`** (ersetzt die Datei aus dem Test vollständig):

```env
COMPOSE_PROFILES=https
```

`COMPOSE_PROFILES=https` startet Caddy mit. `HERTLIN_PUBLISH` bleibt weg, damit Port 3000 nur auf dem Server selbst erreichbar ist und niemand an Caddy vorbei auf die Anwendung zugreift.

```bash
docker compose up -d --build
docker compose logs hertlin
```

Im Protokoll steht der Link, mit dem der Administrator sein Passwort setzt. Er kommt nicht per E-Mail; bitte von Hand weitergeben. Startet der Container neu, bevor das Passwort gesetzt ist, steht ein weiterer Link im Protokoll. Alle Links gelten 7 Tage, sobald einer benutzt wurde, verfallen die anderen.

Danach unter `https://hertlin.de/admin` anmelden und Firmenkunden anlegen. Deren Portal ist sofort unter `https://<kuerzel>.hertlin.de` erreichbar. Der erste Aufruf einer neuen Subdomain dauert ein paar Sekunden, weil Caddy dann das Zertifikat holt.

## 3. Hinter einem vorhandenen Reverse Proxy

Läuft auf dem Server schon Nginx Proxy Manager, Traefik, nginx o. Ä., wird Caddy nicht gebraucht. In `docker.env` wie oben `ROOT_DOMAIN` und `APP_PROTOCOL=https` setzen. Eine `.env` ist nicht nötig (oder leer lassen, jedenfalls ohne `COMPOSE_PROFILES` und ohne `HERTLIN_PUBLISH`).

**Proxy direkt auf dem Server installiert** (nginx, Apache, Caddy ohne Docker): Ziel ist `http://127.0.0.1:3000`.

**Proxy läuft selbst in Docker** (Nginx Proxy Manager, Traefik): Dort zeigt `127.0.0.1` auf den Proxy-Container selbst. Die Anwendung muss deshalb zusätzlich ins Docker-Netz des Proxys. Den Namen des Netzes zeigt `docker network ls` (bei Nginx Proxy Manager z. B. `npm_default`). Dann neben `docker-compose.yml` eine Datei `docker-compose.override.yml` anlegen. `docker compose` liest sie automatisch, und `git pull` lässt sie in Ruhe:

```yaml
services:
  hertlin:
    networks: [default, proxy]

networks:
  proxy:
    external: true
    name: npm_default   # Netz des Proxys aus "docker network ls"
```

Nach `docker compose up -d` ist das Ziel im Proxy `http://hertlin:3000`.

Wichtig für den Proxy:

- **Alle Hostnamen** weiterleiten: `hertlin.de`, `www.hertlin.de` und `*.hertlin.de`. Dafür braucht es ein Wildcard-Zertifikat (Let's Encrypt per DNS-Challenge).
- Den **originalen Host** mitgeben (`Host` bzw. `X-Forwarded-Host`). Daran erkennt die Anwendung das Kundenportal.
- **WebSockets** erlauben (Pfad `/_ws`, für die Live-Chats). Im Nginx Proxy Manager: Schalter „Websockets Support“.
- `X-Forwarded-For` setzt der Proxy selbst (Standard bei allen genannten). Daraus kommen die Sperren gegen zu viele Anmeldeversuche. Damit die echte Besucher-IP ankommt, muss der Proxy sie selbst sehen. Bei Docker mit IPv6 geht das nur, wenn der Proxy im Host-Netz läuft oder das Docker-Netz IPv6 hat.
- Uploads bis 60 MB zulassen (nginx: `client_max_body_size 60m;`).

Ein vollständiges nginx-Beispiel steht in der README unter *Betrieb → Reverse Proxy*.

## Alltag

| Aufgabe | Befehl |
| --- | --- |
| Protokoll ansehen | `docker compose logs -f hertlin` |
| Mails ohne SMTP lesen (Einladungen, Passwort-Links) | `docker compose exec hertlin cat /data/mails.log` |
| Weiteren Administrator anlegen | `docker compose exec hertlin npm run create-admin -- --email name@hertlin.de --name "Vor Nachname"` (Link steht in der Ausgabe) |
| Änderungen an `docker.env` oder `.env` übernehmen | `docker compose up -d` |
| Neustart (ohne neue Einstellungen) | `docker compose restart hertlin` |
| Stoppen | `docker compose down` (Daten bleiben erhalten) |

Enthält ein Wert in `docker.env` ein `$`-Zeichen (häufig bei Passwörtern), den Wert in einfache Anführungszeichen setzen: `SMTP_PASSWORD='ab$cd'`. Sonst kommt er verändert in der Anwendung an.

### Update

```bash
git pull
docker compose up -d --build
```

Datenbank-Änderungen werden beim Start automatisch übernommen.

### Sicherung

Alles Wichtige liegt in `/data` im Volume `hertlin-data`: Datenbank, Anhänge, Website-Bilder und die Rechnungs-PDFs (`/data/uploads/invoices`). Rechnungen sind Buchungsbelege und müssen 8 Jahre aufbewahrt werden – regelmäßig sichern und die Sicherungen auch außerhalb des Servers ablegen. Die Sicherung landet im Ordner `~/hertlin-backups`, also außerhalb des Projektordners, damit sie nicht beim nächsten Build ins Image gerät:

```bash
mkdir -p ~/hertlin-backups
docker compose stop hertlin
docker run --rm -v hertlin_hertlin-data:/data -v ~/hertlin-backups:/backup alpine tar czf /backup/hertlin-$(date +%F).tar.gz -C /data .
docker compose up -d
```

Der Volume-Name beginnt mit dem Ordnernamen des Projekts in Kleinbuchstaben (`hertlin_…`). `docker volume ls` zeigt den genauen Namen.

Wiederherstellen (überschreibt die aktuellen Daten). Auf einem neuen Server vorher wie oben einrichten und einmal `docker compose up -d --build` ausführen:

```bash
docker compose stop hertlin
docker run --rm -v hertlin_hertlin-data:/data -v ~/hertlin-backups:/backup alpine sh -c "find /data -mindepth 1 -delete && tar xzf /backup/hertlin-2026-10-14.tar.gz -C /data"
docker compose up -d
```

### Von Test auf Produktion wechseln

Die Beispieldaten aus dem Test bleiben in der Datenbank, bis das Volume gelöscht wird. Die Demo-Zugänge haben ein öffentlich bekanntes Passwort. Im HTTPS-Betrieb sperrt Hertlin sie beim Start automatisch und meldet das im Protokoll. Die Beispielfirmen samt Portalen bleiben aber bestehen. Deshalb vor dem Livegang das Volume löschen. **Dabei gehen alle Daten aus dem Test verloren.**

```bash
docker compose down
docker volume rm hertlin_hertlin-data
```

Danach `docker.env` und `.env` für die Produktion anpassen (Abschnitt 2 oder 3) und mit `docker compose up -d --build` starten.

## Einstellungen in `docker.env`

| Variable | Bedeutung |
| --- | --- |
| `ROOT_DOMAIN` | Hauptdomain ohne `https://`, im Test mit Port (`…sslip.io:3000`) |
| `APP_PROTOCOL` | `https` in Produktion, `http` nur für den Test |
| `SEED_DEMO_DATA` | `true` lädt beim ersten Start Beispielfirmen und Demo-Zugänge (nur mit `APP_PROTOCOL=http`) |
| `ADMIN_EMAIL`, `ADMIN_NAME` | Legt beim Start den ersten Administrator an, falls es ihn noch nicht gibt |
| `SMTP_*`, `MAIL_FROM`, `STAFF_NOTIFY_EMAIL` | E-Mail-Versand. Ohne SMTP gehen Mails nach `/data/mails.log` |
| `DEEPL_API_KEY` / `ANTHROPIC_API_KEY` | Übersetzer für Website und Chats (optional) |
| `TELEPHONY_WEBHOOK_TOKEN` | Anbindung der Telefonanlage (siehe README) |
| `SESSION_IDLE_HOURS` | Abmeldung nach so vielen Stunden ohne Aktivität (Standard 72) |

Datenbankpfad, Upload-Ordner und Port im Container sind im Image fest eingestellt und müssen nicht gesetzt werden.

## Einstellungen in `.env`

| Variable | Bedeutung |
| --- | --- |
| `HERTLIN_PUBLISH` | Wo Port 3000 erreichbar ist. Standard `127.0.0.1:3000` (nur auf dem Server); `3000` für den Test im Heimnetz |
| `COMPOSE_PROFILES` | `https` startet Caddy für automatisches HTTPS |
