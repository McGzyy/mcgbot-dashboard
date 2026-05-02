import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
import { Analytics } from "@vercel/analytics/next";
import { AppChrome } from "./components/AppChrome";
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
      <body className="min-h-screen bg-[#050505] text-zinc-100 antialiased">
        <Providers session={session}>
          <AppChrome>{children}</AppChrome>
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
