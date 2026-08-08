"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getPlakalarForKesim,
  getPlakaParts,
  getAcikTalepOzeti,
  createKesimTalebi,
} from "../../actions";
import { toast } from "sonner";
import { Loader2, Plus, TriangleAlert, Flame } from "lucide-react";

interface Urun {
  sku: string;
  urun_adi: string | null;
}
interface Plaka {
  plaka_id: string;
  plaka_adi: string | null;
  tipi: string | null;
  renk: string | null;
}
interface Parca {
  part_id: string;
  part_adi: string | null;
  default_qty: number | null;
}

export function YeniTalepForm({ urunler }: { urunler: Urun[] }) {
  const router = useRouter();
  const [sku, setSku] = useState("");
  const [plakaId, setPlakaId] = useState("");
  const [adet, setAdet] = useState("1");
  const [oncelik, setOncelik] = useState<"normal" | "acil">("normal");
  const [not, setNot] = useState("");

  const [plakalar, setPlakalar] = useState<Plaka[]>([]);
  const [parcalar, setParcalar] = useState<Parca[]>([]);
  const [acikTalep, setAcikTalep] = useState<{ adet: number; toplam: number } | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediyor, setKaydediyor] = useState(false);

  // Ürün seçilince o ürüne ait plakaları getir
  useEffect(() => {
    setPlakaId("");
    setParcalar([]);
    setAcikTalep(null);
    if (!sku) {
      setPlakalar([]);
      return;
    }
    setYukleniyor(true);
    getPlakalarForKesim(sku)
      .then((r) => setPlakalar(r.success ? (r.data as Plaka[]) : []))
      .catch(() => toast.error("Plakalar yüklenemedi"))
      .finally(() => setYukleniyor(false));
  }, [sku]);

  // Plaka seçilince çıkacak parçaları ve açık talepleri getir
  useEffect(() => {
    if (!plakaId) {
      setParcalar([]);
      setAcikTalep(null);
      return;
    }
    Promise.all([getPlakaParts(plakaId), getAcikTalepOzeti(plakaId)])
      .then(([p, t]) => {
        setParcalar(p.success ? (p.data as Parca[]) : []);
        setAcikTalep(t);
      })
      .catch(() => toast.error("Plaka bilgisi yüklenemedi"));
  }, [plakaId]);

  const adetSayi = Number(adet) || 0;

  const kaydet = async () => {
    setKaydediyor(true);
    const r = await createKesimTalebi({
      sku,
      plaka_id: plakaId,
      talep_adet: adetSayi,
      oncelik,
      talep_notu: not || null,
    });
    setKaydediyor(false);

    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Kesim talebi oluşturuldu");
    setPlakaId("");
    setAdet("1");
    setOncelik("normal");
    setNot("");
    setParcalar([]);
    setAcikTalep(null);
    router.refresh();
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Ürün</Label>
          <Select value={sku} onValueChange={setSku}>
            <SelectTrigger>
              <SelectValue placeholder="Ürün seçiniz" />
            </SelectTrigger>
            <SelectContent>
              {urunler.map((u) => (
                <SelectItem key={u.sku} value={u.sku}>
                  {u.sku}
                  {u.urun_adi ? ` — ${u.urun_adi}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label>Plaka / proje</Label>
          <Select value={plakaId} onValueChange={setPlakaId} disabled={!sku || yukleniyor}>
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !sku ? "Önce ürün seçin" : yukleniyor ? "Yükleniyor…" : "Plaka seçiniz"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {plakalar.map((p) => (
                <SelectItem key={p.plaka_id} value={p.plaka_id}>
                  {p.plaka_adi ?? p.plaka_id}
                  {p.tipi ? ` · ${p.tipi}` : ""}
                  {p.renk ? ` ${p.renk}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="adet">Kaç plaka kesilsin?</Label>
          <Input
            id="adet"
            type="number"
            min={1}
            value={adet}
            onChange={(e) => setAdet(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>Öncelik</Label>
          <Select value={oncelik} onValueChange={(v) => setOncelik(v as "normal" | "acil")}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="normal">Normal</SelectItem>
              <SelectItem value="acil">Acil</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="not">Not (isteğe bağlı)</Label>
        <Textarea
          id="not"
          rows={2}
          placeholder="Örn. UK29 sevkiyatı için"
          value={not}
          onChange={(e) => setNot(e.target.value)}
        />
      </div>

      {/* Mükerrer talep uyarısı — engellemiyoruz, sadece haberdar ediyoruz */}
      {acikTalep && acikTalep.adet > 0 && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-xs text-amber-900">
            Bu plaka için zaten <strong>{acikTalep.adet} açık talep</strong> var, toplam{" "}
            <strong>{acikTalep.toplam} plaka</strong> bekliyor. Yine de yeni talep
            açabilirsiniz.
          </p>
        </div>
      )}

      {/* Çıkacak parçalar — plaka_parts.default_qty × plaka adedi */}
      {parcalar.length > 0 && adetSayi > 0 && (
        <div className="rounded-md border bg-muted/30 p-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">
            {adetSayi} PLAKADAN ÇIKACAK PARÇALAR
          </p>
          <div className="flex flex-wrap gap-1.5">
            {parcalar.map((p) => (
              <Badge key={p.part_id} variant="outline" className="bg-white font-normal">
                {p.part_adi ?? p.part_id}
                <span className="ml-1 font-semibold tabular-nums">
                  {(Number(p.default_qty) || 0) * adetSayi}
                </span>
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button
        onClick={kaydet}
        disabled={!sku || !plakaId || adetSayi < 1 || kaydediyor}
        className="w-full sm:w-auto"
      >
        {kaydediyor ? (
          <Loader2 className="mr-1 size-4 animate-spin" />
        ) : oncelik === "acil" ? (
          <Flame className="mr-1 size-4" />
        ) : (
          <Plus className="mr-1 size-4" />
        )}
        Talep Oluştur
      </Button>
    </Card>
  );
}
