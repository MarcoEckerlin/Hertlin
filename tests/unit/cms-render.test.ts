import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Markdown } from "@/cms/markdown";
import { buildPlaceholderContext } from "@/cms/placeholders";

const ctx = buildPlaceholderContext({
  name: "Hertlin", legalName: "Hertlin IT-Service", phone: "0711 123456", phoneHref: "+49711123456",
  email: "info@hertlin.de", supportEmail: "support@hertlin.de", region: "Raum Stuttgart", street: "Hauptstraße 1",
  zip: "70173", city: "Stuttgart", remoteSupportUrl: "https://get.teamviewer.com/x", hostingProvider: "Hoster GmbH", logRetentionDays: 14,
});

describe("smoke", () => {
  it("renders", () => {
    const html = renderToStaticMarkup(createElement(Markdown, { text: "Hallo **{firma}** [Kontakt](/kontakt) [x](javascript:alert(1)) {telefon}\nZeile <b>x</b>", ctx }));
    console.log(html);
    expect(html).toContain("Hertlin");
  });
});
