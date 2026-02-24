import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTasks } from "../actions";
import { GorevlerimClient } from "./components/gorevlerim-client";

export default async function GorevlerimPage({
  searchParams,
}: {
  searchParams: Promise<{
    department?: string;
    priority?: string;
    status?: string;
    sort?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const params = await searchParams;

  const tasks = await getTasks({
    assigned_to: user.user_id,
    department: params.department,
    priority: params.priority,
    status: params.status,
    excludeDone: !params.status || params.status === "all",
  });

  // Sort
  const sortBy = params.sort || "due_date";
  const sorted = [...tasks].sort((a, b) => {
    if (sortBy === "due_date") {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    if (sortBy === "priority") {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Görevlerim</h1>
        <p className="text-sm text-muted-foreground">
          Bana atanmış görevler ({sorted.length})
        </p>
      </div>
      <GorevlerimClient tasks={sorted} />
    </div>
  );
}
