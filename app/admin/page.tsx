import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { AdminPanelClient } from "@/app/admin/AdminPanelClient";
import { authOptions } from "@/lib/auth";
import { resolveHelpTierAsync } from "@/lib/helpRole";

export default async function AdminPage() {
  const session = await getServerSession(authOptions);
  const id = session?.user?.id?.trim();
  if (!id) {
    redirect("/");
  }
  if ((await resolveHelpTierAsync(id)) !== "admin") {
    redirect("/");
  }
  return <AdminPanelClient />;
}
