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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, Package, Clock } from "lucide-react";
import { closeMontajSession, getMontajOperators } from "../actions";
import { toast } from "sonner";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import type { ActiveMontajSession } from "./session-card";

interface Operator {
  user_id: string;
  full_name: string;
  role: string;
}

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
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qty, setQty] = useState("");
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && operators.length === 0) {
      setLoading(true);
      getMontajOperators().then((result) => {
        if (result.success) setOperators(result.data);
        setLoading(false);
      });
    }
    if (!open) {
      setQty("");
      setSelectedWorkers(new Set());
    }
  }, [open, operators.length]);

  const toggleWorker = (id: string) => {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!session) return;

    const numQty = parseInt(qty, 10);
    if (!numQty || numQty < 1) {
      toast.error("Geçerli bir adet giriniz");
      return;
    }
    if (selectedWorkers.size === 0) {
      toast.error("En az 1 çalışan seçiniz");
      return;
    }

    const workers = Array.from(selectedWorkers).map((id) => {
      const op = operators.find((o) => o.user_id === id);
      return { id, name: op?.full_name ?? id };
    });

    setSubmitting(true);
    const result = await closeMontajSession(session.session_id, { qty: numQty, workers });
    if (result.success) {
      toast.success(`${numQty} adet montaj tamamlandı`);
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
    setSubmitting(false);
  };

  if (!session) return null;

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

          {/* Worker selection */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" />
              Kim görev yaptı? ({selectedWorkers.size} kişi)
            </Label>
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" />
                Operatörler yükleniyor...
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {operators.map((op) => (
                  <label
                    key={op.user_id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedWorkers.has(op.user_id)}
                      onCheckedChange={() => toggleWorker(op.user_id)}
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{op.full_name}</span>
                      <span className="text-xs text-muted-foreground">{op.user_id}</span>
                    </div>
                  </label>
                ))}
                {operators.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-2">
                    Operatör bulunamadı
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Vazgeç
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!qty || selectedWorkers.size === 0 || submitting}
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
