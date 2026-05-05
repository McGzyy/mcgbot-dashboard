import type { Metadata } from "next";
import ProfilePageClient from "./ProfilePageClient";
import {
  fetchProfileMeta,
  profileMetaDescription,
  resolveRequestSiteOrigin,
  siteOriginForOG,
} from "@/lib/profileRouteMeta";

export const revalidate = 120;

type PageProps = { params: Promise<{ id: string }> };

export default function UserProfilePage() {
  return <ProfilePageClient />;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id: raw } = await params;
  const routeParam = decodeURIComponent(String(raw ?? "")).trim();
  const origin = (await resolveRequestSiteOrigin()).replace(/\/$/, "");

  if (!routeParam) {
    return {
      title: "Profile",
      description: "McGBot Terminal caller profile.",
    };
  }

  const profile = await fetchProfileMeta(origin, routeParam);
  const titleBase = profile?.displayName ?? "Profile";
  const title = `${titleBase} · McGBot`;
  const description = profile
    ? profileMetaDescription(profile)
    : "Caller profile on McGBot Terminal.";

  /** Crawlers often need a stable absolute OG host (production). */
  const ogHost = siteOriginForOG().replace(/\/$/, "");
  const ogImageUrl = `${ogHost}/user/${encodeURIComponent(routeParam)}/opengraph-image`;

  const canonicalPath = `/user/${routeParam}`;

  return {
    title,
    description,
    alternates: {
      canonical: `${origin}${canonicalPath}`,
    },
    openGraph: {
      type: "profile",
      url: `${origin}${canonicalPath}`,
      siteName: "McGBot Terminal",
      title,
      description,
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${titleBase} on McGBot`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImageUrl],
    },
  };
}
