import { sendResendEmail, formatResendFromAddress } from "@/lib/email/sendResendEmail";
import { affiliatePortalPath } from "@/lib/affiliate/affiliatePortalUrl";
import { getAffiliateById } from "@/lib/affiliate/affiliateDb";
import { fmtAffiliateUsd } from "@/lib/affiliate/affiliateFormatUsd";
import type { AffiliateAccountStatus } from "@/lib/affiliate/affiliateSession";
import type { AffiliatePayoutStatus } from "@/lib/affiliate/affiliatePayouts";

function notificationFrom(): string {
  const email =
    process.env.AFFILIATE_EMAIL_FROM?.trim() ||
    process.env.AFFILIATE_EMAIL_FROM_NOTIFICATION?.trim() ||
    "notification@affiliate.mcgbot.xyz";
  const name = process.env.AFFILIATE_EMAIL_FROM_NAME?.trim() || "McGBot Affiliates";
  return formatResendFromAddress(email, name);
}

function teamFrom(): string {
  const email =
    process.env.AFFILIATE_EMAIL_OPS_FROM?.trim() ||
    process.env.AFFILIATE_EMAIL_FROM_TEAM?.trim() ||
    "team@affiliate.mcgbot.xyz";
  const name = process.env.AFFILIATE_EMAIL_OPS_FROM_NAME?.trim() || "McGBot Affiliate Team";
  return formatResendFromAddress(email, name);
}

function replyTo(): string | undefined {
  const v = process.env.AFFILIATE_EMAIL_REPLY_TO?.trim();
  return v || undefined;
}

function opsRecipientEmails(): string[] {
  const raw =
    process.env.AFFILIATE_OPS_NOTIFY_EMAILS?.trim() ||
    process.env.AFFILIATE_EMAIL_OPS_TO?.trim() ||
    "";
  if (!raw) return [];
  return raw
    .split(/[,;]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.includes("@"));
}

function emailLayout(bodyHtml: string): string {
  return `<!DOCTYPE html><html><body style="font-family:system-ui,-apple-system,sans-serif;line-height:1.5;color:#18181b;max-width:32rem;margin:0 auto;padding:24px">
${bodyHtml}
<p style="margin-top:24px;font-size:12px;color:#71717a">McGBot Terminal · Affiliate program</p>
</body></html>`;
}

