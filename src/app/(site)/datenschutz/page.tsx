import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, PlaceholderNotice } from "@/components/site/sections/legal";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: "Datenschutzerklärung",
  description: `Wie ${site.legalName} personenbezogene Daten auf der Website, im Kundenportal und bei Support-Anfragen verarbeitet.`,
};

/**
 * Angaben, die (noch) nicht in src/config/site.ts stehen.
 * Werden sie dort ergänzt (hostingProvider), nutzt die Seite automatisch den Wert aus der Konfiguration.
 * Speicherfristen an die tatsächliche Server-Konfiguration anpassen.
 */
const HOSTING_PROVIDER =
  "hostingProvider" in site && typeof site.hostingProvider === "string"
    ? site.hostingProvider
    : "TODO Name und Anschrift des Hosting-Anbieters";
const LOG_RETENTION_DAYS = 14;
const SESSION_DAYS = 14;
const LAST_UPDATED = "Oktober 2026";

export default function DatenschutzPage() {
  return (
    <LegalPage
      eyebrow="Rechtliches"
      title="Datenschutzerklärung"
      intro={
        <p>
          Hier erfahren Sie, welche personenbezogenen Daten wir verarbeiten, wenn Sie unsere Website besuchen, uns eine
          Anfrage schicken oder das Kundenportal nutzen – und welche Rechte Sie haben.
        </p>
      }
      notice={
        <PlaceholderNotice
          values={[site.legalName, site.owner, site.street, site.zip, site.city, site.phone, site.email, HOSTING_PROVIDER]}
        />
      }
    >
      <h2>1. Verantwortlicher</h2>
      <p>Verantwortlich für die Datenverarbeitung auf dieser Website und im Kundenportal ist:</p>
      <p>
        {site.legalName}
        <br />
        {site.owner}
        <br />
        {site.street}
        <br />
        {site.zip} {site.city}
        <br />
        Telefon: <a href={`tel:${site.phoneHref}`}>{site.phone}</a>
        <br />
        E-Mail: <a href={`mailto:${site.email}`}>{site.email}</a>
      </p>

      <h2>2. Das Wichtigste in Kürze</h2>
      <ul>
        <li>Wir verarbeiten Ihre Daten nur, soweit das für die Website, Ihre Anfrage oder unseren Vertrag nötig ist.</li>
        <li>
          Wir setzen keine Analyse-, Tracking- oder Werbedienste ein. Schriftarten und Grafiken liegen auf unserem eigenen
          Server, es werden keine Inhalte von Drittanbietern nachgeladen.
        </li>
        <li>Wir verkaufen keine Daten und geben sie nur weiter, wenn es für die Bearbeitung nötig ist.</li>
      </ul>

      <h2>3. Hosting und Server-Logdateien</h2>
      <p>Website und Kundenportal werden bei folgendem Anbieter betrieben: {HOSTING_PROVIDER}.</p>
      <p>
        Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO. Er verarbeitet die Daten nur nach
        unserer Weisung.
      </p>
      <p>
        Bei jedem Aufruf einer Seite speichert der Server automatisch technische Angaben in Logdateien: IP-Adresse, Datum und
        Uhrzeit, aufgerufene Adresse, übertragene Datenmenge, Statuscode sowie Browser und Betriebssystem (User-Agent). Wir
        brauchen diese Angaben, um die Website sicher zu betreiben und Fehler zu finden. Rechtsgrundlage ist Art. 6 Abs. 1
        lit. f DSGVO; unser berechtigtes Interesse ist ein sicherer und stabiler Betrieb.
      </p>
      <p>
        Die Logdateien werden nach spätestens {LOG_RETENTION_DAYS} Tagen gelöscht, es sei denn, ein konkreter
        Sicherheitsvorfall muss länger aufgeklärt werden.
      </p>
      <p>
        Um unsere Formulare vor massenhaften automatischen Einsendungen zu schützen, zählen wir kurzzeitig, wie oft von einer
        IP-Adresse Formulare abgeschickt werden. Diese Zählung liegt nur im Arbeitsspeicher des Servers und wird nicht
        dauerhaft gespeichert (Art. 6 Abs. 1 lit. f DSGVO).
      </p>

      <h2>4. Kontaktformular und Anfragen</h2>
      <p>
        Wenn Sie uns über das <Link href="/kontakt">Kontaktformular</Link> eine Anfrage schicken, verarbeiten wir die
        Angaben aus dem Formular: Name, gegebenenfalls Firma, E-Mail-Adresse, Telefonnummer, Postleitzahl und Ort, Thema,
        Anzahl der Arbeitsplätze, Ihre Nachricht und den gewünschten Kontaktweg. Ohne die Pflichtangaben können wir Ihre
        Anfrage nicht bearbeiten.
      </p>
      <p>
        Wir nutzen die Daten, um Ihre Anfrage zu beantworten und gegebenenfalls ein Angebot zu erstellen. Rechtsgrundlage ist
        Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche Maßnahmen) und, soweit es nicht um einen Vertrag geht, Art. 6 Abs. 1 lit. f
        DSGVO (unser Interesse, Anfragen zu beantworten).
      </p>
      <p>
        Wenn Sie Privatkunde sind und über das <Link href="/privatkunden#hilfe-anfordern">Formular für Privatkunden</Link>{" "}
        Hilfe anfordern, verarbeiten wir zusätzlich Ihre Problembeschreibung, gegebenenfalls Ihre Anschrift für einen Termin
        vor Ort und die Dateien, die Sie anhängen. Daraus entsteht ein Ticket, das wir zur Erfüllung des Auftrags bearbeiten
        (Art. 6 Abs. 1 lit. b DSGVO).
      </p>

      <h2>5. Kundenportal und Tickets</h2>
      <p>
        Firmenkunden nutzen ein Kundenportal unter einer eigenen Subdomain. Für jedes Benutzerkonto speichern wir Name,
        E-Mail-Adresse, Firma bzw. Unterkunde und Rolle, auf Wunsch auch Telefonnummer und Position. Das Passwort speichern wir
        nicht im Klartext, sondern nur als nicht umkehrbaren Hashwert. Außerdem speichern wir den Zeitpunkt der letzten
        Anmeldung und zu jeder aktiven Sitzung die Adresse des Portals, den Browser (User-Agent) und die Zeitpunkte von
        Anmeldung und letzter Nutzung.
      </p>
      <p>
        Zu jedem Ticket speichern wir Betreff, Beschreibung, Kategorie, Dringlichkeit, Status, die Nachrichten zwischen Ihnen
        und uns, angehängte Dateien sowie ein Protokoll, wer wann den Status oder die Zuständigkeit geändert hat.
      </p>
      <p>
        Wir verarbeiten diese Daten, um unseren Vertrag mit dem Firmenkunden zu erfüllen (Art. 6 Abs. 1 lit. b DSGVO). Sind
        Sie als Mitarbeiter eines Firmenkunden im Portal angemeldet, ist Ihr Arbeitgeber unser Vertragspartner; die
        Verarbeitung Ihrer Daten beruht dann auf Art. 6 Abs. 1 lit. f DSGVO, unser berechtigtes Interesse ist die Erfüllung
        dieses Vertrags. Ihren Namen und Ihre E-Mail-Adresse haben wir in diesem Fall von Ihrem Arbeitgeber erhalten, als er
        Sie ins Portal eingeladen hat.
      </p>
      <p>
        Wer welche Tickets sieht: Mitarbeiter sehen ihre eigenen Tickets, Hauptansprechpartner alle Tickets ihrer Firma bzw.
        ihrer Unterkunde. Bei uns haben die Mitarbeiter Zugriff, die Tickets bearbeiten. Andere Kunden haben keinen Zugriff.
      </p>

      <h2>6. Status-Link für Privatkunden</h2>
      <p>
        Privatkunden bekommen kein Benutzerkonto. Stattdessen schicken wir nach dem Absenden des Formulars einen persönlichen
        Status-Link per E-Mail. Er enthält einen zufällig erzeugten, nicht erratbaren Schlüssel. Über den Link sehen Sie den
        Stand Ihrer Anfrage, unsere Antworten und können selbst antworten.
      </p>
      <p>
        Wer den Link kennt, kann die Anfrage lesen. Geben Sie ihn deshalb bitte nicht weiter. Die Statusseiten sind für
        Suchmaschinen gesperrt und geben beim Anklicken weiterführender Links keine Adresse an andere Websites weiter. Haben
        Sie den Link verloren, können Sie ihn über <Link href="/status">Status-Link anfordern</Link> erneut an die
        hinterlegte E-Mail-Adresse schicken lassen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>7. E-Mails</h2>
      <p>
        Wir schicken Ihnen E-Mails, wenn es für die Bearbeitung nötig ist: Eingangsbestätigungen, Antworten und Rückfragen
        zu Tickets, Statusänderungen, Einladungen ins Kundenportal und Links zum Zurücksetzen des Passworts. Die E-Mails
        enthalten die Ticketnummer, den Betreff und gegebenenfalls einen Auszug der Nachricht. Rechtsgrundlage ist Art. 6
        Abs. 1 lit. b DSGVO bzw. bei Mitarbeitern von Firmenkunden Art. 6 Abs. 1 lit. f DSGVO.
      </p>
      <p>
        Der Versand läuft über den Mailserver unseres Hosting- bzw. E-Mail-Anbieters. E-Mails werden zwischen den Servern in
        der Regel verschlüsselt übertragen, sind aber nicht Ende-zu-Ende-verschlüsselt. Schicken Sie uns Passwörter deshalb
        bitte nie per E-Mail oder im Ticket – wenn wir ein Passwort brauchen, fragen wir am Telefon danach.
      </p>

      <h2>8. Cookies</h2>
      <p>
        Wir verwenden ein einziges Cookie: <strong>hertlin_session</strong>. Es wird nur gesetzt, wenn Sie sich im
        Kundenportal anmelden (bzw. als Hertlin-Mitarbeiter in der internen Verwaltung), und enthält einen zufälligen Sitzungsschlüssel, mit dem der Server
        Sie wiedererkennt. Das Cookie ist für Skripte im Browser nicht lesbar und wird beim Abmelden gelöscht, spätestens
        aber nach {SESSION_DAYS} Tagen ungültig.
      </p>
      <p>
        Dieses Cookie ist technisch notwendig, damit die Anmeldung funktioniert (§ 25 Abs. 2 Nr. 2 TDDDG, Art. 6 Abs. 1
        lit. b DSGVO). Eine Einwilligung ist dafür nicht erforderlich. Cookies zu Analyse-, Tracking- oder Werbezwecken
        setzen wir nicht ein.
      </p>

      <h2>9. Fernwartung</h2>
      <p>
        Wenn wir Ihnen per Fernwartung helfen, sehen wir während der Sitzung Ihren Bildschirm und damit auch die Daten, die
        dort angezeigt werden. Die Sitzung starten Sie selbst und nur nach Absprache mit uns; Sie können sie jederzeit
        beenden. Wir sehen uns nur an, was für die Lösung des Problems nötig ist. Die Verbindung wird über die Server des
        Anbieters der Fernwartungssoftware hergestellt, der dabei Verbindungsdaten wie IP-Adressen und Gerätekennungen
        verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.
      </p>

      <h2>10. Weitergabe von Daten</h2>
      <p>
        Neben den genannten Dienstleistern (Hosting, E-Mail, Fernwartung) geben wir Ihre Daten nur weiter, wenn das für
        Ihren Auftrag nötig ist – etwa an einen Hersteller im Garantiefall oder an Ihren Internetanbieter bei einer
        Leitungsstörung – und nur nach Absprache mit Ihnen. Eine Weitergabe an Behörden erfolgt nur, wenn wir gesetzlich
        dazu verpflichtet sind.
      </p>

      <h2>11. Speicherdauer</h2>
      <ul>
        <li>Server-Logdateien: höchstens {LOG_RETENTION_DAYS} Tage (siehe Abschnitt 3).</li>
        <li>Sitzungen im Kundenportal: bis zur Abmeldung, höchstens {SESSION_DAYS} Tage.</li>
        <li>
          Anfragen von Interessenten: Kommt kein Auftrag zustande, löschen wir die Anfrage, sobald sie für Rückfragen nicht
          mehr gebraucht wird.
        </li>
        <li>
          Benutzerkonten, Tickets und Anhänge: für die Dauer der Zusammenarbeit. Nach deren Ende löschen wir sie, soweit keine
          Aufbewahrungspflichten bestehen.
        </li>
        <li>
          Unterlagen, die wir nach Handels- und Steuerrecht aufbewahren müssen (z. B. Rechnungen und Geschäftsbriefe):
          für die gesetzliche Frist von sechs, acht oder zehn Jahren, je nach Art der Unterlage.
        </li>
      </ul>

      <h2>12. Ihre Rechte</h2>
      <p>Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
      <ul>
        <li>Auskunft über die gespeicherten Daten (Art. 15 DSGVO)</li>
        <li>Berichtigung unrichtiger Daten (Art. 16 DSGVO)</li>
        <li>Löschung (Art. 17 DSGVO), soweit keine Aufbewahrungspflicht entgegensteht</li>
        <li>Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
        <li>Datenübertragbarkeit (Art. 20 DSGVO)</li>
        <li>
          Widerspruch gegen Verarbeitungen, die auf Art. 6 Abs. 1 lit. f DSGVO beruhen, aus Gründen, die sich aus Ihrer
          besonderen Situation ergeben (Art. 21 DSGVO)
        </li>
      </ul>
      <p>
        Für eine Anfrage genügt eine formlose Nachricht an <a href={`mailto:${site.email}`}>{site.email}</a> oder per Post
        an die oben genannte Anschrift.
      </p>

      <h2>13. Beschwerderecht</h2>
      <p>
        Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, wenn Sie der Meinung sind, dass wir
        Ihre Daten nicht rechtmäßig verarbeiten (Art. 77 DSGVO). Zuständig ist insbesondere die Aufsichtsbehörde des
        Bundeslandes, in dem Sie wohnen oder in dem wir unseren Sitz haben.
      </p>

      <p className="mt-10 text-sm text-ink-muted">Stand: {LAST_UPDATED}</p>
    </LegalPage>
  );
}
