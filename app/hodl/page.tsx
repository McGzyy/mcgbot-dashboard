import type { Metadata } from "next";
import { HodlClient } from "./HodlClient";

export const metadata: Metadata = {
  title: "HODL",
};

export default function HodlPage() {
  return <HodlClient />;
}
