import type { Metadata, Viewport } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";
import { site } from "@/config/site";

export const metadata: Metadata = {
  title: {
    default: `${site.name} – ${site.tagline}`,
    template: `%s | ${site.name}`,
  },
  description:
    "Hertlin betreut die IT kleiner und mittlerer Unternehmen und hilft Privatkunden bei Problemen mit PC, WLAN und Drucker. Mit eigenem Kundenportal und festen Ansprechpartnern.",
};

export const viewport: Viewport = {
  themeColor: "#66b9ec",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
