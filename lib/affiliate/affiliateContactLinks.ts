export type AffiliateContactMethod = {
  id: string;
  label: string;
  display: string;
  href: string | null;
  copyText: string;
};

function trimOrNull(v: string | null | undefined): string | null {
  const t = typeof v === "string" ? v.trim() : "";
  return t || null;
}

function normalizeUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) return t;
  if (t.includes(".") && !t.includes(" ")) return `https://${t}`;
  return null;
}

function xProfileUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const url = normalizeUrl(t);
  if (url && /x\.com|twitter\.com/i.test(url)) return url;
  const handle = t.replace(/^@/, "").split("/")[0]?.trim();
  if (!handle || handle.includes(" ")) return null;
  return `https://x.com/${encodeURIComponent(handle)}`;
}

function discordHref(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const url = normalizeUrl(t);
  if (url && /discord\.(gg|com)|discordapp\.com/i.test(url)) return url;
  return null;
}

/** Actionable contact methods for ops outreach on an application. */
export function buildAffiliateContactMethods(input: {
  loginEmail: string;
  contactEmail?: string | null;
  contactDiscord?: string | null;
  contactX?: string | null;
  contactOther?: string | null;
}): AffiliateContactMethod[] {
  const methods: AffiliateContactMethod[] = [];

  const loginEmail = trimOrNull(input.loginEmail);
  const contactEmail = trimOrNull(input.contactEmail);
  const preferredEmail = contactEmail ?? loginEmail;
  if (preferredEmail) {
    methods.push({
      id: "email",
      label: contactEmail ? "Contact email" : "Login email",
      display: preferredEmail,
      href: `mailto:${encodeURIComponent(preferredEmail)}`,
      copyText: preferredEmail,
    });
  }
  if (loginEmail && contactEmail && loginEmail.toLowerCase() !== contactEmail.toLowerCase()) {
    methods.push({
      id: "login-email",
      label: "Login email",
      display: loginEmail,
      href: `mailto:${encodeURIComponent(loginEmail)}`,
      copyText: loginEmail,
    });
  }

  const discord = trimOrNull(input.contactDiscord);
  if (discord) {
    methods.push({
      id: "discord",
      label: "Discord",
      display: discord,
      href: discordHref(discord),
      copyText: discord,
    });
  }

  const x = trimOrNull(input.contactX);
  if (x) {
    methods.push({
      id: "x",
      label: "X",
      display: x,
      href: xProfileUrl(x),
      copyText: x,
    });
  }

  const other = trimOrNull(input.contactOther);
  if (other) {
    methods.push({
      id: "other",
      label: "Other",
      display: other,
      href: normalizeUrl(other),
      copyText: other,
    });
  }

  return methods;
}
