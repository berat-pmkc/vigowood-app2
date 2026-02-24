"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SyncStatusProps {
  lastSyncAt: string | null;
  entityType?: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);

  if (minutes < 1) return "az önce";
  if (minutes < 60) return `${minutes} dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} saat önce`;

  const days = Math.floor(hours / 24);
  return `${days} gün önce`;
}

function getSyncStatusColor(lastSyncAt: string | null): "green" | "yellow" | "red" {
  if (!lastSyncAt) return "red";
  const diff = Date.now() - new Date(lastSyncAt).getTime();
  const minutes = diff / 60_000;

  if (minutes < 30) return "green";
  if (minutes < 120) return "yellow";
  return "red";
}

export function SyncStatus({ lastSyncAt, entityType }: SyncStatusProps) {
  const [syncing, setSyncing] = useState(false);
  const color = getSyncStatusColor(lastSyncAt);

  const dotColor = {
    green: "bg-emerald-500",
    yellow: "bg-amber-500",
    red: "bg-red-500",
  }[color];

  async function handleSync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/trendyol-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity: entityType || "all" }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Senkronizasyon başarısız");
      }

      toast.success("Senkronizasyon tamamlandı");
      // Reload page to get fresh data
      window.location.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Senkronizasyon hatası");
    } finally {
      setSyncing(false);
    }
  }

  if (!lastSyncAt) {
    return (
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700">
          <AlertCircle className="mr-1 h-3 w-3" />
          Henüz senkronize edilmedi
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={syncing}
          className="h-7 text-xs"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Senkronize ediliyor..." : "Şimdi Senkronize Et"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {color === "green" ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-500" />
        ) : (
          <span className={`inline-block h-2 w-2 rounded-full ${dotColor}`} />
        )}
        <Clock className="h-3 w-3" />
        <span>Son sync: {formatRelativeTime(lastSyncAt)}</span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSync}
        disabled={syncing}
        className="h-6 px-2 text-xs"
      >
        <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}
