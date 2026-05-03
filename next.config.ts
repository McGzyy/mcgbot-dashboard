import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Monorepo: parent folder has its own lockfile; Turbopack must resolve deps from this app. */
const turbopackRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: turbopackRoot,
  },
  transpilePackages: [
    "@solana/wallet-adapter-base",
    "@solana/wallet-adapter-react",
    "@solana/wallet-adapter-react-ui",
    "@solana/wallet-adapter-wallets",
  ],
};

export default nextConfig;
