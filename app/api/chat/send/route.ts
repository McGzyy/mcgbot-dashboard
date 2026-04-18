import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  canUseModDashboardChat,
  parseDashboardChatKind,
  resolveDashboardChatChannelId,
} from "@/lib/dashboardChat";
import {
  executeDashboardChatWebhook,
  isDiscordWebhookExecuteUrl,
  resolveDashboardChatWebhookUrl,
} from "@/lib/discordChatWebhook";

function requireEnv(name: string): string {
  const v = (process.env[name] ?? "").trim();
  return v;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id?.trim() ?? "";
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as unknown;
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const content = typeof o.content === "string" ? o.content : "";
  const trimmed = content.trim();
  if (!trimmed) {
    return Response.json({ error: "Message is empty" }, { status: 400 });
  }

  if (trimmed.length > 500) {
    return Response.json({ error: "Message too long" }, { status: 400 });
  }

  const kind = parseDashboardChatKind(
    typeof o.channel === "string" ? o.channel : undefined
  );

  if (kind === "mod" && !canUseModDashboardChat(userId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const webhookUrl = resolveDashboardChatWebhookUrl(kind);

  if (webhookUrl) {
    if (!isDiscordWebhookExecuteUrl(webhookUrl)) {
      return Response.json(
        {
          error:
            "Invalid DISCORD_*_CHAT_WEBHOOK_URL (must be https://discord.com/… or https://discordapp.com/… + /api/webhooks/{id}/{token}).",
        },
        { status: 500 }
      );
    }

    const su = session?.user;
    const displayName = (
      su?.name?.trim() ||
      su?.email?.trim() ||
      `User ${userId.slice(0, 6)}`
    ).slice(0, 80);
    const avatarUrl = typeof su?.image === "string" ? su.image : null;

    try {
      const res = await executeDashboardChatWebhook(webhookUrl, {
        content: trimmed,
        username: displayName,
        avatarUrl,
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        return Response.json(
          { error: `Discord webhook error (${res.status}) ${txt}`.trim() },
          { status: 502 }
        );
      }
      return Response.json({ success: true, via: "webhook" as const });
    } catch {
      return Response.json(
        { error: "Failed to send message" },
        { status: 500 }
      );
    }
  }

  const channelId = resolveDashboardChatChannelId(kind);
  const token = requireEnv("DISCORD_TOKEN");

  if (!channelId) {
    return Response.json(
      {
        error:
          kind === "mod"
            ? "Mod chat is not configured (set DISCORD_MOD_CHAT_WEBHOOK_URL or DISCORD_MOD_CHAT_CHANNEL_ID + DISCORD_TOKEN)."
            : "Chat is not configured (set DISCORD_GENERAL_CHAT_WEBHOOK_URL or DISCORD_GENERAL_CHAT_CHANNEL_ID + DISCORD_TOKEN).",
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

  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${encodeURIComponent(
        channelId
      )}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bot ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: trimmed }),
      }
    );

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return Response.json(
        { error: `Discord API error (${res.status}) ${txt}`.trim() },
        { status: 502 }
      );
    }
    return Response.json({ success: true, via: "bot" as const });
  } catch {
    return Response.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

