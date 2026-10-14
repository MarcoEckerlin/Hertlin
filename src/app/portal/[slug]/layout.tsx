import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPortalCompany, getPortalSlugFromHost } from "@/lib/auth";

type Props = { params: Promise<{ slug: string }>; children: React.ReactNode };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const company = await getPortalCompany(slug);
  return {
    title: { default: "Kundenportal", template: `%s | ${company?.name ?? "Kundenportal"} · Hertlin` },
    robots: { index: false, follow: false },
  };
}

/** Kundenportal: nur über die passende Subdomain eines aktiven Firmenkunden erreichbar. */
export default async function PortalRootLayout({ params, children }: Props) {
  const { slug } = await params;
  const hostSlug = await getPortalSlugFromHost();
  if (hostSlug !== slug) notFound();
  const company = await getPortalCompany(slug);
  if (!company) notFound();
  return children;
}
