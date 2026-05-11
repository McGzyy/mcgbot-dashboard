import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";

export function hodlWalletLinkMessage(nonce: string, discordId: string): Uint8Array {
  const text = `McGBot HODL wallet link\nNonce: ${nonce}\nDiscord: ${discordId}`;
  return new TextEncoder().encode(text);
}

export function verifyHodlWalletLinkSignature(args: {
  discordId: string;
  nonce: string;
  walletPubkeyBs58: string;
  signatureBs58: string;
}): boolean {
  try {
    const msg = hodlWalletLinkMessage(args.nonce, args.discordId);
    const sig = bs58.decode(args.signatureBs58);
    const pk = new PublicKey(args.walletPubkeyBs58).toBytes();
    if (sig.length !== 64 || pk.length !== 32) return false;
    return nacl.sign.detached.verify(msg, sig, pk);
  } catch {
    return false;
  }
}
