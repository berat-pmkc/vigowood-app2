"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MAKINE_TIPLERI, MAKINE_LABELS, MAKINE_DURUM_COLORS, type KesimMakineId, type MakineDurum } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { toggleMachineStatus } from "../actions";
import type { MachineStatusEntry } from "../types";
import { toast } from "sonner";

interface MachineStatusBarProps {
  machineStatus: MachineStatusEntry[];
}

function formatDuration(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}dk`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  if (hours < 24) return `${hours}s ${remainMins}dk`;
  const days = Math.floor(hours / 24);
  return `${days}g ${hours % 24}s`;
}

export function MachineStatusBar({ machineStatus: initialStatus }: MachineStatusBarProps) {
  const [statuses, setStatuses] = useState(initialStatus);
  const [loading, setLoading] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMakine, setDialogMakine] = useState<string | null>(null);
  const [neden, setNeden] = useState("");

  const handleToggle = async (makineId: string, currentDurum: MakineDurum) => {
    const newDurum = currentDurum === "aktif" ? "bakim" : "aktif";

    // Bakıma alırken neden dialog'u aç
    if (newDurum === "bakim") {
      setDialogMakine(makineId);
      setNeden("");
      setDialogOpen(true);
      return;
    }

    // Aktife almak doğrudan
    setLoading(makineId);
    const result = await toggleMachineStatus(makineId, newDurum);
    if (result.success) {
      setStatuses((prev) =>
        prev.map((s) =>
          s.makine_id === makineId
            ? { ...s, durum: newDurum, neden: null, created_at: new Date().toISOString() }
            : s
        )
      );
      toast.success(`${MAKINE_LABELS[makineId as KesimMakineId] ?? makineId} aktif edildi`);
    } else {
      toast.error(result.error);
    }
    setLoading(null);
  };

  const handleBakimConfirm = async () => {
    if (!dialogMakine) return;
    setLoading(dialogMakine);
    setDialogOpen(false);

    const result = await toggleMachineStatus(dialogMakine, "bakim", neden || undefined);
    if (result.success) {
      setStatuses((prev) =>
        prev.map((s) =>
          s.makine_id === dialogMakine
            ? { ...s, durum: "bakim" as const, neden: neden || null, created_at: new Date().toISOString() }
            : s
        )
      );
      toast.success(`${MAKINE_LABELS[dialogMakine as KesimMakineId] ?? dialogMakine} bakıma alındı`);
    } else {
      toast.error(result.error);
    }
    setLoading(null);
    setDialogMakine(null);
  };

  return (
    <>
      <div className="flex items-center gap-1.5 flex-wrap">
        {statuses.map((s) => {
          const colors = MAKINE_DURUM_COLORS[s.durum];
          const label = MAKINE_LABELS[s.makine_id as KesimMakineId] ?? s.makine_id;
          const tip = MAKINE_TIPLERI[s.makine_id as KesimMakineId];
          const isLoading = loading === s.makine_id;

          return (
            <Button
              key={s.makine_id}
              variant="outline"
              size="sm"
              className={cn(
                "h-8 text-xs gap-1.5 border",
                colors.bg,
                colors.text,
                isLoading && "opacity-60"
              )}
              disabled={isLoading}
              onClick={() => handleToggle(s.makine_id, s.durum)}
            >
              <span className={cn("w-2 h-2 rounded-full shrink-0", colors.dot)} />
              <span className="truncate font-medium">{label}</span>
              {tip && <span className="hidden text-[10px] opacity-60 sm:inline">{tip}</span>}
              {s.durum === "bakim" && (
                <span className="text-[10px] opacity-70">
                  {formatDuration(s.created_at)}
                </span>
              )}
            </Button>
          );
        })}
      </div>

      {/* Bakım neden dialog'u */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Bakıma Al</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              <strong>{dialogMakine ? MAKINE_LABELS[dialogMakine as KesimMakineId] ?? dialogMakine : ""}</strong> bakıma alınacak.
            </p>
            <div>
              <Label htmlFor="neden" className="text-sm">Bakım Sebebi (opsiyonel)</Label>
              <Textarea
                id="neden"
                value={neden}
                onChange={(e) => setNeden(e.target.value)}
                placeholder="Örn: Lazer kafa değişimi, kalibrasyon..."
                className="mt-1"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              İptal
            </Button>
            <Button
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleBakimConfirm}
            >
              Bakıma Al
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
