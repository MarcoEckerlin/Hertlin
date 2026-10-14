import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { rootDomain } from "@/lib/hosts";
import { getSiteSettings } from "@/lib/settings";
import { THEME_COOKIE, parseThemeChoice, themeCookieDomain } from "@/lib/theme";

export async function generateMetadata(): Promise<Metadata> {
  const site = await getSiteSettings();
  return {
    title: {
      default: `${site.name} – ${site.tagline}`,
      template: `%s | ${site.name}`,
    },
    description:
      "Hertlin betreut die IT kleiner und mittlerer Unternehmen und hilft Privatkunden bei Problemen mit PC, WLAN und Drucker. Mit eigenem Kundenportal und festen Ansprechpartnern.",
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#66b9ec" },
    { media: "(prefers-color-scheme: dark)", color: "#101d2b" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Hell/Dunkel aus dem Cookie (ohne Cookie: wie das Gerät, per CSS-Media-Query)
  const theme = parseThemeChoice((await cookies()).get(THEME_COOKIE)?.value);
  const requestHeaders = await headers();
  const cookieDomain = themeCookieDomain(rootDomain(), requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"));

  return (
    <html
      lang="de"
      className="h-full"
      data-theme={theme === "system" ? undefined : theme}
      data-cookie-domain={cookieDomain ?? undefined}
      // Seitenwechsel springen sofort nach oben, Sprünge innerhalb der Seite scrollen weich
      data-scroll-behavior="smooth"
      // Umschalter und Übersetzer ändern Attribute an <html> im Browser
      suppressHydrationWarning
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
