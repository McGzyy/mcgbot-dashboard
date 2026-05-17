import { redirect } from "next/navigation";

/** Copy trade is hidden from the product for now; backend routes remain for a future relaunch. */
export default function CopyTradePage() {
  redirect("/");
}
