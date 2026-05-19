export type AffiliateApplicationInput = {
  legalName: string;
  companyName?: string | null;
  country: string;
  primaryChannel: string;
  audienceSize: string;
  promoMethods: string;
  socialLinks: string;
  websiteUrl?: string | null;
  notes?: string | null;
  contactEmail?: string | null;
  contactDiscord?: string | null;
  contactX?: string | null;
  contactOther?: string | null;
  acceptedDraftTerms: boolean;
};

const CHANNELS = new Set([
  "discord",
  "x",
  "youtube",
  "tiktok",
  "twitch",
  "newsletter",
  "other",
]);

const AUDIENCE = new Set(["under_1k", "1k_10k", "10k_50k", "50k_plus"]);

export function validateAffiliateApplication(
  raw: Record<string, unknown>
): { ok: true; value: AffiliateApplicationInput } | { ok: false; error: string } {
  const legalName = typeof raw.legalName === "string" ? raw.legalName.trim() : "";
  const companyName = typeof raw.companyName === "string" ? raw.companyName.trim() : "";
  const country = typeof raw.country === "string" ? raw.country.trim() : "";
  const primaryChannel = typeof raw.primaryChannel === "string" ? raw.primaryChannel.trim() : "";
  const audienceSize = typeof raw.audienceSize === "string" ? raw.audienceSize.trim() : "";
  const promoMethods = typeof raw.promoMethods === "string" ? raw.promoMethods.trim() : "";
  const socialLinks = typeof raw.socialLinks === "string" ? raw.socialLinks.trim() : "";
  const websiteUrl = typeof raw.websiteUrl === "string" ? raw.websiteUrl.trim() : "";
  const notes = typeof raw.notes === "string" ? raw.notes.trim() : "";
  const contactEmail = typeof raw.contactEmail === "string" ? raw.contactEmail.trim() : "";
  const contactDiscord = typeof raw.contactDiscord === "string" ? raw.contactDiscord.trim() : "";
  const contactX = typeof raw.contactX === "string" ? raw.contactX.trim() : "";
  const contactOther = typeof raw.contactOther === "string" ? raw.contactOther.trim() : "";
  const acceptedDraftTerms = raw.acceptedDraftTerms === true;

  if (legalName.length < 2 || legalName.length > 120) {
    return { ok: false, error: "Enter your legal name (2–120 characters)." };
  }
  if (!country || country.length > 80) {
    return { ok: false, error: "Select or enter your country." };
  }
  if (!CHANNELS.has(primaryChannel)) {
    return { ok: false, error: "Select your primary promotion channel." };
  }
  if (!AUDIENCE.has(audienceSize)) {
    return { ok: false, error: "Select your approximate audience size." };
  }
  if (promoMethods.length < 20 || promoMethods.length > 2000) {
    return { ok: false, error: "Describe how you plan to promote McGBot (at least 20 characters)." };
  }
  if (socialLinks.length < 4 || socialLinks.length > 1500) {
    return { ok: false, error: "Add at least one social or community link." };
  }
  if (websiteUrl && websiteUrl.length > 500) {
    return { ok: false, error: "Website URL is too long." };
  }
  if (!acceptedDraftTerms) {
    return { ok: false, error: "You must accept the application terms to apply." };
  }
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return { ok: false, error: "Enter a valid contact email or leave it blank." };
  }
  const contactMethods = [contactDiscord, contactX, contactOther].filter(Boolean).length;
  if (contactMethods < 1) {
    return {
      ok: false,
      error: "Add at least one direct contact method (Discord, X, or other) so we can reach you.",
    };
  }
  if (contactDiscord.length > 200 || contactX.length > 200 || contactOther.length > 300) {
    return { ok: false, error: "A contact field is too long." };
  }

  return {
    ok: true,
    value: {
      legalName,
      companyName: companyName || null,
      country,
      primaryChannel,
      audienceSize,
      promoMethods,
      socialLinks,
      websiteUrl: websiteUrl || null,
      notes: notes || null,
      contactEmail: contactEmail || null,
      contactDiscord: contactDiscord || null,
      contactX: contactX || null,
      contactOther: contactOther || null,
      acceptedDraftTerms,
    },
  };
}

export const AFFILIATE_PRIMARY_CHANNEL_LABELS: Record<string, string> = {
  discord: "Discord",
  x: "X (Twitter)",
  youtube: "YouTube",
  tiktok: "TikTok",
  twitch: "Twitch",
  newsletter: "Newsletter / email",
  other: "Other",
};

export const AFFILIATE_AUDIENCE_LABELS: Record<string, string> = {
  under_1k: "Under 1,000",
  "1k_10k": "1,000 – 10,000",
  "10k_50k": "10,000 – 50,000",
  "50k_plus": "50,000+",
};
