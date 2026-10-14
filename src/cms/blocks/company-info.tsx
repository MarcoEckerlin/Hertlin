import type { ReactNode } from "react";
import { PhoneLink } from "@/components/site/sections/contact";
import { PlaceholderNotice } from "@/components/site/sections/legal";
import { cn } from "@/lib/cn";
import { Markdown } from "@/cms/markdown";
import { BlockSection, hasText, headingId, plain, type BlockProps } from "@/cms/blocks/shared";

const h2Base = "text-xl font-bold tracking-tight text-ink sm:text-[1.375rem]";
/** Zwischenüberschrift mit Abstand nach oben (nicht als erstes Element) */
const h2 = `${h2Base} mt-10`;
const linkClass = "font-semibold text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-800";

function Lines({ lines, className }: { lines: ReactNode[]; className?: string }) {
  const visible = lines.filter((l) => l !== null && l !== undefined && l !== false && l !== "");
  if (visible.length === 0) return null;
  return (
    <p className={className}>
      {visible.map((line, i) => (
        <span key={i} className="block">
          {line}
        </span>
      ))}
    </p>
  );
}

/**
 * Firmenangaben aus den Firmendaten.
 * - impressum: Anbieterkennzeichnung nach § 5 DDG (Firmierung, Vertretung, Anschrift, Kontakt, Register, USt-IdNr.)
 *   und Verantwortlicher nach § 18 Abs. 2 MStV
 * - kontakt:   kompakte Anschrift mit Telefon und E-Mail (z. B. „Verantwortlicher“ in der Datenschutzerklärung)
 */
export function CompanyInfoBlock({ block, ctx, layout }: BlockProps<"companyInfo">) {
  const s = ctx.settings;
  const titleId = headingId(block, layout);
  const place = [s.zip, s.city].filter((v) => v.trim()).join(" ");
  const phone = hasText(s.phone) ? <PhoneLink phone={s.phone} phoneHref={s.phoneHref} className={linkClass} /> : null;
  const email = hasText(s.email) ? (
    <a href={`mailto:${s.email.trim()}`} className={cn(linkClass, "break-words")}>
      {s.email}
    </a>
  ) : null;

  const heading = (
    <>
      {hasText(block.eyebrow) ? (
        <p className="text-sm font-bold tracking-wider text-brand-700 uppercase">{plain(block.eyebrow, ctx)}</p>
      ) : null}
      {hasText(block.title) ? (
        <h2 id={titleId} className={cn(h2Base, hasText(block.eyebrow) && "mt-2")}>
          {plain(block.title, ctx)}
        </h2>
      ) : null}
      <Markdown text={block.intro} ctx={ctx.text} variant="prose" headingBase={3} className="mt-2" />
    </>
  );

  if (block.variant === "kontakt") {
    return (
      <BlockSection block={block} layout={layout} labelledBy={titleId}>
        <div className="max-w-[44rem] text-base leading-[1.75] text-ink-soft sm:text-[1.0625rem]">
          <div>{heading}</div>
          <PlaceholderNotice
            values={[s.legalName, s.owner, s.street, s.zip, s.city, s.phone, s.email]}
            className="mt-6"
          />
          <address className={cn("not-italic", (hasText(block.title) || hasText(block.intro)) && "mt-4")}>
            <Lines
              lines={[
                hasText(s.legalName) ? <span className="font-semibold text-ink">{s.legalName}</span> : null,
                hasText(s.owner) ? s.owner : null,
                hasText(s.street) ? s.street : null,
                place || null,
              ]}
            />
            <Lines
              className="mt-3"
              lines={[
                phone ? <>Telefon: {phone}</> : null,
                email ? <>E-Mail: {email}</> : null,
              ]}
            />
          </address>
        </div>
      </BlockSection>
    );
  }

  const values = [s.legalName, s.owner, s.street, s.zip, s.city, s.phone, s.email, s.vatId, s.register];
  return (
    <BlockSection block={block} layout={layout} labelledBy={titleId}>
      <div className="max-w-[44rem] text-base leading-[1.75] text-ink-soft sm:text-[1.0625rem]">
        <PlaceholderNotice values={values} className="mb-10" />
        <div>
          {hasText(block.title) || hasText(block.eyebrow) || hasText(block.intro) ? (
            heading
          ) : (
            <h2 className={h2Base}>Angaben gemäß § 5 DDG</h2>
          )}
        </div>
        <address className="mt-3 not-italic">
          <Lines lines={[hasText(s.legalName) ? s.legalName : null, hasText(s.street) ? s.street : null, place || null]} />
        </address>
        {hasText(s.owner) ? <p className="mt-4">Vertretungsberechtigt: {s.owner}</p> : null}

        {phone || email ? (
          <>
            <h2 className={h2}>Kontakt</h2>
            <Lines
              className="mt-2"
              lines={[phone ? <>Telefon: {phone}</> : null, email ? <>E-Mail: {email}</> : null]}
            />
          </>
        ) : null}

        {hasText(s.register) ? (
          <>
            <h2 className={h2}>Registereintrag</h2>
            <p className="mt-2">{s.register}</p>
          </>
        ) : null}

        {hasText(s.vatId) ? (
          <>
            <h2 className={h2}>Umsatzsteuer-Identifikationsnummer</h2>
            <p className="mt-2">Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: {s.vatId}</p>
          </>
        ) : null}

        {hasText(s.owner) ? (
          <>
            <h2 className={h2}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
            <address className="mt-2 not-italic">
              <Lines lines={[s.owner, hasText(s.street) ? s.street : null, place || null]} />
            </address>
          </>
        ) : null}
      </div>
    </BlockSection>
  );
}
