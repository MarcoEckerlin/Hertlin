# Hertlin mit Docker betreiben

Ein Container enthält alles: Website, Kundenportale, Verwaltung und den Live-Chat (WebSocket). Die Daten (SQLite-Datenbank, Anhänge, Website-Bilder, Mail-Protokoll) liegen im Volume `hertlin-data` unter `/data`.

Voraussetzung: Docker mit Compose-Plugin (`docker compose version` zeigt 2.x). Läuft auf amd64 und arm64 (z. B. Raspberry Pi 4/5 mit 64-Bit-System).

## 1. Test im Heimnetz (ohne eigene Domain)

Kundenportale laufen unter eigenen Subdomains (`muster.<hauptdomain>`). Damit das im Heimnetz ohne DNS-Einrichtung klappt, nutzen wir [sslip.io](https://sslip.io): Jeder Name der Form `<irgendwas>.192.168.1.50.sslip.io` zeigt automatisch auf die IP `192.168.1.50`.

```bash
git clone https://github.com/MarcoEckerlin/Hertlin.git
cd Hertlin
git checkout docker
cp docker.env.example docker.env
```

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

Beispielzugänge (Passwort `demo-passwort-2026`): `admin@hertlin.de` (Administrator), `technik@hertlin.de` (Techniker), im Portal `muster` z. B. `berger@muster.example`, im Portal `baeckerei` `chef@baeckerei.example`. Die vollständige Liste steht in der README.

**Seite lässt sich nicht öffnen?** Manche Router blockieren Namen, die auf eine Heimnetz-IP zeigen („DNS-Rebind-Schutz“).

- FRITZ!Box: *Heimnetz → Netzwerk → Netzwerkeinstellungen → DNS-Rebind-Schutz*, dort `sslip.io` als Ausnahme eintragen.
- Alternative ohne Router-Änderung: auf dem eigenen PC in die hosts-Datei eintragen (Windows: `C:\Windows\System32\drivers\etc\hosts` als Administrator bearbeiten, Linux/macOS: `/etc/hosts`):

  ```
  192.168.1.50  192.168.1.50.sslip.io  muster.192.168.1.50.sslip.io  baeckerei.192.168.1.50.sslip.io
  ```

  Für jedes weitere Kundenportal eine Subdomain ergänzen.

## 2. Produktion mit eigener Domain und automatischem HTTPS

Der mitgelieferte [Caddy](https://caddyserver.com) holt die Zertifikate selbst bei Let's Encrypt, auch für jede Kunden-Subdomain, sobald sie zum ersten Mal aufgerufen wird. Vorher fragt Caddy die Anwendung, ob es diesen Firmenkunden wirklich gibt. Für fremde oder erfundene Subdomains wird also kein Zertifikat beantragt.

**DNS beim Domain-Anbieter** (Beispiel `hertlin.de`):

| Name | Typ | Ziel |
| --- | --- | --- |
| `hertlin.de` | A (und ggf. AAAA) | öffentliche IP des Servers |
| `www.hertlin.de` | A / AAAA | dieselbe IP |
| `*.hertlin.de` | A / AAAA | dieselbe IP |

Ports 80 und 443 müssen aus dem Internet auf den Server zeigen (Router: Portfreigabe). Kein anderer Dienst darf diese Ports belegen.

**`docker.env`**:

```env
ROOT_DOMAIN=hertlin.de
APP_PROTOCOL=https
SEED_DEMO_DATA=false
ADMIN_EMAIL=anna@hertlin.de
ADMIN_NAME=Anna Hertlin
SMTP_HOST=…
# übrige SMTP-Werte, MAIL_FROM, STAFF_NOTIFY_EMAIL
```

**`.env`** (eigene kleine Datei neben `docker-compose.yml`, die `docker compose` selbst liest):

```env
COMPOSE_PROFILES=https
HERTLIN_PUBLISH=127.0.0.1:3000
```

`COMPOSE_PROFILES=https` startet Caddy mit. `HERTLIN_PUBLISH` bindet den Port 3000 nur noch an den Server selbst, sodass niemand an Caddy vorbei auf die Anwendung zugreift.

```bash
docker compose up -d --build
docker compose logs hertlin
```

Im Protokoll steht der Link, mit dem der Administrator sein Passwort setzt (gültig 7 Tage). Ist SMTP eingerichtet, kommt er zusätzlich per E-Mail. Danach unter `https://hertlin.de/admin` anmelden und Firmenkunden anlegen. Deren Portal ist sofort unter `https://<kuerzel>.hertlin.de` erreichbar. Der erste Aufruf einer neuen Subdomain dauert ein paar Sekunden, weil Caddy dann das Zertifikat holt.

## 3. Hinter einem vorhandenen Reverse Proxy

Läuft auf dem Server schon Nginx Proxy Manager, Traefik, nginx o. Ä., wird Caddy nicht gebraucht. In `docker.env` wie oben `ROOT_DOMAIN` und `APP_PROTOCOL=https` setzen, in `.env` nur `HERTLIN_PUBLISH=127.0.0.1:3000` (ohne `COMPOSE_PROFILES`). Der Proxy leitet dann an `http://127.0.0.1:3000` weiter (bzw. an `hertlin:3000`, wenn er im selben Docker-Netz hängt).

Wichtig für den Proxy:

- **Alle Hostnamen** weiterleiten: `hertlin.de`, `www.hertlin.de` und `*.hertlin.de`. Dafür braucht es ein Wildcard-Zertifikat (Let's Encrypt per DNS-Challenge).
- Den **originalen Host** mitgeben (`Host` bzw. `X-Forwarded-Host`). Daran erkennt die Anwendung das Kundenportal.
- **WebSockets** erlauben (Pfad `/_ws`, für die Live-Chats). Im Nginx Proxy Manager: Schalter „Websockets Support“.
- `X-Forwarded-For` setzt der Proxy selbst (Standard bei allen genannten). Daraus kommen die Sperren gegen zu viele Anmeldeversuche.
- Uploads bis 60 MB zulassen (nginx: `client_max_body_size 60m;`).

Ein vollständiges nginx-Beispiel steht in der README unter *Betrieb → Reverse Proxy*.

## Alltag

| Aufgabe | Befehl |
| --- | --- |
| Protokoll ansehen | `docker compose logs -f hertlin` |
| Mails ohne SMTP lesen (Einladungen, Passwort-Links) | `docker compose exec hertlin cat /data/mails.log` |
| Weiteren Administrator anlegen | `docker compose exec hertlin npm run create-admin -- --email name@hertlin.de --name "Vor Nachname"` |
| Neustart | `docker compose restart hertlin` |
| Stoppen | `docker compose down` (Daten bleiben erhalten) |

### Update

```bash
git pull
docker compose up -d --build
```

Datenbank-Änderungen werden beim Start automatisch übernommen.

### Sicherung

Alles Wichtige liegt in `/data` im Volume `hertlin-data`. Sicherung als Archiv im aktuellen Ordner:

```bash
docker compose stop hertlin
docker run --rm -v hertlin_hertlin-data:/data -v "$PWD":/backup alpine tar czf /backup/hertlin-$(date +%F).tar.gz -C /data .
docker compose start hertlin
```

Der Volume-Name beginnt mit dem Ordnernamen des Projekts (`hertlin_…`). `docker volume ls` zeigt den genauen Namen.

Wiederherstellen (überschreibt die aktuellen Daten):

```bash
docker compose stop hertlin
docker run --rm -v hertlin_hertlin-data:/data -v "$PWD":/backup alpine sh -c "rm -rf /data/* && tar xzf /backup/hertlin-2026-10-14.tar.gz -C /data"
docker compose start hertlin
```

### Von Test auf Produktion wechseln

Die Beispieldaten bleiben in der Datenbank, auch wenn `SEED_DEMO_DATA` später auf `false` steht. Für einen sauberen Start ohne Beispielfirmen das Volume einmal löschen. **Dabei gehen alle Daten verloren.**

```bash
docker compose down
docker volume rm hertlin_hertlin-data
docker compose up -d
```

## Einstellungen in `docker.env`

| Variable | Bedeutung |
| --- | --- |
| `ROOT_DOMAIN` | Hauptdomain ohne `https://`, im Test mit Port (`…sslip.io:3000`) |
| `APP_PROTOCOL` | `https` in Produktion, `http` nur für den Test |
| `SEED_DEMO_DATA` | `true` lädt beim ersten Start Beispielfirmen und Demo-Zugänge |
| `ADMIN_EMAIL`, `ADMIN_NAME` | Legt beim Start den ersten Administrator an, falls es ihn noch nicht gibt |
| `SMTP_*`, `MAIL_FROM`, `STAFF_NOTIFY_EMAIL` | E-Mail-Versand. Ohne SMTP gehen Mails nach `/data/mails.log` |
| `DEEPL_API_KEY` / `ANTHROPIC_API_KEY` | Übersetzer für Website und Chats (optional) |
| `TELEPHONY_WEBHOOK_TOKEN` | Anbindung der Telefonanlage (siehe README) |
| `SESSION_IDLE_HOURS` | Abmeldung nach so vielen Stunden ohne Aktivität (Standard 72) |

Datenbankpfad, Upload-Ordner und Port sind im Image fest eingestellt und müssen nicht gesetzt werden.
