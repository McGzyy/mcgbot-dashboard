import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getServerSession } from "next-auth";
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

export const metadata: Metadata = {
  title: "McGBot Dashboard",
  description: "Referrals and stats for McGBot",
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
      </body>
    </html>
  );
}
