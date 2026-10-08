"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { talimatPasifYap, talimatPasifKaldir } from "@/lib/talimat/actions";
import { talimatZamanliIslemEkle } from "@/lib/talimat/zamanli-actions";
import type { TalimatPasifKapsam } from "@/lib/talimat/types";
import { ZamanliSecenekler, duzIslemMi, istanbulBugun, varsayilanZamanli, zamanGecerliMi, type ZamanliDurum } from "./zamanli-secenek";

export interface PasifHedef {
  kapsam: TalimatPasifKapsam;
  ids: string[];
  baslik: string;
}

interface Props {
  planId: string;
  hedef: PasifHedef | null;
  onClose: () => void;
  onDone: () => void;
}

type Sure = "bugun" | "aralik" | "suresiz";

function bugun(): string {
  return new Date().toLocaleDateString("sv-SE");
}

/** Pasif etme: bugün / tarih aralığı / süresiz + neden */
export function PasifDialog({ planId, hedef, onClose, onDone }: Props) {
  const [sure, setSure] = useState<Sure>("bugun");
  const [baslangic, setBaslangic] = useState(bugun());
  const [bitis, setBitis] = useState(bugun());
  const [neden, setNeden] = useState("");
  const [busy, setBusy] = useState(false);
  const [z, setZ] = useState<ZamanliDurum>(varsayilanZamanli());

  useEffect(() => {
    if (hedef) {
      setZ(varsayilanZamanli());
      setSure("bugun");
      setBaslangic(bugun());
      setBitis(bugun());
      setNeden("");
    }
  }, [hedef]);

  const kaydet = async () => {
    if (!hedef) return;
    if (sure === "aralik" && bitis < baslangic) {
      toast.error("Bitiş tarihi başlangıçtan önce olamaz");
      return;
    }
    const zamanli = hedef.kapsam !== "personel" && !duzIslemMi(z);
    if (zamanli && !zamanGecerliMi(z)) {
      toast.error("Geçerli bir tarih ve saat seçin");
      return;
    }
    if (zamanli) {
      // Zamanlı / yayınlı yol: pasif, seçilen günden itibaren uygulanır
      const gun = z.zaman === "sec" ? z.tarih : istanbulBugun();
      if (sure === "aralik" && bitis < gun) {
        toast.error("Bitiş tarihi başlangıçtan önce olamaz");
        return;
      }
      setBusy(true);
      const zr = await talimatZamanliIslemEkle({
        planId,
        kapsam: hedef.kapsam as "satir" | "hat" | "liste",
        ids: hedef.ids,
        islem: "pasif",
        tarih: z.zaman === "sec" ? z.tarih : null,
        saat: z.zaman === "sec" ? z.saat : null,
        neden: neden.trim() || null,
        bitis: sure === "bugun" ? gun : sure === "aralik" ? bitis || gun : null,
        yayin: z.yayin,
        sesli: z.yayin === "bildirimli" && z.sesli,
      });
      setBusy(false);
      if (!zr.success) {
        toast.error(zr.error);
        return;
      }
      if (zr.data.durum === "bekliyor") toast.success("Pasif işlemi zamanlandı");
      else toast.success(zr.data.uyari ? `Pasif edildi (${zr.data.uyari})` : "Pasif edildi");
      onDone();
      onClose();
      return;
    }
    const bas = sure === "aralik" ? baslangic : bugun();
    const bit = sure === "bugun" ? bas : sure === "aralik" ? bitis || bas : null;
    setBusy(true);
    const r = await talimatPasifYap({
      kapsam: hedef.kapsam,
      planId,
      ids: hedef.ids,
      baslangic: bas,
      bitis: bit,
      neden: neden.trim() || null,
    });
    setBusy(false);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success("Pasif edildi");
    onDone();
    onClose();
  };

  const secenekler: { k: Sure; l: string }[] = [
    { k: "bugun", l: "Bugün" },
    { k: "aralik", l: "Tarih aralığı" },
    { k: "suresiz", l: "Süresiz" },
  ];

  return (
    <Dialog open={!!hedef} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pasif et</DialogTitle>
          <DialogDescription>{hedef?.baslik}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-1 rounded-md border border-vw-side/50 bg-vw-light p-1">
            {secenekler.map((o) => (
              <button
                key={o.k}
                type="button"
                onClick={() => setSure(o.k)}
                className={cn(
                  "h-9 rounded text-sm font-medium transition-colors",
                  sure === o.k ? "bg-vw-deep text-white" : "text-vw-dark hover:bg-black/5",
                )}
              >
                {o.l}
              </button>
            ))}
          </div>
          {sure === "aralik" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Başlangıç</Label>
                {hedef?.kapsam === "personel" || duzIslemMi(z) ? (
                  <Input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
                ) : (
                  <Input type="date" value={z.zaman === "sec" ? z.tarih : istanbulBugun()} disabled />
                )}
              </div>
              <div>
                <Label>Bitiş</Label>
                <Input type="date" value={bitis} min={baslangic} onChange={(e) => setBitis(e.target.value)} />
              </div>
            </div>
          )}
          {sure === "suresiz" && (
            <p className="text-xs text-muted-foreground">Bugünden itibaren elle aktifleştirilene kadar pasif kalır.</p>
          )}
          <div>
            <Label>Neden (isteğe bağlı)</Label>
            <Input value={neden} onChange={(e) => setNeden(e.target.value)} placeholder="Örn. izinli, makine arızası" maxLength={300} />
          </div>
          {hedef?.kapsam !== "personel" && <ZamanliSecenekler durum={z} onChange={setZ} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={kaydet} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
            {z.zaman === "sec" && hedef?.kapsam !== "personel" ? "Zamanla" : "Pasif et"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface PasifKaldirHedef {
  /** 'liste' = tüm liste; 'hat' = seçili hatlar; 'satir' = seçili satırlar (aktif et + iş sırası) */
  kapsam: "liste" | "hat" | "satir";
  /** kapsam='satir' ise aktif edilecek satırlar */
  satirIds?: string[];
  baslik: string;
  /** hat kapsamında seçili hatlar; liste kapsamında tüm hatlar */
  hatlar: string[];
  /** Bu hatlarda satır düzeyinde pasif olan satırlar */
  pasifSatirlar: string[];
  /** Planda aktif liste düzeyi pasif kaydı var mı */
  listePasifVar: boolean;
  /** Aktif hat düzeyi pasif kaydı var mı */
  hatPasifVar: boolean;
}

/** Pasifi kaldırma: alt düzeydekileri de kaldırma seçenekleri */
export function PasifKaldirDialog({
  planId,
  hedef,
  onClose,
  onDone,
}: {
  planId: string;
  hedef: PasifKaldirHedef | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const [alt, setAlt] = useState(true);
  const [liste, setListe] = useState(true);
  const [busy, setBusy] = useState(false);
  const [z, setZ] = useState<ZamanliDurum>(varsayilanZamanli());

  useEffect(() => {
    if (hedef) {
      setAlt(true);
      setListe(true);
      setZ(varsayilanZamanli());
    }
  }, [hedef]);

  /** Zamanlı / yayınlı / özel sıralı yol: işlemler sırayla eklenir, yayın yalnız sonuncuya bağlanır */
  const zamanliUygula = async () => {
    if (!hedef) return;
    if (!zamanGecerliMi(z)) {
      toast.error("Geçerli bir tarih ve saat seçin");
      return;
    }
    const isler: { kapsam: "liste" | "hat" | "satir"; ids: string[] }[] = [];
    if (hedef.kapsam === "satir") {
      isler.push({ kapsam: "satir", ids: hedef.satirIds ?? [] });
    } else if (hedef.kapsam === "liste") {
      isler.push({ kapsam: "liste", ids: [] });
      if (alt) {
        if (hedef.hatlar.length) isler.push({ kapsam: "hat", ids: hedef.hatlar });
        if (hedef.pasifSatirlar.length) isler.push({ kapsam: "satir", ids: hedef.pasifSatirlar });
      }
    } else {
      isler.push({ kapsam: "hat", ids: hedef.hatlar });
      if (alt && hedef.pasifSatirlar.length) isler.push({ kapsam: "satir", ids: hedef.pasifSatirlar });
      if (hedef.listePasifVar && liste) isler.push({ kapsam: "liste", ids: [] });
    }
    setBusy(true);
    let bekleyen = 0;
    let uyari: string | null = null;
    for (let i = 0; i < isler.length; i++) {
      const son = i === isler.length - 1;
      const is = isler[i];
      const r = await talimatZamanliIslemEkle({
        planId,
        kapsam: is.kapsam,
        ids: is.ids,
        islem: "aktif",
        tarih: z.zaman === "sec" ? z.tarih : null,
        saat: z.zaman === "sec" ? z.saat : null,
        hedefSira: is.kapsam === "satir" && hedef.kapsam === "satir" && z.sira === "sec" ? z.siraNo : null,
        yayin: son ? z.yayin : "yok",
        sesli: son && z.yayin === "bildirimli" && z.sesli,
      });
      if (!r.success) {
        toast.error(r.error);
        break;
      }
      if (r.data.durum === "bekliyor") bekleyen++;
      if (r.data.uyari) uyari = r.data.uyari;
    }
    setBusy(false);
    if (bekleyen > 0) toast.success("Aktif etme işlemi zamanlandı");
    else toast.success(uyari ? `Aktif edildi (${uyari})` : "Aktif edildi");
    onDone();
    onClose();
  };

  const uygula = async () => {
    if (!hedef) return;
    if (!duzIslemMi(z)) {
      await zamanliUygula();
      return;
    }
    setBusy(true);
    const hatalar: string[] = [];
    const calis = async (p: ReturnType<typeof talimatPasifKaldir>) => {
      const r = await p;
      if (!r.success) hatalar.push(r.error);
    };
    if (hedef.kapsam === "satir") {
      await calis(talimatPasifKaldir({ kapsam: "satir", planId, ids: hedef.satirIds ?? [] }));
    } else if (hedef.kapsam === "liste") {
      await calis(talimatPasifKaldir({ kapsam: "liste", planId }));
      if (alt) {
        if (hedef.hatlar.length) await calis(talimatPasifKaldir({ kapsam: "hat", planId, ids: hedef.hatlar }));
        if (hedef.pasifSatirlar.length) await calis(talimatPasifKaldir({ kapsam: "satir", planId, ids: hedef.pasifSatirlar }));
      }
    } else {
      await calis(talimatPasifKaldir({ kapsam: "hat", planId, ids: hedef.hatlar }));
      if (alt && hedef.pasifSatirlar.length) await calis(talimatPasifKaldir({ kapsam: "satir", planId, ids: hedef.pasifSatirlar }));
      if (hedef.listePasifVar && liste) await calis(talimatPasifKaldir({ kapsam: "liste", planId }));
    }
    setBusy(false);
    if (hatalar.length) toast.error(hatalar[0]);
    else toast.success("Pasif kaldırıldı");
    onDone();
    onClose();
  };

  return (
    <Dialog open={!!hedef} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{hedef?.kapsam === "satir" ? "Aktif et" : "Pasifi kaldır"}</DialogTitle>
          <DialogDescription>{hedef?.baslik}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {hedef?.kapsam === "satir" ? null : hedef?.kapsam === "liste" ? (
            <label className="flex items-start gap-2">
              <Checkbox checked={alt} onCheckedChange={(v) => setAlt(!!v)} className="mt-0.5" />
              <span>
                Hat ve satır düzeyindeki pasifleri de kaldır
                <span className="block text-xs text-muted-foreground">
                  {hedef.pasifSatirlar.length} pasif satır{hedef.hatPasifVar ? " + hat pasifleri" : ""}
                </span>
              </span>
            </label>
          ) : (
            <>
              <label className="flex items-start gap-2">
                <Checkbox checked={alt} onCheckedChange={(v) => setAlt(!!v)} className="mt-0.5" />
                <span>
                  Satır düzeyindeki pasifleri de kaldır
                  <span className="block text-xs text-muted-foreground">{hedef?.pasifSatirlar.length ?? 0} pasif satır</span>
                </span>
              </label>
              {hedef?.listePasifVar && (
                <label className="flex items-start gap-2">
                  <Checkbox checked={liste} onCheckedChange={(v) => setListe(!!v)} className="mt-0.5" />
                  <span>
                    Tüm liste pasifini de kaldır
                    <span className="block text-xs text-muted-foreground">
                      Liste düzeyinde pasif kayıt var; kalırsa hat pasif görünmeye devam eder.
                    </span>
                  </span>
                </label>
              )}
            </>
          )}
          <ZamanliSecenekler durum={z} onChange={setZ} siraGoster={hedef?.kapsam === "satir"} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={uygula} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
            {z.zaman === "sec" ? "Zamanla" : hedef?.kapsam === "satir" ? "Aktif et" : "Pasifi kaldır"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
