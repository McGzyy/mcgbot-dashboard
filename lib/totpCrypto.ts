import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const SALT = "mcgbot-dashboard-totp-v1";
const ALGO = "aes-256-gcm";

function deriveKey(): Buffer {
  const env = process.env.TOTP_ENCRYPTION_KEY?.trim();
  if (!env) {
    throw new Error("TOTP_ENCRYPTION_KEY is not configured");
  }
  if (/^[0-9a-f]{64}$/i.test(env)) {
    return Buffer.from(env, "hex");
  }
  return scryptSync(env, SALT, 32);
}

/** Returns dot-separated base64url(iv.tag.ciphertext). */
export function encryptTotpSecret(plain: string): string {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decryptTotpSecret(payload: string): string {
  const key = deriveKey();
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Invalid payload");
  const [ivs, tags, encs] = parts;
  const iv = Buffer.from(ivs!, "base64url");
  const tag = Buffer.from(tags!, "base64url");
  const enc = Buffer.from(encs!, "base64url");
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function isTotpCryptoConfigured(): boolean {
  return Boolean(process.env.TOTP_ENCRYPTION_KEY?.trim());
}
