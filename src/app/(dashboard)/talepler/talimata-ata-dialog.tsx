"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MiktarHizliInput } from "@/components/shared/miktar-hizli-input";
import { ataHedefPlanGetir } from "@/lib/talimat/admin-actions";
import { hatSiraDurumuGetir, hatlariGetir } from "@/lib/talimat/hat-actions";
import { talepTalimataAtaHatlar } from "@/lib/talep/actions";
import type { TalimatHat, TalimatPlan } from "@/lib/talimat/types";
import type { Talep } from "@/lib/talep/types";
import { cn, formatDate } from "@/lib/utils";

interface Props {
  talep: Talep | null;
  onClose: () => void;
  onDone: () => void;
}

type SiraSatiri = { satir_id: string; sira: number; sku: string | null; urun_adi: string | null; etkin_durum: string; bos: boolean };

export function TalimataAtaDialog({ talep, onClose, onDone }: Props) {
  const [plan, setPlan] = useState<TalimatPlan | null>(null);
  const [yukleniyor, setYukleniyor] = useState(false);
  const [hatlar, setHatlar] = useState<TalimatHat[]>([]);
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [siralar, setSiralar] = useState<Record<string, SiraSatiri[]>>({});
  const [sonaEkle, setSonaEkle] = useState(true);
  const [sira, setSira] = useState("");
  const [kaydir, setKaydir] = useState(true);
  const [miktar, setMiktar] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const atanmisHatlar = useMemo(() => new Set((talep?.asamalar ?? []).map((a) => a.hat_id)), [talep]);

  useEffect(() => {
    if (!talep) return;
    setSecili(new Set());
    setSiralar({});
    setSonaEkle(true);
    setSira("");
    setKaydir(true);
    setMiktar(talep.istenen_miktar);
    setYukleniyor(true);
    void Promise.all([ataHedefPlanGetir(), hatlariGetir(true)]).then(([p, h]) => {
      setPlan(p.success ? p.data : null);
      setHatlar(h.success ? h.data : []);
      setYukleniyor(false);
    });
  }, [talep]);

  // Seçili hatların mevcut sıra durumunu çek (sıra numarası verildiğinde gösterilir)
  const planId = plan?.plan_id;
  useEffect(() => {
    if (!planId || sonaEkle) return;
    for (const id of secili) {
      if (siralar[id]) continue;
      void hatSiraDurumuGetir(planId, id).then((r) => {
        if (r.success) setSiralar((p) => ({ ...p, [id]: r.data as SiraSatiri[] }));
      });
    }
  }, [planId, sonaEkle, secili, siralar]);

  if (!talep) return null;

  const secilebilir = hatlar.filter((h) => !atanmisHatlar.has(h.hat_id));
  const hepsiSecili = secilebilir.length > 0 && secilebilir.every((h) => secili.has(h.hat_id));
  const siraSayi = sonaEkle || sira.trim() === "" ? null : Math.floor(Number(sira));

  const aktifSatirlar = (hatId: string) => (siralar[hatId] ?? []).filter((l) => l.etkin_durum !== "tamamlandi");
  const doluSatir = (hatId: string) => (siraSayi != null ? aktifSatirlar(hatId)[siraSayi - 1] : undefined);

  const toggle = (id: string, v: boolean) =>
    setSecili((p) => {
      const n = new Set(p);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });

  const ata = async () => {
    if (!plan) return void toast.error("Hedef plan bulunamadı");
    const idler = hatlar.filter((h) => secili.has(h.hat_id)).map((h) => h.hat_id);
    if (idler.length === 0) return void toast.error("En az bir hat seçin");
    if (!sonaEkle && (siraSayi == null || !Number.isFinite(siraSayi) || siraSayi < 1)) return void toast.error("Geçersiz sıra");
    setBusy(true);
    let basarili = 0;
    const hatalar: string[] = [];
    // Görünen konum hat başına farklı gerçek sıraya denk gelir: her hat ayrı çağrılır
    for (const hatId of idler) {
      const ad = hatlar.find((h) => h.hat_id === hatId)?.ad ?? hatId;
      const hedef = siraSayi != null ? aktifSatirlar(hatId)[siraSayi - 1] : undefined;
      const r = await talepTalimataAtaHatlar({
        talepId: talep.talep_id,
        hatIds: [hatId],
        miktar,
        sira: siraSayi != null && hedef ? hedef.sira : null,
        kaydir: !!hedef && kaydir,
        planId: plan.plan_id,
      });
      if (r.success) basarili++;
      else hatalar.push(`${ad}: ${r.error}`);
    }
    setBusy(false);
    if (hatalar.length > 0) toast.error(hatalar.join(" · "));
    if (basarili > 0) {
      toast.success(`${basarili} hatta iş talimatına atandı`);
      onDone();
      if (hatalar.length === 0) onClose();
    }
  };

  return (
    <Dialog open={!!talep} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>İş talimatına ata</DialogTitle>
          <DialogDescription>
            #{talep.talep_no} · {talep.sku} {talep.urun_adi ? `· ${talep.urun_adi}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border bg-vw-light/60 px-3 py-2 text-xs">
            {yukleniyor ? (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Hedef plan aranıyor...
              </span>
            ) : plan ? (
              <>
                Hedef plan: <b>{formatDate(plan.hafta_baslangic)}</b> haftası ({plan.durum === "yayinda" ? "yayında" : "taslak"})
              </>
            ) : (
              <span className="text-[#c0424f]">Bu hafta veya sonrası için plan yok. Önce Mavi Yaka sayfasında plan oluşturun.</span>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label>Hatlar</Label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox
                  checked={hepsiSecili}
                  disabled={secilebilir.length === 0}
                  onCheckedChange={(v) => setSecili(v ? new Set(secilebilir.map((h) => h.hat_id)) : new Set())}
                />
                Tümünü seç
              </label>
            </div>
            <div className="space-y-1 rounded-md border p-2">
              {hatlar.length === 0 && !yukleniyor && <p className="text-xs text-muted-foreground">Aktif hat yok.</p>}
              {hatlar.map((h) => {
                const atanmis = atanmisHatlar.has(h.hat_id);
                return (
                  <label
                    key={h.hat_id}
                    className={cn("flex items-center gap-2 rounded px-1.5 py-1 text-sm", atanmis ? "opacity-50" : "cursor-pointer hover:bg-muted/50")}
                  >
                    <Checkbox
                      checked={!atanmis && secili.has(h.hat_id)}
                      disabled={atanmis}
                      onCheckedChange={(v) => toggle(h.hat_id, !!v)}
                    />
                    <span className="flex-1">{h.ad}</span>
                    {atanmis && <Badge variant="secondary">atanmış</Badge>}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Miktar (her hatta)</Label>
              <MiktarHizliInput value={miktar} onCommit={setMiktar} inputClassName="w-24" />
            </div>
            <div>
              <Label>Sıra</Label>
              <div className="space-y-1.5 text-sm">
                <label className="flex items-center gap-2">
                  <input type="radio" checked={sonaEkle} onChange={() => setSonaEkle(true)} /> Sona ekle
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" checked={!sonaEkle} onChange={() => setSonaEkle(false)} /> Sıra no:
                  <Input
                    type="number"
                    min={1}
                    value={sira}
                    disabled={sonaEkle}
                    onChange={(e) => setSira(e.target.value)}
                    className="h-8 w-20"
                  />
                </label>
              </div>
            </div>
          </div>

          {!sonaEkle && siraSayi != null && secili.size > 0 && (
            <div className="space-y-1.5 rounded-lg border border-[#f28a19]/40 bg-[#fde8cf]/60 p-2.5 text-xs">
              {hatlar
                .filter((h) => secili.has(h.hat_id))
                .map((h) => {
                  const d = doluSatir(h.hat_id);
                  return (
                    <div key={h.hat_id}>
                      <b>{h.ad}</b>: {siraSayi}. sırada{" "}
                      {d ? (
                        d.bos ? (
                          "boş satır var (doldurulur)"
                        ) : (
                          <>
                            <b>{d.sku}</b>
                            {d.urun_adi ? ` (${d.urun_adi})` : ""} var
                          </>
                        )
                      ) : (
                        "satır yok (listenin sonuna eklenir)"
                      )}
                    </div>
                  );
                })}
              <label className="mt-1 flex items-center gap-2 text-sm">
                <Checkbox checked={kaydir} onCheckedChange={(v) => setKaydir(!!v)} />
                Dolu sıraya araya gir (diğerleri aşağı kayar)
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={ata} disabled={busy || !plan || secili.size === 0} className="bg-vw-deep text-white hover:bg-vw-dark">
            {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            Ata{secili.size > 0 ? ` (${secili.size} hat)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
