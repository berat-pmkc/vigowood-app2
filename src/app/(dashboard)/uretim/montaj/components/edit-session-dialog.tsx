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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Users, Package, Pencil, Clock, Trash2 } from "lucide-react";
import { deleteCompletedMontajSession, updateCompletedMontajSession, getMontajOperators } from "../actions";
import { toast } from "sonner";
import { formatDuration, cn } from "@/lib/utils";
import type { CompletedMontajSession } from "./completed-sessions-sheet";

interface Operator {
  user_id: string;
  full_name: string;
  role: string;
}

interface EditSessionDialogProps {
  session: CompletedMontajSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditSessionDialog({ session, open, onOpenChange }: EditSessionDialogProps) {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [qty, setQty] = useState("");
  const [baslangic, setBaslangic] = useState("");
  const [bitis, setBitis] = useState("");
  const [siliniyor, setSiliniyor] = useState(false);
  const [selectedWorkers, setSelectedWorkers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open && operators.length === 0) {
      setLoading(true);
      getMontajOperators().then((result) => {
        if (result.success) setOperators(result.data);
        setLoading(false);
      });
    }
  }, [open, operators.length]);

  useEffect(() => {
    if (open && session) {
      setQty(String(session.qty));
      // datetime-local yerel saat bekliyor; ISO'yu doğrudan veremeyiz
      const yerel = (iso: string) => {
        const d = new Date(iso);
        const p = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
      };
      setBaslangic(session.start_time ? yerel(session.start_time) : "");
      setBitis(session.end_time ? yerel(session.end_time) : "");
      const workerIds = new Set<string>();
      if (session.workers && Array.isArray(session.workers)) {
        session.workers.forEach((w) => workerIds.add(w.id));
      }
      setSelectedWorkers(workerIds);
    }
    if (!open) {
      setQty("");
      setBaslangic("");
      setBitis("");
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
    const result = await deleteCompletedMontajSession(session.session_id);
    setSiliniyor(false);
    if (result.success) {
      toast.success("Seans silindi, tüketilen parçalar stoğa geri eklendi");
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

    if (baslangic && bitis && new Date(bitis) <= new Date(baslangic)) {
      toast.error("Bitiş saati başlangıçtan sonra olmalı");
      return;
    }

    setSubmitting(true);
    const result = await updateCompletedMontajSession(session.session_id, {
      qty: numQty,
      workers,
      start_time: baslangic ? new Date(baslangic).toISOString() : undefined,
      end_time: bitis ? new Date(bitis).toISOString() : undefined,
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

  /** Kullanıcı yazarken anında geri bildirim — sunucu ayrıca doğruluyor */
  const hesaplananDk =
    baslangic && bitis
      ? (new Date(bitis).getTime() - new Date(baslangic).getTime()) / 60000
      : null;

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
          <div className="bg-muted/50 rounded-lg p-3 space-y-1.5 overflow-hidden">
            <p className="font-medium text-sm break-words">
              {session.urun_adi ?? session.sku ?? "—"}
            </p>
            <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
              {session.sku && <span>{session.sku}</span>}
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                Adım {session.seq_no}: {session.step_name || "—"}
              </Badge>
              <span>{formatDuration(session.start_time, session.end_time)}</span>
              {session.birim_montaj_dk != null && (
                <span>({session.birim_montaj_dk} dk/birim)</span>
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

          {/* Saat düzeltme — geç başlatma / geç kapatma düzeltilebilsin */}
          <div>
            <Label className="text-sm font-medium flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" />
              Çalışma saatleri
            </Label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Başlangıç</span>
                <Input
                  id="montaj-start"
                  type="datetime-local"
                  value={baslangic}
                  onChange={(e) => setBaslangic(e.target.value)}
                />
              </div>
              <div>
                <span className="mb-1 block text-xs text-muted-foreground">Bitiş</span>
                <Input
                  id="montaj-end"
                  type="datetime-local"
                  value={bitis}
                  onChange={(e) => setBitis(e.target.value)}
                />
              </div>
            </div>
            {hesaplananDk !== null && (
              <p className={cn(
                "mt-1.5 text-xs",
                hesaplananDk <= 0 ? "text-destructive" : "text-muted-foreground",
              )}>
                {hesaplananDk <= 0
                  ? "Bitiş saati başlangıçtan sonra olmalı."
                  : `Yeni süre: ${Math.floor(hesaplananDk / 60)}sa ${Math.round(hesaplananDk % 60)}dk (brüt). Molalar sunucuda düşülür, birim süre yeniden hesaplanır.`}
              </p>
            )}
          </div>

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
                  <AlertDialogTitle>Montaj seansı silinsin mi?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm">
                      <p><b>{session.sku}</b> · {session.qty} adet montaj kaydı silinecek.</p>
                      <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                        Bu seansta tüketilen parçalar reçeteye göre stoğa geri
                        eklenecek, yarı mamül hareketleri silinecek.
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
              disabled={!qty || selectedWorkers.size === 0 || submitting || (hesaplananDk !== null && hesaplananDk <= 0)}
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
