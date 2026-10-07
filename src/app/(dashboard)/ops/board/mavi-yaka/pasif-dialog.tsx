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
import type { TalimatPasifKapsam } from "@/lib/talimat/types";

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

  useEffect(() => {
    if (hedef) {
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
      <DialogContent className="sm:max-w-md">
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
                <Input type="date" value={baslangic} onChange={(e) => setBaslangic(e.target.value)} />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={kaydet} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
            Pasif et
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface PasifKaldirHedef {
  /** 'liste' = tüm liste; 'personel' = seçili personeller */
  kapsam: "liste" | "personel";
  baslik: string;
  /** personel kapsamında seçili personeller; liste kapsamında tüm personeller */
  personeller: string[];
  /** Bu personellerde satır düzeyinde pasif olan satırlar */
  pasifSatirlar: string[];
  /** Planda aktif liste düzeyi pasif kaydı var mı */
  listePasifVar: boolean;
  /** Aktif personel düzeyi pasif kaydı var mı */
  personelPasifVar: boolean;
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

  useEffect(() => {
    if (hedef) {
      setAlt(true);
      setListe(true);
    }
  }, [hedef]);

  const uygula = async () => {
    if (!hedef) return;
    setBusy(true);
    const hatalar: string[] = [];
    const calis = async (p: ReturnType<typeof talimatPasifKaldir>) => {
      const r = await p;
      if (!r.success) hatalar.push(r.error);
    };
    if (hedef.kapsam === "liste") {
      await calis(talimatPasifKaldir({ kapsam: "liste", planId }));
      if (alt) {
        if (hedef.personeller.length) await calis(talimatPasifKaldir({ kapsam: "personel", planId, ids: hedef.personeller }));
        if (hedef.pasifSatirlar.length) await calis(talimatPasifKaldir({ kapsam: "satir", planId, ids: hedef.pasifSatirlar }));
      }
    } else {
      await calis(talimatPasifKaldir({ kapsam: "personel", planId, ids: hedef.personeller }));
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pasifi kaldır</DialogTitle>
          <DialogDescription>{hedef?.baslik}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          {hedef?.kapsam === "liste" ? (
            <label className="flex items-start gap-2">
              <Checkbox checked={alt} onCheckedChange={(v) => setAlt(!!v)} className="mt-0.5" />
              <span>
                Personel ve satır düzeyindeki pasifleri de kaldır
                <span className="block text-xs text-muted-foreground">
                  {hedef.pasifSatirlar.length} pasif satır{hedef.personelPasifVar ? " + personel pasifleri" : ""}
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
                      Liste düzeyinde pasif kayıt var; kalırsa personel pasif görünmeye devam eder.
                    </span>
                  </span>
                </label>
              )}
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Vazgeç
          </Button>
          <Button onClick={uygula} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
            Pasifi kaldır
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
