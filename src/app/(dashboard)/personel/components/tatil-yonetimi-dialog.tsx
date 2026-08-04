"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getResmiTatiller,
  upsertResmiTatil,
  deleteResmiTatil,
  type ResmiTatil,
} from "../actions";
import { toast } from "sonner";
import { Plus, Trash2, CalendarOff } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Tatil listesi değişince devamsızlık tablosu yeniden hesaplansın */
  onDegisti: () => void;
}

const GUNLER = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"];

function gunAdi(iso: string) {
  const [y, a, g] = iso.split("-").map(Number);
  return GUNLER[new Date(y, a - 1, g).getDay()];
}

export function TatilYonetimiDialog({ open, onOpenChange, onDegisti }: Props) {
  const [yil, setYil] = useState(new Date().getFullYear());
  const [liste, setListe] = useState<ResmiTatil[]>([]);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [yeniTarih, setYeniTarih] = useState("");
  const [yeniAd, setYeniAd] = useState("");
  const [yeniDus, setYeniDus] = useState(true);
  const [kaydediyor, setKaydediyor] = useState(false);

  const yukle = () => {
    setYukleniyor(true);
    getResmiTatiller(yil)
      .then(setListe)
      .catch(() => toast.error("Tatil listesi yüklenemedi"))
      .finally(() => setYukleniyor(false));
  };

  useEffect(() => {
    if (open) yukle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, yil]);

  const ekle = async () => {
    if (!yeniTarih || !yeniAd.trim()) {
      toast.error("Tarih ve tatil adı gereklidir");
      return;
    }
    setKaydediyor(true);
    const r = await upsertResmiTatil({
      tarih: yeniTarih,
      ad: yeniAd,
      hedeften_dus: yeniDus,
      aktif: true,
    });
    setKaydediyor(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Tatil eklendi");
    setYeniTarih("");
    setYeniAd("");
    setYeniDus(true);
    yukle();
    onDegisti();
  };

  const dusDegistir = async (t: ResmiTatil) => {
    const r = await upsertResmiTatil({ ...t, hedeften_dus: !t.hedeften_dus });
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    yukle();
    onDegisti();
  };

  const sil = async (tarih: string) => {
    const r = await deleteResmiTatil(tarih);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Tatil silindi");
    yukle();
    onDegisti();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Resmî Tatil Takvimi</DialogTitle>
          <DialogDescription>
            Buradaki günler devamsızlık raporunda hedef iş gününden düşülür. Pazara denk
            gelen tatiller zaten sayılmadığı için iki kez düşülmez.
          </DialogDescription>
        </DialogHeader>

        {/* Yıl seçimi */}
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Yıl</Label>
          <Button variant="outline" size="sm" onClick={() => setYil((y) => y - 1)}>
            ‹
          </Button>
          <span className="font-semibold tabular-nums w-12 text-center">{yil}</span>
          <Button variant="outline" size="sm" onClick={() => setYil((y) => y + 1)}>
            ›
          </Button>
        </div>

        {/* Yeni tatil */}
        <div className="grid grid-cols-1 sm:grid-cols-[150px_1fr_auto] gap-2 items-end border rounded-md p-3 bg-muted/30">
          <div className="space-y-1.5">
            <Label className="text-xs">Tarih</Label>
            <Input
              type="date"
              value={yeniTarih}
              onChange={(e) => setYeniTarih(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Tatil adı</Label>
            <Input
              placeholder="ör. Ramazan Bayramı 1. Gün"
              value={yeniAd}
              onChange={(e) => setYeniAd(e.target.value)}
              className="h-9"
            />
          </div>
          <Button onClick={ekle} disabled={kaydediyor} className="h-9">
            <Plus className="w-4 h-4 mr-1" />
            Ekle
          </Button>
          <div className="sm:col-span-3 flex items-center gap-2">
            <Checkbox
              id="yeniDus"
              checked={yeniDus}
              onCheckedChange={(v) => setYeniDus(v === true)}
            />
            <Label htmlFor="yeniDus" className="text-xs font-normal cursor-pointer">
              Hedef iş gününden düşülsün — arife gibi yarım günler için kapatın
            </Label>
          </div>
        </div>

        {/* Liste */}
        {yukleniyor ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : liste.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {yil} yılı için tanımlı tatil yok.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground text-xs">
                <th className="py-2">Tarih</th>
                <th className="py-2">Gün</th>
                <th className="py-2">Ad</th>
                <th className="py-2 text-center">Hedeften düş</th>
                <th className="py-2 w-8" />
              </tr>
            </thead>
            <tbody>
              {liste.map((t) => (
                <tr key={t.tarih} className="border-b hover:bg-muted/30">
                  <td className="py-2 font-mono text-xs">
                    {t.tarih.split("-").reverse().join(".")}
                  </td>
                  <td className="py-2 text-xs text-muted-foreground">{gunAdi(t.tarih)}</td>
                  <td className="py-2">{t.ad}</td>
                  <td className="py-2 text-center">
                    <Checkbox
                      checked={t.hedeften_dus}
                      onCheckedChange={() => dusDegistir(t)}
                    />
                  </td>
                  <td className="py-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => sil(t.tarih)}
                      aria-label="Tatili sil"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <p className="text-xs text-muted-foreground flex items-start gap-2">
          <CalendarOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Sabit tarihli millî bayramlar 2026 ve 2027 için önceden eklendi. Ramazan ve
          Kurban Bayramı tarihleri her yıl kaydığı için elle eklenmeli.
        </p>
      </DialogContent>
    </Dialog>
  );
}
