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
