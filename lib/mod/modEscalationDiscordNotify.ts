import { isDiscordWebhookExecuteUrl } from "@/lib/discordChatWebhook";
import { siteOriginForOG } from "@/lib/profileRouteMeta";
import type { ModEscalationRow } from "@/lib/mod/modQueueOps";

const REASON_TRUNCATE = 500;

function resolveModEscalationDiscordWebhookUrl(): string | null {
  const raw = (process.env.MOD_ESCALATION_DISCORD_WEBHOOK_URL ?? "").trim();
  if (!raw) return null;
  if (!isDiscordWebhookExecuteUrl(raw)) {
    console.warn(
      "[modEscalationDiscordNotify] MOD_ESCALATION_DISCORD_WEBHOOK_URL is not a valid Discord webhook URL"
    );
    return null;
  }
  return raw;
}

/** Dashboard origin for admin deep links (NEXTAUTH_URL preferred). */
function resolveDashboardPublicOrigin(): string {
  const nextAuth = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (nextAuth) return nextAuth;
  return siteOriginForOG();
}

function truncateReason(reason: string): string {
  const trimmed = reason.trim();
  if (trimmed.length <= REASON_TRUNCATE) return trimmed;
  return `${trimmed.slice(0, REASON_TRUNCATE - 1)}…`;
}

/**
 * Fire-and-forget Discord alert when a mod escalation is created.
 * Never throws; logs failures to console only.
 */
export function notifyModEscalationCreated(row: ModEscalationRow): void {
  void sendModEscalationDiscordWebhook(row).catch((err) => {
    console.error("[modEscalationDiscordNotify] webhook failed:", err);
  });
}

async function sendModEscalationDiscordWebhook(row: ModEscalationRow): Promise<void> {
  const webhookUrl = resolveModEscalationDiscordWebhookUrl();
  if (!webhookUrl) return;

  const origin = resolveDashboardPublicOrigin().replace(/\/$/, "");
  const inboxUrl = `${origin}/admin/mod-escalations`;
  const reason = truncateReason(row.reason);
  const raisedBy = row.raisedByDiscordId.trim() || "unknown";

  const body = {
    content: `**Mod escalation** · \`${row.subjectType}\` / \`${row.subjectId}\``,
    embeds: [
      {
        title: "New mod escalation",
        url: inboxUrl,
        color: 0xef4444,
        fields: [
          {
            name: "Subject",
            value: `\`${row.subjectType}\` · \`${row.subjectId}\``,
            inline: false,
          },
          {
            name: "Reason",
            value: reason || "—",
            inline: false,
          },
          {
            name: "Raised by",
            value: raisedBy === "unknown" ? "unknown" : `\`${raisedBy}\``,
            inline: true,
          },
          {
            name: "Escalation id",
            value: `\`${row.id}\``,
            inline: true,
          },
        ],
        footer: { text: "McGBot mod staff" },
      },
    ],
    allowed_mentions: { parse: [] as string[] },
  };

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    console.error(
      `[modEscalationDiscordNotify] Discord returned ${res.status}${txt ? `: ${txt.slice(0, 200)}` : ""}`
    );
  }
}
