import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/react";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { AppChrome } from "./components/AppChrome";
import { InstallPrompt } from "./components/pwa/InstallPrompt";
import { IosLegacyStandaloneBanner } from "./components/pwa/IosLegacyStandaloneBanner";
import { MobileViewportFix } from "./components/pwa/MobileViewportFix";
import { ServiceWorkerRegister } from "./components/pwa/ServiceWorkerRegister";
import { Providers } from "./providers";
import { authOptions } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

function resolveMetadataBase(): URL | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  try {
    const normalized = raw.endsWith("/") ? raw.slice(0, -1) : raw;
    return new URL(normalized);
  } catch {
    return undefined;
  }
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  applicationName: "McGBot Terminal",
  title: {
    default: "Dashboard",
    template: "%s · McGBot Terminal",
  },
  description:
    "McGBot Terminal — referrals, verified calls, leaderboards, and caller performance on Solana.",
  openGraph: {
    type: "website",
    siteName: "McGBot Terminal",
    title: "McGBot Terminal",
    description:
      "McGBot Terminal — referrals, verified calls, leaderboards, and caller performance on Solana.",
  },
  twitter: {
    card: "summary_large_image",
    title: "McGBot Terminal",
  },
  appleWebApp: {
    title: "McGBot",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#050505",
};

/** Session must be resolved on the server so staff/admin flags match JWT before client hydration. */
export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await getServerSession(authOptions);
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-[color:var(--mcg-page)] text-zinc-100 antialiased supports-[padding:env(safe-area-inset-bottom)]:pb-[env(safe-area-inset-bottom)]">
        <InstallPrompt />
        <IosLegacyStandaloneBanner />
        <MobileViewportFix />
        <ServiceWorkerRegister />
        <Providers session={session}>
          <AppChrome>{children}</AppChrome>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
