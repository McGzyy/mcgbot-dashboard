/** Marketing / UX copy for the affiliate application flow. */

export const AFFILIATE_APPLY_STEPS = [
  { id: 1, title: "Account", description: "Email & password for the affiliate portal" },
  { id: 2, title: "Your reach", description: "Who you are and how you promote" },
  { id: 3, title: "Review", description: "Confirm and submit" },
] as const;

export const AFFILIATE_AFTER_APPLY_STEPS = [
  "Set up mandatory authenticator 2FA",
  "Our team reviews your application",
  "When approved, sign the affiliate agreement",
  "Access your dashboard, tracking link, and campaigns",
] as const;

export const AFFILIATE_APPLY_COUNTRIES = [
  "United States",
  "Canada",
  "United Kingdom",
  "Australia",
  "Germany",
  "France",
  "Netherlands",
  "Brazil",
  "Mexico",
  "India",
  "Philippines",
  "Singapore",
  "Other",
] as const;

export function passwordStrengthHint(password: string): {
  level: "weak" | "fair" | "good" | "empty";
  message: string;
} {
  if (!password) return { level: "empty", message: "Use at least 12 characters." };
  if (password.length < 12) {
    return { level: "weak", message: `${12 - password.length} more characters needed` };
  }
  let score = 0;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (password.length >= 16) score++;
  if (score <= 1) return { level: "fair", message: "Acceptable — add mixed case, numbers, or symbols for strength." };
  return { level: "good", message: "Strong password." };
}
