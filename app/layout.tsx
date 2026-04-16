import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { MainShell } from "./components/MainShell";
import { Sidebar } from "./components/Sidebar";
import { Providers } from "./providers";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen bg-[#050505] text-zinc-100 antialiased">
        <Providers>
          <div className="flex min-h-screen">
            <Sidebar />
            <MainShell>{children}</MainShell>
          </div>
        </Providers>
      </body>
    </html>
  );
}
