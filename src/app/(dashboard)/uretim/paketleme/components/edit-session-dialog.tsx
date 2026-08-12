"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, Users, Package, Pencil, Clock, Trash2 } from "lucide-react";
import { deleteCompletedSession, updateCompletedSession, getPackOperators } from "../actions";
import { toast } from "sonner";
import type { CompletedSession } from "./completed-sessions";
import { formatDuration } from "@/lib/utils";

interface Operator {
  user_id: string;
  full_name: string;
  role: string;
}

interface EditSessionDialogProps {
  session: CompletedSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSessionDialog({ session, open, onOpenChange }: EditSessionDialogProps) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qty, setQty] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [siliniyor, setSiliniyor] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && operators.length === 0) {
      setLoading(true);
      getPackOperators().then((result) => {
        if (result.success) setOperators(result.data);
        setLoading(false);
      });
    }
  }, [open, operators.length]);

  // Session değiştiğinde mevcut değerleri doldur
  useEffect(() => {
    if (open && session) {
      setQty(String(session.qty));
      // datetime-local yerel saat bekliyor; ISO'daki Z'yi doğrudan veremeyiz
      if (session.start_time) {
        const d = new Date(session.start_time);
        const p = (n: number) => String(n).padStart(2, "0");
        setBaslangic(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`);
      }
      const workerIds = new Set<string>();
      if (session.workers && Array.isArray(session.workers)) {
        session.workers.forEach((w) => workerIds.add(w.id));
      }
      setSelectedWorkers(workerIds);
    }
    if (!open) {
      setQty("");
      setSelectedWorkers(new Set());
    }
  }, [open, session]);

  const toggleWorker = (id: string) => {
    setSelectedWorkers((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDelete = async () => {
    if (!session) return;
    setSiliniyor(true);
    const result = await deleteCompletedSession(session.session_id);
    setSiliniyor(false);
    if (result.success) {
      toast.success("Seans silindi, stok geri alındı");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
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
    const result = await updateCompletedSession(session.session_id, {
      qty: numQty,
      workers,
      start_time: baslangic ? new Date(baslangic).toISOString() : undefined,
    });
    if (result.success) {
      toast.success("Seans güncellendi");
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
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-4 h-4" />
            Seansı Düzenle
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2 overflow-hidden">
          {/* Session info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 overflow-hidden">
            <p className="font-medium text-sm break-words">
              {session.urun_adi ?? session.sku ?? "—"}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {session.sku && <span>{session.sku}</span>}
              <span>{formatDuration(session.start_time, session.end_time)}</span>
              {session.birim_paketleme_dk != null && (
                <span>({session.birim_paketleme_dk} dk/birim)</span>
              )}
            </div>
          </div>

          {/* Qty input */}
          <div>
            <Label htmlFor="edit-qty" className="text-sm font-medium flex items-center gap-2 mb-2">
              <Package className="w-4 h-4" />
              Adet
            </Label>
            <Input
              id="edit-qty"
              type="number"
              min={1}
              max={9999}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="Adet giriniz"
              className="text-lg h-12"
            />
          </div>

          {/* Başlangıç saati — operatör yanlış saatte başlatmış olabilir */}
          <div>
            <Label htmlFor="edit-start" className="text-sm font-medium flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" />
              Başlangıç saati
            </Label>
            <Input
              id="edit-start"
              type="datetime-local"
              value={baslangic}
              onChange={(e) => setBaslangic(e.target.value)}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Değiştirirseniz birim paketleme süresi yeniden hesaplanır.
            </p>
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

          <div className="flex items-center gap-2 pt-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" disabled={submitting || siliniyor}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                  {siliniyor
                    ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    : <Trash2 className="w-4 h-4 mr-1.5" />}
                  Seansı Sil
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Seans silinsin mi?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm">
                      <p>
                        <b>{session.sku ?? "—"}</b> · {session.qty} adet paketleme
                        kaydı silinecek.
                      </p>
                      <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                        Bu seansın yazdığı stok hareketi de geri alınacak, ürün
                        stoğu {session.qty} adet düşecek.
                      </p>
                      <p className="text-muted-foreground">Bu işlem geri alınamaz.</p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}
                                     className="bg-destructive hover:bg-destructive/90">
                    Sil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex-1" />

            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Vazgeç
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!qty || selectedWorkers.size === 0 || submitting}
              className="bg-vw-primary hover:bg-vw-deep text-white"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
