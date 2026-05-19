import { Resend } from "resend";

export type SendResendEmailInput = {
  from: string;
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

let warnedMissingKey = false;

function resendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn("[sendResendEmail] RESEND_API_KEY not set — emails skipped.");
    }
    return null;
  }
  return new Resend(key);
}

export function formatResendFromAddress(email: string, displayName?: string | null): string {
  const addr = email.trim();
  const name = displayName?.trim();
  if (!name) return addr;
  return `${name} <${addr}>`;
}

export async function sendResendEmail(
  input: SendResendEmailInput
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const client = resendClient();
  if (!client) return { ok: false, error: "email_not_configured" };

  const to = Array.isArray(input.to) ? input.to.filter(Boolean) : [input.to];
  if (to.length === 0) return { ok: false, error: "no_recipients" };

  try {
    const { data, error } = await client.emails.send({
      from: input.from,
      to,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo: input.replyTo?.trim() || undefined,
    });
    if (error) {
      console.error("[sendResendEmail]", error);
      return { ok: false, error: error.message || "send_failed" };
    }
    return { ok: true, id: data?.id ?? "" };
  } catch (e) {
    console.error("[sendResendEmail]", e);
    return { ok: false, error: "send_failed" };
  }
}
