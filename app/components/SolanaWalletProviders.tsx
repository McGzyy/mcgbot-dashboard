"use client";

import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import {
  NightlyWalletAdapter,
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { useMemo, type ReactNode } from "react";
import { solanaRpcUrlPublic } from "@/lib/solanaEnv";

import "@solana/wallet-adapter-react-ui/styles.css";

export function SolanaWalletProviders({ children }: { children: ReactNode }) {
  const endpoint = useMemo(() => solanaRpcUrlPublic(), []);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new NightlyWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* WalletModal only calls `select()`; the adapter connects via WalletProvider auto-connect when this is true. */}
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
