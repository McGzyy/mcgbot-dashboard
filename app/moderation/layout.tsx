import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Moderation",
};

export default function ModerationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