async function sendToPartner(input: {
  affiliateId: string;
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const account = await getAffiliateById(input.affiliateId);
  if (!account?.email) return;

  await sendResendEmail({
    from: notificationFrom(),
    to: account.email,
    subject: input.subject,
    html: emailLayout(input.html),
    text: input.text,
    replyTo: replyTo() || process.env.AFFILIATE_EMAIL_FROM_TEAM?.trim() || "team@affiliate.mcgbot.xyz",
  });
}

async function sendToOps(input: {
  subject: string;
  html: string;
  text: string;
}): Promise<void> {
  const recipients = opsRecipientEmails();
  if (recipients.length === 0) {
    console.warn("[affiliateNotifications] AFFILIATE_OPS_NOTIFY_EMAILS not set — ops email skipped.");
    return;
  }

  await sendResendEmail({
    from: teamFrom(),
    to: recipients,
    subject: input.subject,
    html: emailLayout(input.html),
    text: input.text,
    replyTo: replyTo(),
  });
}

export function queueAffiliateApplicationStatusEmail(
  affiliateId: string,
  status: AffiliateAccountStatus,
  denialReason?: string | null
): void {
  void (async () => {
    if (status === "active") {
      const login = affiliatePortalPath("/affiliate/login");
      await sendToPartner({
        affiliateId,
        subject: "Your McGBot affiliate application was approved",
        html: `<p>Your affiliate application has been <strong>approved</strong>.</p>
<p>Sign in to complete setup (agreement + dashboard):</p>
<p><a href="${login}">${login}</a></p>`,
        text: `Your McGBot affiliate application was approved.\n\nSign in: ${login}`,
      });
      return;
    }

    if (status === "denied") {
      const login = affiliatePortalPath("/affiliate/application");
      const reason = denialReason?.trim();
      await sendToPartner({
        affiliateId,
        subject: "Update on your McGBot affiliate application",
        html: `<p>Your affiliate application was not approved at this time.</p>
${reason ? `<p><strong>Note from our team:</strong></p><p>${escapeHtml(reason)}</p>` : ""}
<p>You can view your application status here:</p>
<p><a href="${login}">${login}</a></p>`,
        text: `Your affiliate application was not approved.${reason ? `\n\nNote: ${reason}` : ""}\n\nStatus: ${login}`,
      });
      return;
    }

    if (status === "needs_contact") {
      const login = affiliatePortalPath("/affiliate/application");
      await sendToPartner({
        affiliateId,
        subject: "McGBot affiliates — we need to reach you",
        html: `<p>We&apos;d like to connect about your affiliate application before making a decision.</p>
<p>Please check your application page for next steps, or reply to this email if you included contact details we can use.</p>
<p><a href="${login}">${login}</a></p>`,
        text: `We need to reach you about your affiliate application.\n\n${login}`,
      });
    }
  })().catch((e) => console.error("[affiliateNotifications] application status", e));
}

export function queueAffiliateNewApplicationOpsEmail(affiliateId: string): void {
  void (async () => {
    const account = await getAffiliateById(affiliateId);
    if (!account) return;
    const review = affiliatePortalPath("/affiliate/admin/partners");
    const name = account.application.legalName || account.displayName || account.email;
    await sendToOps({
      subject: `New affiliate application — ${name}`,
      html: `<p><strong>${escapeHtml(name)}</strong> (${escapeHtml(account.email)}) submitted an affiliate application.</p>
<p><a href="${review}">Review in ops console</a></p>`,
      text: `New affiliate application from ${name} (${account.email}).\n\nReview: ${review}`,
    });
  })().catch((e) => console.error("[affiliateNotifications] new application ops", e));
}

export function queueAffiliatePayoutRequestOpsEmail(input: {
  affiliateId: string;
  amountCents: number;
  requestId: string;
  partnerNote?: string | null;
}): void {
  void (async () => {
    const account = await getAffiliateById(input.affiliateId);
    if (!account) return;
    const payouts = affiliatePortalPath("/affiliate/admin/payouts");
    const note = input.partnerNote?.trim();
    await sendToOps({
      subject: `Payout request ${fmtAffiliateUsd(input.amountCents)} — ${account.email}`,
      html: `<p><strong>${escapeHtml(account.email)}</strong> requested a payout of <strong>${fmtAffiliateUsd(input.amountCents)}</strong>.</p>
${note ? `<p>Partner note: ${escapeHtml(note)}</p>` : ""}
<p>Request ID: <code>${escapeHtml(input.requestId)}</code></p>
<p><a href="${payouts}">Review payouts</a></p>`,
      text: `Payout request ${fmtAffiliateUsd(input.amountCents)} from ${account.email}.${note ? ` Note: ${note}` : ""}\n\n${payouts}`,
    });
  })().catch((e) => console.error("[affiliateNotifications] payout ops", e));
}

export function queueAffiliatePayoutStatusEmail(input: {
  affiliateId: string;
  amountCents: number;
  status: AffiliatePayoutStatus;
  adminNote?: string | null;
}): void {
  void (async () => {
    if (input.status === "pending") return;

    const earnings = affiliatePortalPath("/affiliate/earnings");
    const amount = fmtAffiliateUsd(input.amountCents);
    const adminNote = input.adminNote?.trim();

    if (input.status === "approved") {
      await sendToPartner({
        affiliateId: input.affiliateId,
        subject: `Payout request approved (${amount})`,
        html: `<p>Your payout request for <strong>${amount}</strong> was <strong>approved</strong> and is being processed.</p>
${adminNote ? `<p><strong>Note:</strong> ${escapeHtml(adminNote)}</p>` : ""}
<p><a href="${earnings}">View earnings</a></p>`,
        text: `Your payout request for ${amount} was approved.${adminNote ? ` Note: ${adminNote}` : ""}\n\n${earnings}`,
      });
      return;
    }

    if (input.status === "paid") {
      await sendToPartner({
        affiliateId: input.affiliateId,
        subject: `Payout sent (${amount})`,
        html: `<p>Your payout of <strong>${amount}</strong> has been marked <strong>paid</strong>.</p>
${adminNote ? `<p><strong>Note:</strong> ${escapeHtml(adminNote)}</p>` : ""}
<p><a href="${earnings}">View earnings</a></p>`,
        text: `Your payout of ${amount} was marked paid.${adminNote ? ` Note: ${adminNote}` : ""}\n\n${earnings}`,
      });
      return;
    }

    if (input.status === "rejected") {
      await sendToPartner({
        affiliateId: input.affiliateId,
        subject: `Payout request update (${amount})`,
        html: `<p>Your payout request for <strong>${amount}</strong> was <strong>not approved</strong>.</p>
${adminNote ? `<p><strong>Note:</strong> ${escapeHtml(adminNote)}</p>` : ""}
<p><a href="${earnings}">View earnings</a></p>`,
        text: `Your payout request for ${amount} was not approved.${adminNote ? ` Note: ${adminNote}` : ""}\n\n${earnings}`,
      });
    }
  })().catch((e) => console.error("[affiliateNotifications] payout status", e));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
