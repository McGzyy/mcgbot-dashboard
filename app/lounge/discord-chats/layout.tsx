import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Discord chats",
};

export default function LoungeDiscordChatsLayout({ children }: { children: ReactNode }) {
  return children;
}
