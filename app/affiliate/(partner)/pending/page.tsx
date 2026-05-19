import { redirect } from "next/navigation";

/** @deprecated Use /affiliate/application */
export default function AffiliatePendingRedirectPage() {
  redirect("/affiliate/application");
}
