"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface IkasSyncButtonProps {
  isMock?: boolean;
}

export function IkasSyncButton({ isMock }: IkasSyncButtonProps) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      router.refresh();
      await new Promise((r) => setTimeout(r, 1200));
      toast.success("Veriler yenilendi");
    } catch {
      toast.error("Yenileme sırasında hata oluştu");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={syncing}
      className="gap-1.5"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
      <span className="hidden sm:inline">{syncing ? "Yenileniyor..." : "Yenile"}</span>
      {isMock && (
        <span className="text-xs text-amber-600">(demo)</span>
      )}
    </Button>
  );
}
