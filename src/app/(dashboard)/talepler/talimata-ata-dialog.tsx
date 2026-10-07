"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MiktarHizliInput } from "@/components/shared/miktar-hizli-input";
import { siraDurumuGetir } from "@/lib/talimat/actions";
import { ataHedefPlanGetir } from "@/lib/talimat/admin-actions";
import { TALIMAT_ISTASYONLAR } from "@/lib/talimat/constants";
import { talepTalimataAta } from "@/lib/talep/actions";
import type { TalimatIstasyon, TalimatPersonel, TalimatPlan } from "@/lib/talimat/types";
import type { Talep } from "@/lib/talep/types";
import { cn, formatDate } from "@/lib/utils";
import { PlakaSecici } from "../ops/board/mavi-yaka/plaka-secici";

interface Props {
  talep: Talep | null;
  personeller: TalimatPersonel[];
  onClose: () => void;
  onDone: () => void;
}

type SiraSatiri = { satir_id: string; sira: number; sku: string | null; urun_adi: string | null; etkin_durum: string };
type Mod = "kaydir" | "bos";

export function TalimataAtaDialog({ talep, personeller, onClose, onDone }: Props) {
  const [plan, setPlan] = useState<TalimatPlan | null>(null);
  const [planYukleniyor, setPlanYukleniyor] = useState(false);
  const [personelId, setPersonelId] = useState("");
  const [personelAcik, setPersonelAcik] = useState(false);
  const [liste, setListe] = useState<SiraSatiri[]>([]);
  const [sira, setSira] = useState("");
  const [mod, setMod] = useState<Mod>("kaydir");
  const [miktar, setMiktar] = useState<number | null>(null);
  const [istasyon, setIstasyon] = useState<"" | TalimatIstasyon>("");
  const [plakaId, setPlakaId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!talep) return;
    setPersonelId("");
    setListe([]);
    setSira("");
    setMod("kaydir");
    setMiktar(talep.istenen_miktar);
    setIstasyon("");
    setPlakaId(null);
    setPlanYukleniyor(true);
    void ataHedefPlanGetir().then((r) => {
      setPlan(r.success ? r.data : null);
      setPlanYukleniyor(false);
    });
  }, [talep]);

  useEffect(() => {
    if (!plan || !personelId) {
      setListe([]);
      return;
    }
    void siraDurumuGetir(plan.plan_id, personelId).then((r) => setListe(r.success ? (r.data as SiraSatiri[]) : []));
  }, [plan, personelId]);

  if (!talep) return null;

  const siraSayi = sira.trim() === "" ? null : Math.floor(Number(sira));
  const dolu = siraSayi != null ? liste.find((l) => l.sira === siraSayi) : undefined;
  const personel = personeller.find((p) => p.user_id === personelId);

  const ata = async () => {
    if (!plan) return void toast.error("Hedef plan bulunamadı");
    if (!personelId) return void toast.error("Personel seçin");
    if (siraSayi != null && (!Number.isFinite(siraSayi) || siraSayi < 1)) return void toast.error("Geçersiz sıra");
    setBusy(true);
    const bosaEkle = !!dolu && mod === "bos";
    const r = await talepTalimataAta({
      talepId: talep.talep_id,
      personelId,
      sira: bosaEkle ? null : siraSayi,
      miktar,
      istasyon: istasyon || null,
      plakaId: istasyon === "kesim" ? plakaId : null,
      kaydir: !!dolu && mod === "kaydir",
      planId: plan.plan_id,
    });
    setBusy(false);
    if (!r.success) return void toast.error(r.error);
    toast.success("İş talimatına atandı");
    onDone();
    onClose();
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
            {planYukleniyor ? (
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
            <Label>Personel</Label>
            <Popover open={personelAcik} onOpenChange={setPersonelAcik}>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" role="combobox" className="w-full justify-between font-normal">
                  {personel ? personel.full_name : <span className="text-muted-foreground">Personel seç...</span>}
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[min(92vw,340px)] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Personel ara..." />
                  <CommandList>
                    <CommandEmpty>Personel bulunamadı</CommandEmpty>
                    <CommandGroup>
                      {personeller.map((p) => (
                        <CommandItem
                          key={p.user_id}
                          value={`${p.full_name} ${p.user_id}`}
                          onSelect={() => {
                            setPersonelId(p.user_id);
                            setPersonelAcik(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", personelId === p.user_id ? "opacity-100" : "opacity-0")} />
                          <span className="flex-1 truncate">{p.full_name}</span>
                          <span className="text-[11px] text-muted-foreground">{p.station ?? p.role}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {personelId && (
            <div>
              <Label>Sıra (boş = listenin sonu)</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  value={sira}
                  onChange={(e) => setSira(e.target.value)}
                  placeholder={`${liste.length + 1}`}
                  className="w-24"
                />
                <span className="text-xs text-muted-foreground">Mevcut: {liste.length} satır</span>
              </div>
              {liste.length > 0 && (
                <ol className="mt-2 max-h-28 space-y-0.5 overflow-y-auto rounded border bg-muted/30 p-2 text-xs">
                  {liste.map((l) => (
                    <li key={l.satir_id} className={cn("flex gap-2", l.sira === siraSayi && "font-semibold text-[#b8650c]")}>
                      <span className="w-5 tabular-nums">{l.sira}.</span>
                      <span className="truncate">
                        {l.sku ?? "(boş)"} {l.urun_adi ? `· ${l.urun_adi}` : ""}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
              {dolu && (
                <div className="mt-2 rounded-lg border border-[#f28a19]/40 bg-[#fde8cf]/60 p-2.5 text-sm">
                  <div className="mb-1.5 font-medium text-[#b8650c]">
                    {siraSayi}. sırada <b>{dolu.sku ?? "boş satır"}</b>
                    {dolu.urun_adi ? ` (${dolu.urun_adi})` : ""} var.
                  </div>
                  <label className="flex items-center gap-2">
                    <input type="radio" checked={mod === "kaydir"} onChange={() => setMod("kaydir")} />
                    Kaydır (araya gir, diğerleri aşağı iner)
                  </label>
                  <label className="mt-1 flex items-center gap-2">
                    <input type="radio" checked={mod === "bos"} onChange={() => setMod("bos")} />
                    İlk boş sıraya ekle (listenin sonuna)
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Miktar</Label>
              <MiktarHizliInput value={miktar} onCommit={setMiktar} inputClassName="w-24" />
            </div>
            <div>
              <Label>İstasyon</Label>
              <select
                value={istasyon}
                onChange={(e) => setIstasyon(e.target.value as "" | TalimatIstasyon)}
                className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
              >
                <option value="">Otomatik</option>
                {TALIMAT_ISTASYONLAR.map((i) => (
                  <option key={i.value} value={i.value}>
                    {i.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {istasyon === "kesim" && (
            <div>
              <Label>Plaka</Label>
              <div>
                <PlakaSecici sku={talep.sku} plakaId={plakaId} plakaAdi={plakaId} onSelect={setPlakaId} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={ata} disabled={busy || !plan} className="bg-vw-deep text-white hover:bg-vw-dark">
            Ata
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
