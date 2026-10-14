import type { Metadata } from "next";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { TD, TH, THead, TR, Table } from "@/components/ui/table";
import { NotificationPermission } from "@/components/admin/calls/notification-permission";
import { TestCallForm } from "@/components/admin/calls/test-call-form";
import { deleteTestCallsAction, simulateTestCallAction } from "@/lib/actions/admin-calls";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatRelative } from "@/lib/format";
import { mainUrl } from "@/lib/hosts";
import { CALL_PROVIDER_LABELS, formatCallDateTime, type CallProvider } from "@/lib/phone";
import { TELEPHONY_PATH, telephonyStatus, webhookUrlTemplate } from "@/lib/telephony";

export const metadata: Metadata = { title: "Telefonanlage einrichten" };

const PLACEHOLDER = "IHR-ZUGANGSSCHLUESSEL";

function Code({ children }: { children: string }) {
  return (
    <pre className="overflow-x-auto rounded-xl bg-mist p-4 text-xs leading-relaxed text-ink ring-1 ring-line ring-inset">
      <code>{children}</code>
    </pre>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-brand-100 text-xs font-bold text-brand-800" aria-hidden>
        {n}
      </span>
      <div className="min-w-0 text-[0.9375rem] leading-relaxed text-ink-soft">{children}</div>
    </li>
  );
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[14rem_1fr] sm:gap-4">
      <dt className="text-sm font-semibold text-ink">{label}</dt>
      <dd className="text-sm text-ink-soft">{children}</dd>
    </div>
  );
}

const REJECTION_LABELS = {
  token: "Zugangsschlüssel fehlt oder ist falsch",
  ip: "Absender-Adresse ist nicht freigegeben",
  format: "Inhalt nicht erkannt",
} as const;

const GENERIC_FIELDS: { field: string; required: string; text: string }[] = [
  { field: "event", required: "ja", text: "ringing (klingelt), answered (angenommen), ended (aufgelegt) oder missed (nicht angenommen)" },
  { field: "callId", required: "ja", text: "Kennung des Anrufs – bei allen Meldungen zu einem Anruf gleich, z. B. ${UNIQUEID} in Asterisk" },
  { field: "from", required: "bei ringing", text: "Nummer des Anrufers, Schreibweise egal; „anonymous“ bei unterdrückter Nummer" },
  { field: "to", required: "nein", text: "Gewählte Nummer, z. B. die Support-Nummer" },
  { field: "direction", required: "nein", text: "in (Standard) oder out für ausgehende Anrufe" },
  { field: "answeredBy", required: "nein", text: "Name oder Durchwahl des Mitarbeiters, der angenommen hat" },
  { field: "cause", required: "nein", text: "Grund beim Auflegen, z. B. normalClearing, busy, noAnswer oder cancel" },
  { field: "timestamp", required: "nein", text: "Zeitpunkt (ISO 8601 oder Unix-Sekunden), falls Meldungen verzögert ankommen" },
];

