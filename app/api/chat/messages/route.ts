import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

type DiscordApiMessage = {
  id?: string;
  content?: string;
  timestamp?: string;
  author?: {
    username?: string;
    global_name?: string | null;
  };
};

function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  return v;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const channelId =
    requireEnv("DISCORD_GENERAL_CHAT_CHANNEL_ID") ||
    requireEnv("DISCORD_CHAT_CHANNEL_ID");
  const token = requireEnv("DISCORD_TOKEN");

  if (!channelId) {
    return Response.json(
      {
        error:
          "Chat is not configured (missing DISCORD_GENERAL_CHAT_CHANNEL_ID).",
      },
      { status: 503 }
    );
  }
  if (!token) {
    return Response.json(
      { error: "Chat is not configured (missing DISCORD_TOKEN)." },
      { status: 503 }
    );
  }

  const res = await fetch(
    `https://discord.com/api/v10/channels/${encodeURIComponent(
      channelId
    )}/messages?limit=30`,
    {
      headers: { Authorization: `Bot ${token}` },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    return Response.json(
      { error: `Discord API error (${res.status}) ${txt}`.trim() },
      { status: 502 }
    );
  }

  const raw = (await res.json().catch(() => [])) as DiscordApiMessage[];
  const messages = (Array.isArray(raw) ? raw : [])
    .map((m) => {
      const id = String(m.id ?? "");
      const content = String(m.content ?? "").trim();
      const createdAt = m.timestamp ? Date.parse(m.timestamp) : Date.now();
      const authorName = String(m.author?.global_name || m.author?.username || "Unknown");
      const authorHandle = m.author?.username ? `@${String(m.author.username)}` : undefined;
      return { id, content, createdAt, authorName, authorHandle };
    })
    .filter((m) => m.id && m.content)
    .sort((a, b) => a.createdAt - b.createdAt);

  return Response.json({ messages });
}

