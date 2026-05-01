import Stripe from "stripe";

export function getStripe(): Stripe | null {
  const key = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!key) return null;
  return new Stripe(key);
}

export function checkoutBaseUrl(): string {
  const u = (process.env.NEXTAUTH_URL ?? "").trim().replace(/\/+$/, "");
  if (u) return u;
  return "http://localhost:3000";
}
