/**
 * Nachrichten zwischen Browser und WebSocket-Server (/_ws).
 * Über den Socket laufen nur Signale (IDs, Namen, Status) – nie Ticketinhalte.
 * Inhalte lädt der Browser danach über die normale, rechtegeprüfte Seite nach.
 */

export const WS_PATH = "/_ws";

/** Kanal-Schlüssel, z. B. "ticket:42", "inquiry:7", "staff" */
export type ChannelKey = `ticket:${number}` | `inquiry:${number}` | "staff";

export type ClientMessage =
  | { t: "sub"; ch: "ticket"; id: number; token?: string }
  | { t: "sub"; ch: "inquiry"; id?: number; token?: string }
  | { t: "sub"; ch: "staff" }
  | { t: "unsub"; key: ChannelKey }
  /** internal = Mitarbeiter schreibt eine interne Notiz (wird Kunden nicht angezeigt) */
  | { t: "typing"; key: ChannelKey; internal?: boolean }
  | { t: "ping" };

export type PresenceInfo = {
  /** Namen der Hertlin-Mitarbeiter, die den Kanal gerade geöffnet haben */
  staff: string[];
  /** Namen der Kunden, die den Kanal gerade geöffnet haben */
  customers: string[];
};

export type StaffNotice =
  | { kind: "ticket.created"; ticketId: number; subject: string; priority: string; customer: string }
  | { kind: "ticket.message"; ticketId: number; subject: string; author: string }
  | { kind: "inquiry.created"; inquiryId: number; name: string }
  | { kind: "inquiry.message"; inquiryId: number; name: string }
  | {
      kind: "call.incoming";
      callId: string;
      from: string;
      callerLabel: string | null;
      companyId: string | null;
      companyName: string | null;
    }
  | { kind: "call.updated"; callId: string; status: string; answeredBy: string | null };

export type ServerMessage =
  | { t: "hello"; role: "staff" | "customer" | "guest"; name: string | null }
  | { t: "subscribed"; key: ChannelKey }
  | { t: "denied"; ch: string; id?: number }
  /** Neue Nachricht im Kanal – Browser lädt den Verlauf neu */
  | { t: "message"; key: ChannelKey; fromStaff: boolean }
  /** Status, Priorität o. Ä. geändert */
  | { t: "update"; key: ChannelKey }
  | { t: "typing"; key: ChannelKey; name: string; staff: boolean }
  | { t: "presence"; key: ChannelKey; presence: PresenceInfo }
  | { t: "notice"; notice: StaffNotice }
  | { t: "pong" };
