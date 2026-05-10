import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const KEY_LEN = 32;

function loadEncryptionKeyBytes(): Buffer {
  const raw = process.env.COPY_TRADE_WALLET_ENCRYPTION_KEY?.trim();
  if (!raw) {
    throw new Error("COPY_TRADE_WALLET_ENCRYPTION_KEY is not set.");
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== KEY_LEN) {
    throw new Error("COPY_TRADE_WALLET_ENCRYPTION_KEY must decode to 32 bytes (use 64 hex chars or base64).");
  }
  return buf;
}

/**
 * Encrypts a 64-byte Solana secret key for storage (AES-256-GCM).
 * Format: base64(iv 12 || tag 16 || ciphertext).
 */
export function encryptCopyTradeWalletSecret(secretKey64: Uint8Array): string {
  if (secretKey64.length !== 64) {
    throw new Error("Solana secret key must be 64 bytes.");
  }
  const key = loadEncryptionKeyBytes();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(secretKey64)), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptCopyTradeWalletSecret(encryptedB64: string): Uint8Array {
  const buf = Buffer.from(encryptedB64, "base64");
  if (buf.length < 12 + 16 + 1) {
    throw new Error("Invalid encrypted wallet payload.");
  }
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const key = loadEncryptionKeyBytes();
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  if (out.length !== 64) {
    throw new Error("Decrypted secret has wrong length.");
  }
  return new Uint8Array(out);
}