export default async function TelephonySetupPage() {
  await requireAdmin();
  const status = telephonyStatus();
  const [lastCall, testCalls] = await Promise.all([
    db.phoneCall.findFirst({
      where: { provider: { not: "test" } },
      orderBy: { startedAt: "desc" },
      select: { startedAt: true, provider: true },
    }),
    db.phoneCall.count({ where: { provider: "test" } }),
  ]);

  const url = webhookUrlTemplate(PLACEHOLDER);
  const plainUrl = mainUrl(TELEPHONY_PATH);
  const curl = (body: string) =>
    [
      `curl -X POST "${plainUrl}" \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -H "X-Hertlin-Token: ${PLACEHOLDER}" \\`,
      `  -d '${body}'`,
    ].join("\n");

  return (
    <div className="max-w-4xl">
      <PageHeader
        breadcrumbs={[{ label: "Anrufe", href: "/admin/anrufe" }, { label: "Einrichtung" }]}
        title="Telefonanlage anbinden"
        description="Hier steht, wie die Telefonanlage Anrufe an die Verwaltung meldet und wie Sie prüfen, ob alles ankommt."
      />

      <div className="space-y-6">
        <Card>
          <CardHeader title="So funktioniert es" />
          <CardBody>
            <ol className="space-y-4">
              <Step n={1}>
                Ein Kunde ruft an. Die Telefonanlage klingelt wie gewohnt bei den Mitarbeitern – in der App auf dem Handy oder am PC.
              </Step>
              <Step n={2}>
                Gleichzeitig schickt die Anlage eine kurze Meldung an die Verwaltung. Wir suchen die Nummer bei Ansprechpartnern,
                Kunden und Unterkunden, in Tickets und Anfragen und zeigen allen angemeldeten Mitarbeitern unten rechts, wer anruft.
              </Step>
              <Step n={3}>
                Wer abnimmt, öffnet den Kunden mit einem Klick und macht aus dem Gespräch direkt ein Ticket. Verpasste Anrufe bleiben
                in der Anrufliste markiert, bis jemand zurückgerufen hat.
              </Step>
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Stand der Anbindung" />
          <CardBody>
            <dl className="divide-y divide-line">
              <StatusRow label="Zugangsschlüssel">
                {status.tokenSet ? (
                  <span className="space-y-1">
                    <Badge tone="green">Eingerichtet</Badge>
                    {status.tokenTooShort ? (
                      <span className="block text-amber-800">
                        Der Schlüssel ist recht kurz. Verwenden Sie mindestens 32 zufällige Zeichen.
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <Badge tone="red">Fehlt</Badge>
                )}
              </StatusRow>
              <StatusRow label="Freigegebene Absender">
                {status.allowedIps.length > 0
                  ? `Nur ${status.allowedIps.join(", ")}`
                  : "Nicht eingeschränkt – jede Adresse mit gültigem Zugangsschlüssel wird angenommen."}
              </StatusRow>
              <StatusRow label="Vorwahl für Nummern ohne Landesvorwahl">+{status.defaultCountry}</StatusRow>
              <StatusRow label="Letzter Anruf der Anlage">
                {lastCall
                  ? `${formatCallDateTime(lastCall.startedAt)} über ${CALL_PROVIDER_LABELS[lastCall.provider as CallProvider] ?? lastCall.provider}`
                  : "Bisher ist noch kein Anruf eingegangen."}
              </StatusRow>
              <StatusRow label="Letzte Meldung angenommen">
                {status.lastAccepted ? formatRelative(status.lastAccepted) : "Seit dem letzten Neustart keine."}
              </StatusRow>
              <StatusRow label="Letzte Meldung abgelehnt">
                {status.lastRejection ? (
                  <>
                    {formatRelative(status.lastRejection.at)}: {REJECTION_LABELS[status.lastRejection.reason]}
                    {status.lastRejection.detail ? ` (${status.lastRejection.detail})` : ""}
                  </>
                ) : (
                  "Seit dem letzten Neustart keine."
                )}
              </StatusRow>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Adresse für die Telefonanlage"
            description="Diese Adresse tragen Sie in der Telefonanlage als Webhook ein."
          />
          <CardBody className="space-y-4">
            {!status.tokenSet ? (
              <Alert tone="warning" title="Zuerst den Zugangsschlüssel festlegen">
                Legen Sie auf dem Server die Umgebungsvariable <code className="font-semibold">TELEPHONY_WEBHOOK_TOKEN</code> mit einem
                langen Zufallswert an (z. B. erzeugt mit <code className="font-semibold">openssl rand -hex 32</code>) und starten Sie die
                Anwendung neu. Bis dahin lehnt die Verwaltung alle Meldungen ab.
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <code className="min-w-0 flex-1 overflow-x-auto rounded-xl bg-mist px-4 py-3 text-sm whitespace-nowrap text-ink ring-1 ring-line ring-inset">
                {url}
              </code>
              <CopyButton value={url} label="Adresse kopieren" />
            </div>
            <p className="text-sm text-ink-soft">
              Ersetzen Sie <code className="font-semibold">{PLACEHOLDER}</code> durch den Wert von{" "}
              <code className="font-semibold">TELEPHONY_WEBHOOK_TOKEN</code> auf dem Server. Aus Sicherheitsgründen zeigen wir den
              Schlüssel hier nicht an. Wer die vollständige Adresse kennt, kann Anrufe eintragen – geben Sie sie nur an die Telefonanlage
              weiter.
            </p>
            <p className="text-sm text-ink-soft">
              Statt in der Adresse kann der Schlüssel auch im Header <code className="font-semibold">X-Hertlin-Token</code> mitgeschickt
              werden. Wenn Ihr Anbieter feste Absender-Adressen nennt, tragen Sie diese zusätzlich in{" "}
              <code className="font-semibold">TELEPHONY_ALLOWED_IPS</code> ein (kommagetrennt, Netze wie 192.0.2.0/24 sind möglich).
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="sipgate" description="sipgate meldet Anrufe über seine Webhooks (sipgate.io)." />
          <CardBody>
            <ol className="space-y-4">
              <Step n={1}>Melden Sie sich in der Weboberfläche von sipgate mit einem Administrator-Konto an.</Step>
              <Step n={2}>
                Öffnen Sie den Bereich für Webhooks (bei sipgate unter „sipgate.io“ zu finden). Je nach Tarif muss die Funktion vorher
                gebucht werden.
              </Step>
              <Step n={3}>
                Tragen Sie die Adresse von oben bei „Eingehende URL“ ein. Sollen auch ausgehende Gespräche in der Anrufliste stehen,
                tragen Sie sie zusätzlich bei „Ausgehende URL“ ein.
              </Step>
              <Step n={4}>Wählen Sie die Rufnummern oder Gruppen aus, für die Anrufe gemeldet werden – meist die Support-Nummer.</Step>
              <Step n={5}>
                Rufen Sie zum Test mit dem Handy an. Der Anruf erscheint sofort in der Anrufliste und als Hinweis unten rechts.
              </Step>
            </ol>
            <p className="mt-5 text-sm text-ink-soft">
              Wohin sipgate die Annahme und das Auflegen meldet, teilen wir sipgate bei jedem Anruf automatisch mit. Dafür ist nichts
              weiter einzustellen. Den Namen, der bei „angenommen von“ erscheint, übernehmen wir aus dem sipgate-Benutzer.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Andere Telefonanlagen"
            description="Asterisk, FreePBX, 3CX oder eine andere Anlage, die bei Anrufen eine Adresse aufrufen kann."
          />
          <CardBody className="space-y-5">
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
              Die Anlage schickt bei jedem Schritt eines Anrufs eine Meldung per HTTP POST an die Adresse oben – als JSON oder als
              Formulardaten mit denselben Feldnamen. In Asterisk und FreePBX geht das z. B. mit einem kleinen Skript im Wählplan
              (über <code className="font-semibold">System()</code> oder AGI) und im Hangup-Handler; als{" "}
              <code className="font-semibold">callId</code> eignet sich <code className="font-semibold">{"${UNIQUEID}"}</code>, als{" "}
              <code className="font-semibold">cause</code> der Wert von <code className="font-semibold">{"${DIALSTATUS}"}</code>.
            </p>

            <Table>
              <THead>
                <tr>
                  <TH>Feld</TH>
                  <TH>Pflicht</TH>
                  <TH>Bedeutung</TH>
                </tr>
              </THead>
              <tbody>
                {GENERIC_FIELDS.map((f) => (
                  <TR key={f.field}>
                    <TD className="font-mono text-xs font-semibold text-ink">{f.field}</TD>
                    <TD className="whitespace-nowrap">{f.required}</TD>
                    <TD>{f.text}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-ink">Beispiel: Anruf klingelt, wird angenommen und beendet</h3>
              <Code>
                {[
                  curl(
                    '{"event":"ringing","callId":"1728900000.42","from":"+49 711 1234567","to":"+49 711 9876500","direction":"in"}',
                  ),
                  "",
                  curl('{"event":"answered","callId":"1728900000.42","answeredBy":"Jonas Keller"}'),
                  "",
                  curl('{"event":"ended","callId":"1728900000.42","cause":"normalClearing"}'),
                ].join("\n")}
              </Code>
            </div>

            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-soft">
              <li>Alle Meldungen zu einem Anruf brauchen dieselbe callId. Doppelte oder verspätete Meldungen sind kein Problem.</li>
              <li>
                Kommt vor dem Auflegen kein <code className="font-semibold">answered</code>, gilt der Anruf als verpasst – außer{" "}
                <code className="font-semibold">cause</code> sagt etwas anderes, z. B. normalClearing.
              </li>
              <li>Ausgehende Anrufe werden nur protokolliert und lösen keinen Hinweis aus.</li>
              <li>
                Placetel: Die Meldungen der Notify-API (IncomingCall, CallAccepted, HungUp) erkennt die Verwaltung ebenfalls. Tragen Sie
                dort die Adresse von oben ein.
              </li>
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Anrufe annehmen" />
          <CardBody className="space-y-4">
            <p className="text-[0.9375rem] leading-relaxed text-ink-soft">
              Angenommen wird nicht in der Verwaltung, sondern wie bisher über die Telefonanlage. Die Verwaltung zeigt parallel an, wer
              anruft, ordnet den Anruf dem Kunden zu und dokumentiert ihn.
            </p>
            <ul className="list-disc space-y-1.5 pl-5 text-[0.9375rem] leading-relaxed text-ink-soft">
              <li>
                Bei sipgate, Placetel und anderen Anlagen aus der Cloud installieren die Mitarbeiter die App des Anbieters auf dem Handy
                oder PC und melden sich mit ihrem Benutzer an.
              </li>
              <li>
                Bei einer eigenen Anlage (Asterisk, FreePBX, 3CX) eignet sich die App der Anlage oder ein SIP-Programm wie Linphone oder
                Zoiper. Dort tragen Sie die SIP-Zugangsdaten des Mitarbeiters ein: Benutzername, Passwort und Adresse der Anlage.
              </li>
              <li>
                Damit niemand einen Anruf übersieht, sollte die Verwaltung bei den Mitarbeitern im Browser geöffnet sein, die Anrufe
                annehmen.
              </li>
            </ul>
            <NotificationPermission />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Testen"
            description="Simuliert einen eingehenden Anruf von der Nummer eines vorhandenen Kunden – ganz ohne Telefonanlage."
          />
          <CardBody className="space-y-4">
            <TestCallForm action={simulateTestCallAction} />
            {testCalls > 0 ? (
              <form action={deleteTestCallsAction} className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                <p className="text-sm text-ink-soft">
                  {testCalls === 1 ? "Ein Testanruf steht" : `${testCalls} Testanrufe stehen`} in der Anrufliste.
                </p>
                <SubmitButton variant="ghost" size="sm" pendingText="Wird entfernt …">
                  Testanrufe entfernen
                </SubmitButton>
              </form>
            ) : null}
          </CardBody>
        </Card>

        <Alert tone="info" title="Datenschutz">
          Die Anrufliste speichert Rufnummer, Zeitpunkt, Dauer und wer angenommen hat. Ergänzen Sie die Datenschutzerklärung um diesen
          Punkt, bevor Sie die Anbindung einschalten.
        </Alert>
      </div>
    </div>
  );
}
