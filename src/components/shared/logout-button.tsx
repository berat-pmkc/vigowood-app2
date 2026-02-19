"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();

    // Clear operator selection from metadata before signing out
    await supabase.auth.updateUser({
      data: { selected_operator_id: null, selected_operator_name: null },
    });

    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleLogout}
      className="text-vw-side hover:bg-vw-deep hover:text-vw-light"
      title="Çıkış Yap"
    >
      <LogOut className="size-4" />
    </Button>
  );
}
