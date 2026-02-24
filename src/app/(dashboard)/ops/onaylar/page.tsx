import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { APPROVAL_ROLES } from "@/lib/constants";
import { getTasks } from "../actions";
import { OnaylarClient } from "./onaylar-client";

export default async function OnaylarPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  if (!APPROVAL_ROLES.includes(user.role as (typeof APPROVAL_ROLES)[number])) {
    redirect("/ops");
  }

  const tasks = await getTasks({ status: "waiting_approval" });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Onaylar</h1>
        <p className="text-sm text-muted-foreground">
          Onay bekleyen görevler ({tasks.length})
        </p>
      </div>
      <OnaylarClient tasks={tasks} />
    </div>
  );
}
