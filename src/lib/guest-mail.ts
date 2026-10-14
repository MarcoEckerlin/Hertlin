/**
 * Anrede für E-Mails an Adressen, die niemand bestätigt hat (öffentliche Formulare, Status-Link).
 * Name und Betreff kommen dort ungeprüft aus dem Formular. Damit niemand über unseren Mailserver fremden Text
 * mit Telefonnummern oder Links an beliebige Empfänger schickt, übernehmen wir nur Namen, die wie ein Name
 * aussehen (Buchstaben, Leerzeichen, Punkt, Bindestrich, Apostroph) – sonst „Guten Tag,“.
 */
export function guestGreeting(name: string | null | undefined): string {
  const clean = (name ?? "").replace(/\s+/g, " ").trim();
  return clean.length <= 60 && /^\p{L}[\p{L}\p{M} .'’-]*$/u.test(clean) ? `Guten Tag ${clean},` : "Guten Tag,";
}
