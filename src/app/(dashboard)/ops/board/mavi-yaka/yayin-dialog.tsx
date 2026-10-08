"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellRing, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { talimatYayinla } from "@/lib/talimat/actions";
import type { TalimatPlan, TalimatYayinHedef } from "@/lib/talimat/types";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  plan: TalimatPlan;
  /** Plan gelecek haftaya ait mi (bildirim gönderilmez, Pazartesi otomatik gider) */
  gelecekHafta: boolean;
  onClose: () => void;
  onDone: () => void;
}

type Zaman = "simdi" | "saat" | "tarih";

function bugunTarih(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function Secenek({ aktif, onClick, children }: { aktif: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-md border px-3 py-1.5 text-sm transition-colors",
        aktif ? "border-vw-deep bg-vw-primary/50 font-medium text-vw-dark" : "border-border hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

export function YayinDialog({ open, plan, gelecekHafta, onClose, onDone }: Props) {
  const ilkYayin = plan.durum === "taslak";
  const bildirimZorlaKapali = gelecekHafta || (ilkYayin && gelecekHafta);
  const [bildirim, setBildirim] = useState(true);
  const [sesli, setSesli] = useState(false);
  const [hedef, setHedef] = useState<TalimatYayinHedef>("degisenler");
  const [zaman, setZaman] = useState<Zaman>("simdi");
  const [saat, setSaat] = useState("");
  const [tarihSaat, setTarihSaat] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setBildirim(!bildirimZorlaKapali);
      setSesli(false);
      setHedef(ilkYayin ? "herkes" : "degisenler");
      setZaman("simdi");
      const d = new Date(Date.now() + 15 * 60_000);
      setSaat(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
      setTarihSaat("");
    }
  }, [open, bildirimZorlaKapali, ilkYayin]);

  const gonderimZamani = (): string | null => {
    if (!bildirim || zaman === "simdi") return null;
    const yerel = zaman === "saat" ? `${bugunTarih()}T${saat}` : tarihSaat;
    if (!yerel) return null;
    const d = new Date(yerel);
    return isNaN(d.getTime()) ? null : d.toISOString();
  };

  const yayinla = async () => {
    if (bildirim && zaman === "saat" && !saat) return void toast.error("Saat seçin");
    if (bildirim && zaman === "tarih" && !tarihSaat) return void toast.error("Tarih ve saat seçin");
    setBusy(true);
    const r = await talimatYayinla({
      planId: plan.plan_id,
      bildirimGonder: bildirim,
      gonderimZamani: gonderimZamani(),
      sesli: bildirim && sesli,
      hedef: ilkYayin ? "herkes" : hedef,
    });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    const d = r.data;
    toast.success(
      d.bildirim_gonder
        ? `Yayınlandı: ${d.personel_sayisi} hatta ${d.durum === "beklemede" ? "bildirim zamanlandı" : "bildirim gönderildi"}`
        : `Liste yenilendi (bildirimsiz): ${d.satir_sayisi} satır`,
    );
    onDone();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{ilkYayin ? "Planı yayınla" : "Değişiklikleri yayınla"}</DialogTitle>
          <DialogDescription>
            {plan.degisen_satir_sayisi} değişen satır · {plan.hat_sayisi ?? plan.personel_sayisi} hat
            {ilkYayin && " · İlk yayın tüm hatlara gider"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-vw-deep" />
              <div>
                <div className="text-sm font-medium">Bildirim gönder</div>
                <div className="text-xs text-muted-foreground">
                  {bildirimZorlaKapali
                    ? "Gelecek hafta planında bildirim gönderilmez; Pazartesi 07:55'te otomatik gider"
                    : "Hat tabletine uyarı gider, onay beklenir"}
                </div>
              </div>
            </div>
            <Switch checked={bildirim} disabled={bildirimZorlaKapali} onCheckedChange={setBildirim} />
          </div>

          {bildirim && (
            <>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-vw-deep" />
                  <div className="text-sm font-medium">Sesli uyarı</div>
                </div>
                <Switch checked={sesli} onCheckedChange={setSesli} />
              </div>

              <div>
                <Label className="mb-1.5 block">Hedef</Label>
                <div className="flex flex-wrap gap-2">
                  <Secenek aktif={hedef === "degisenler"} onClick={() => !ilkYayin && setHedef("degisenler")}>
                    Yalnız değişenler
                  </Secenek>
                  <Secenek aktif={hedef === "herkes"} onClick={() => setHedef("herkes")}>
                    Herkes
                  </Secenek>
                </div>
                {ilkYayin && <p className="mt-1 text-xs text-muted-foreground">Taslak planın ilk yayını her zaman herkese gider.</p>}
              </div>

              <div>
                <Label className="mb-1.5 block">Zaman</Label>
                <div className="flex flex-wrap gap-2">
                  <Secenek aktif={zaman === "simdi"} onClick={() => setZaman("simdi")}>
                    Şimdi
                  </Secenek>
                  <Secenek aktif={zaman === "saat"} onClick={() => setZaman("saat")}>
                    Saat seç
                  </Secenek>
                  <Secenek aktif={zaman === "tarih"} onClick={() => setZaman("tarih")}>
                    Tarih ve saat seç
                  </Secenek>
                </div>
                {zaman === "saat" && (
                  <Input type="time" className="mt-2 w-36" value={saat} onChange={(e) => setSaat(e.target.value)} />
                )}
                {zaman === "tarih" && (
                  <Input type="datetime-local" className="mt-2 w-60" value={tarihSaat} onChange={(e) => setTarihSaat(e.target.value)} />
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBildirim(false);
              setBusy(true);
              const r = await talimatYayinla({ planId: plan.plan_id, bildirimGonder: false, hedef: ilkYayin ? "herkes" : "degisenler" });
              setBusy(false);
              if (!r.success) return void toast.error(r.error);
              toast.success("Liste bildirimsiz yenilendi");
              onDone();
              onClose();
            }}
          >
            Bildirimsiz yenile
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button onClick={yayinla} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
              Yayınla
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
