import type { NextConfig } from "next";

/**
 * Content-Security-Policy: nur eigene Skripte/Styles (Next.js braucht Inline-Skripte für die Hydration),
 * Bilder und Verbindungen nur zur eigenen Adresse (inkl. WebSocket), keine Einbettung in fremde Seiten.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

/** Für PDF-Antworten: keine Skripte, nur der eingebaute Betrachter des Browsers (object-src). */
const PDF_CONTENT_SECURITY_POLICY = "default-src 'none'; object-src 'self'; style-src 'unsafe-inline'; frame-ancestors 'self'";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // pdfkit liest seine Schriftdateien zur Laufzeit aus node_modules (Rechnungs-PDFs)
  serverExternalPackages: ["nodemailer", "pdfkit"],
  experimental: {
    serverActions: {
      // Ticket-Anhänge (max. 5 Dateien à 10 MB) werden per Server Action hochgeladen
      bodySizeLimit: "55mb",
    },
    proxyClientMaxBodySize: "55mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HSTS wird von Browsern nur über HTTPS beachtet; includeSubDomains deckt alle Kundenportale ab
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Content-Security-Policy", value: CONTENT_SECURITY_POLICY }] : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // Rechnungs-PDF in der Verwaltung ansehen: Der PDF-Betrachter des Browsers braucht object-src.
      // Spätere Regeln überschreiben frühere mit demselben Header.
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              source: "/admin/rechnungen/:id/pdf",
              headers: [{ key: "Content-Security-Policy", value: PDF_CONTENT_SECURITY_POLICY }],
            },
          ]
        : []),
    ];
  },
};

export default nextConfig;
