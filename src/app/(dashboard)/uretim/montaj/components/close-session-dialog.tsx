"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Package, Clock, Flame } from "lucide-react";
import { closeMontajSession } from "../actions";
import { getStepParts, montajFire } from "@/lib/kalite/actions";
import { toast } from "sonner";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { parseWorkers } from "../utils";
import type { ActiveMontajSession } from "./session-card";

interface CloseSessionDialogProps {
  session: ActiveMontajSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ElapsedBadge({ startTime }: { startTime: string }) {
  const diff = Date.now() - new Date(startTime).getTime();
  const totalMin = Math.floor(diff / 60000);
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  const label = hours > 0 ? `${hours}s ${mins}dk` : `${mins}dk`;
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full">
      <Clock className="w-3 h-3" />
      {label}
    </span>
  );
}

export function CloseSessionDialog({ session, open, onOpenChange }: CloseSessionDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [qty, setQty] = useState("");
  const [stepParts, setStepParts] = useState<{ part_id: string; part_adi: string | null }[]>([]);
  const [fireQty, setFireQty] = useState<Record<string, string>>({});
  const stepId = session?.step_id;

  useEffect(() => {
    if (!open) {
      setQty("");
      setFireQty({});
    }
  }, [open]);

  // Adımın yarı mamul parçaları (opsiyonel fire girişi)
  useEffect(() => {
    if (!open || !stepId) {
      setStepParts([]);
      return;
    }
    let cancelled = false;
    getStepParts(stepId).then((r) => {
      if (!cancelled) setStepParts(r.success ? r.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [open, stepId]);

  const handleSubmit = async () => {
    if (!session) return;

    const numQty = parseInt(qty, 10);
    if (!numQty || numQty < 1) {
      toast.error("Geçerli bir adet giriniz");
      return;
    }

    // Çalışanlar seans açılışında seçildi; sunucu seanstan okuyor.
    setSubmitting(true);
    const result = await closeMontajSession(session.session_id, { qty: numQty });
    if (result.success) {
      toast.success(`${numQty} adet montaj tamamlandı`);
      const fireParts = stepParts
        .map((p) => ({ part_id: p.part_id, qty: Number(fireQty[p.part_id]) || 0 }))
        .filter((p) => p.qty > 0);
      if (fireParts.length > 0) {
        const fr = await montajFire({
          sessionId: session.session_id,
          stepId: session.step_id,
          parts: fireParts,
        });
        if (fr.success) toast.success("Fire kaydedildi");
        else toast.error(`Seans kapandı ancak fire kaydedilemedi: ${fr.error}`);
      }
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  };

  if (!session) return null;

  const seansCalisanlari = parseWorkers(session.workers) ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle>Seansı Kapat</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 overflow-hidden">
          {/* Session info */}
          {(() => {
            const skuStyle = session.sku ? getSkuBadgeStyle(session.sku) : null;
            return (
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 overflow-hidden">
            {skuStyle && (
              <span
                className="font-bold text-sm px-2 py-0.5 rounded inline-block"
                style={{ backgroundColor: skuStyle.backgroundColor, color: skuStyle.color }}
              >
                {session.sku}
              </span>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                Adım {session.seq_no}: {session.step_name || "—"}
              </Badge>
              {session.start_time && <ElapsedBadge startTime={session.start_time} />}
            </div>
          </div>
            );
          })()}

          {/* Qty input */}
          <div>
            <Label htmlFor="close-qty" className="text-sm font-medium flex items-center gap-2 mb-2">
              <Package className="w-4 h-4" />
              Kaç adet montajlandı?
            </Label>
            <Input
              id="close-qty"
              type="number"
              min={1}
              max={9999}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Adet giriniz"
              className="text-lg h-12"
              autoFocus
            />
          </div>

          {/* Fire (opsiyonel) — adımın yarı mamul parçaları */}
          {stepParts.length > 0 && (
            <div>
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Flame className="w-4 h-4 text-[#ee7683]" />
                Fire (opsiyonel)
              </Label>
              <div className="space-y-2 max-h-52 overflow-y-auto rounded-lg border p-2">
                {stepParts.map((p) => (
                  <div key={p.part_id} className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-xs font-medium">{p.part_id}</span>
                      <p className="truncate text-xs text-muted-foreground">{p.part_adi}</p>
                    </div>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      value={fireQty[p.part_id] ?? ""}
                      onChange={(e) => setFireQty((s) => ({ ...s, [p.part_id]: e.target.value }))}
                      placeholder="0"
                      className="h-11 w-20 text-center"
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Fire adedi ek yarı mamul tüketimi olarak stoktan düşer.
              </p>
            </div>
          )}

          {/* Çalışanlar — seans açılışında seçildi, burada yalnızca gösteriliyor */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" />
              Çalışanlar
            </Label>
            <div className="rounded-lg border bg-muted/30 p-3">
              {seansCalisanlari.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {seansCalisanlari.map((w) => (
                    <Badge key={w.id} variant="secondary" className="text-xs font-normal">
                      {w.name}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {session.operator_name ?? "Operatör bilgisi yok"}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Seans başlatılırken seçildi. Değiştirmek için seansı kapattıktan
                sonra &quot;Düzenle&quot;yi kullanın.
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Vazgeç
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!qty || submitting}
              className="bg-vw-success hover:bg-vw-success/90 text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Tamamla
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
