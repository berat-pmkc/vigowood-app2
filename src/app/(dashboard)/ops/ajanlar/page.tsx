import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { APPROVAL_ROLES } from "@/lib/constants";
import { getAgents, getUsageStats } from "../actions";
import { AjanlarClient } from "./ajanlar-client";

export default async function AjanlarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!APPROVAL_ROLES.includes(user.role as (typeof APPROVAL_ROLES)[number])) {
    redirect("/ops");
  }

  const [agents, usageStats] = await Promise.all([
    getAgents(),
    getUsageStats("month"),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Ajanlar</h1>
        <p className="text-sm text-muted-foreground">
          Sanal ajan profilleri ve durumları
        </p>
      </div>
      <AjanlarClient agents={agents} usageStats={usageStats} />
    </div>
  );
}
