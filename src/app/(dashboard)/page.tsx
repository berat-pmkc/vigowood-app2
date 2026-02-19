import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const operatorName = user?.user_metadata?.selected_operator_name;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-vw-dark">Dashboard</h1>
      <p className="text-muted-foreground">
        Hoş geldiniz{operatorName ? `, ${operatorName}` : ""}.
        KPI kartları ve grafikler Katman 20&apos;de eklenecek.
      </p>
    </div>
  );
}
