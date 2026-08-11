"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { sayimOlustur, KAPSAM_SECENEKLERI } from "../actions";
import { Loader2, Plus } from "lucide-react";

export function YeniSayimDialog() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const bugun = new Date().toISOString().slice(0, 10);
  const [ad, setAd] = useState("");
  const [tarih, setTarih] = useState(bugun);
  const [notlar, setNotlar] = useState("");
  const [kapsam, setKapsam] = useState<string[]>(["YARIMAMUL"]);

  const kapsamDegis = (deger: string, secili: boolean) =>
    setKapsam((k) => (secili ? [...k, deger] : k.filter((x) => x !== deger)));

  const kaydet = async () => {
    if (kapsam.length === 0) {
      toast.error("En az bir kapsam seçin");
      return;
    }
    setKaydediliyor(true);
    const r = await sayimOlustur({
      ad: ad.trim() || `${new Date(tarih).toLocaleDateString("tr-TR")} sayımı`,
      sayim_tarihi: tarih,
      kapsam,
      notlar: notlar.trim() || undefined,
    });
    setKaydediliyor(false);

    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Sayım oluşturuldu");
    setAcik(false);
    if (r.sayim_id) router.push(`/stok/sayim/${r.sayim_id}`);
  };

  return (
    <Dialog open={acik} onOpenChange={setAcik}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 size-4" />
          Yeni Sayım
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Yeni stok sayımı</DialogTitle>
          <DialogDescription>
            Kapsamı seçtiğinizde sistem o andaki miktarları dondurup sayım
            listesi oluşturur. Sayarken bu liste üzerinden ilerlersiniz.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sayim-ad">Sayım adı</Label>
            <Input
              id="sayim-ad" value={ad} onChange={(e) => setAd(e.target.value)}
              placeholder="Ağustos 2026 açılış sayımı"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sayim-tarih">Sayım tarihi</Label>
            <Input
              id="sayim-tarih" type="date" value={tarih}
              onChange={(e) => setTarih(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Düzeltme hareketleri bu tarihe yazılır.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Kapsam</Label>
            {KAPSAM_SECENEKLERI.map((k) => (
              <label key={k.deger} className="flex items-start gap-2.5 text-sm">
                <Checkbox
                  checked={kapsam.includes(k.deger)}
                  onCheckedChange={(v) => kapsamDegis(k.deger, v === true)}
                  className="mt-0.5"
                />
                <span>{k.etiket}</span>
              </label>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sayim-not">Not (isteğe bağlı)</Label>
            <Textarea
              id="sayim-not" value={notlar} rows={2}
              onChange={(e) => setNotlar(e.target.value)}
              placeholder="Kimler saydı, hangi depo, vb."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setAcik(false)}>Vazgeç</Button>
          <Button onClick={kaydet} disabled={kaydediliyor}>
            {kaydediliyor && <Loader2 className="mr-2 size-4 animate-spin" />}
            Oluştur
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
