import { isInquiryTopic } from "@/components/forms/form-options";
import type { CustomerType, InquiryTopic } from "@/lib/constants";
import { firstParam, type BlockContext } from "@/cms/blocks/shared";

/** ?typ=privat | ?typ=unternehmen (auch „firma“) */
function customerTypeFromQuery(value: string | undefined): CustomerType | undefined {
  const v = value?.trim().toLowerCase();
  if (v === "privat" || v === "private") return "PRIVATE";
  if (v === "unternehmen" || v === "firma" || v === "business") return "BUSINESS";
  return undefined;
}

/** Vorauswahl des Anfrageformulars aus der Adresse (?typ=, ?thema=), sonst aus dem Modul. */
export function inquiryDefaults(
  ctx: Pick<BlockContext, "searchParams">,
  fallback: CustomerType,
): { defaultType: CustomerType; defaultTopic: InquiryTopic | undefined } {
  const thema = firstParam(ctx.searchParams.thema)?.trim().toUpperCase();
  const defaultTopic = isInquiryTopic(thema) ? thema : undefined;
  // „Hilfe für zu Hause“ gibt es nur für Privatpersonen – dann den Kundentyp gleich passend setzen.
  const defaultType =
    customerTypeFromQuery(firstParam(ctx.searchParams.typ)) ?? (defaultTopic === "PRIVAT_HILFE" ? "PRIVATE" : fallback);
  return { defaultType, defaultTopic };
}

/**
 * Einleitung aufteilen: Was vor der ersten Zwischenüberschrift steht (z. B. kurze Hinweise für Bestandskunden),
 * kommt über das Formular; ab der ersten Zwischenüberschrift (z. B. „So geht es weiter“) steht der Text
 * am Desktop links neben dem Formular und auf dem Handy darunter.
 */
export function splitIntro(text: string | null | undefined): { lead: string; rest: string } {
  if (!text) return { lead: "", rest: "" };
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const index = lines.findIndex((line) => /^\s*#{1,3}\s+\S/.test(line));
  if (index <= 0) return index === 0 ? { lead: "", rest: text } : { lead: text, rest: "" };
  return { lead: lines.slice(0, index).join("\n").trim(), rest: lines.slice(index).join("\n").trim() };
}
