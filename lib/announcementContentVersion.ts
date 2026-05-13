import { createHash } from "crypto";

export type AnnouncementVersionSource = {
  announcement_enabled: boolean;
  announcement_message: string | null;
  announcement_message_mobile: string | null;
  announcement_hide_on_mobile: boolean;
  announcement_allow_user_dismiss: boolean;
  announcement_cta_label: string | null;
  announcement_cta_url: string | null;
  announcement_visible_from: string | null;
  announcement_visible_until: string | null;
};

/** Stable id for localStorage: changes when any announcement-facing field changes. */
export function computeAnnouncementContentVersion(i: AnnouncementVersionSource): string {
  const parts = [
    i.announcement_enabled ? "1" : "0",
    i.announcement_message ?? "",
    i.announcement_message_mobile ?? "",
    i.announcement_hide_on_mobile ? "1" : "0",
    i.announcement_allow_user_dismiss ? "1" : "0",
    i.announcement_cta_label ?? "",
    i.announcement_cta_url ?? "",
    i.announcement_visible_from ?? "",
    i.announcement_visible_until ?? "",
  ];
  return createHash("sha256").update(parts.join("\u001f"), "utf8").digest("hex").slice(0, 24);
}
