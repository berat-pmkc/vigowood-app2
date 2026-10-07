"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UrunStokCombobox } from "@/components/shared/urun-stok-combobox";
import { urunAra } from "@/lib/talimat/actions";
import { talepGuncelle, talepOlustur, talepStokUyarisiGetir } from "@/lib/talep/actions";
import { talepSerbestMi } from "@/lib/talimat/helpers";
import type { Depo, UrunStokSecenek } from "@/lib/talimat/types";
import type { Talep } from "@/lib/talep/types";
import { formatNumber } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
  depolar: Depo[];
  /** Düzenleme modu */
  talep: Talep | null;
  planner: boolean;
  onDone: () => void;
}

function StokOzeti({ urun }: { urun: UrunStokSecenek }) {
  return (
    <div className="mt-2 rounded-lg border bg-vw-light/60 p-2.5 text-sm">
      <div className="font-medium text-vw-dark">
        Toplam stok: <span className="tabular-nums">{formatNumber(urun.toplam_stok)}</span>
      </div>
      {urun.depo_stoklari.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {urun.depo_stoklari.map((d, i) => (
            <span key={i} className="rounded-full border border-vw-side/40 bg-white px-2 py-0.5 text-xs">
              {d.depo_adi ?? "Depo"}: <b className="tabular-nums">{formatNumber(d.miktar)}</b>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function TalepFormDialog({ open, onClose, depolar, talep, planner, onDone }: Props) {
  const duzenleme = !!talep;
  const baglı = (talep?.bagli_satir_sayisi ?? 0) > 0;
  const [urun, setUrun] = useState<UrunStokSecenek | null>(null);
  const [depoId, setDepoId] = useState("");
  const [miktar, setMiktar] = useState("");
  const [termin, setTermin] = useState("");
  const [aciklama, setAciklama] = useState("");
  const [busy, setBusy] = useState(false);
  const [stokUyari, setStokUyari] = useState<string | null>(null);
  const [bildirimSor, setBildirimSor] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStokUyari(null);
    setBildirimSor(false);
    if (talep) {
      setUrun({ sku: talep.sku, urun_adi: talep.urun_adi, toplam_stok: talep.toplam_stok, depo_stoklari: [] });
      setDepoId(talep.hedef_depo_id ?? "");
      setMiktar(talep.istenen_miktar != null ? String(talep.istenen_miktar) : "");
      setTermin(talep.termin_tarihi ?? "");
      setAciklama(talep.aciklama ?? "");
      void urunAra(talep.sku).then((r) => {
        if (r.success) {
          const u = r.data.find((x) => x.sku === talep.sku);
          if (u) setUrun(u);
        }
      });
    } else {
      setUrun(null);
      setDepoId("");
      setMiktar("");
      setTermin("");
      setAciklama("");
    }
  }, [open, talep]);

  const miktarSayi = miktar.trim() === "" ? null : Number(miktar.replace(",", "."));

  const dogrula = (): boolean => {
    if (!urun) return void toast.error("Ürün seçin"), false;
    if (miktarSayi !== null && (!Number.isFinite(miktarSayi) || miktarSayi <= 0)) return void toast.error("Miktar sıfırdan büyük olmalı"), false;
    if (!termin) return void toast.error("Termin tarihi seçin"), false;
    return true;
  };

  const olustur = async () => {
    if (!urun) return;
    setBusy(true);
    const r = await talepOlustur({
      sku: urun.sku,
      hedefDepoId: depoId || null,
      istenenMiktar: miktarSayi,
      terminTarihi: termin,
      aciklama: aciklama.trim() || null,
    });
    setBusy(false);
    if (!r.success) return void toast.error(r.error);
    toast.success("Talep oluşturuldu");
    onDone();
    onClose();
  };

  const guncelle = async (bildirim: boolean) => {
    if (!talep || !urun) return;
    setBusy(true);
    const r = await talepGuncelle({
      talepId: talep.talep_id,
      ...(urun.sku !== talep.sku ? { sku: urun.sku } : {}),
      hedefDepoId: depoId || null,
      istenenMiktar: miktarSayi,
      terminTarihi: termin || null,
      aciklama: aciklama.trim() || null,
      bildirimGonder: bildirim && planner,
    });
    setBusy(false);
    if (!r.success) return void toast.error(r.error);
    toast.success(r.data.degisti ? "Talep güncellendi" : "Değişiklik yok");
    onDone();
    onClose();
  };

  const kaydet = async () => {
    if (!dogrula()) return;
    if (duzenleme) {
      if (talep && !talepSerbestMi(talep.created_at)) setBildirimSor(true);
      else await guncelle(false);
      return;
    }
    if (miktarSayi && urun) {
      const r = await talepStokUyarisiGetir(urun.sku, depoId || null, miktarSayi);
      if (r.success && r.data.uyari) {
        const depoAdi = depolar.find((d) => d.depo_id === depoId)?.ad;
        const n = r.data.depo_stok != null ? r.data.depo_stok : r.data.toplam_stok;
        setStokUyari(
          `${r.data.depo_stok != null ? `${depoAdi ?? "Hedef depoda"}` : "Stokta"} ${formatNumber(n)} adet var. Yine de talep açmak istiyor musunuz?`,
        );
        return;
      }
    }
    await olustur();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{duzenleme ? `Talebi düzenle (#${talep?.talep_no})` : "Yeni talep"}</DialogTitle>
            <DialogDescription>Üretilmesini istediğiniz ürünü ve hedef depoyu seçin.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Ürün</Label>
              <UrunStokCombobox
                value={urun?.sku ?? null}
                label={urun?.urun_adi}
                disabled={baglı}
                onChange={(u) => setUrun(u)}
                placeholder="Ürün kodu veya adı ile ara..."
              />
              {baglı && <p className="mt-1 text-xs text-muted-foreground">İş talimatına bağlı talebin ürünü değiştirilemez.</p>}
              {urun && <StokOzeti urun={urun} />}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Hedef depo</Label>
                <select
                  value={depoId}
                  onChange={(e) => setDepoId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm"
                >
                  <option value="">Seçilmedi</option>
                  {depolar.map((d) => (
                    <option key={d.depo_id} value={d.depo_id}>
                      {d.ad}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>İstenen miktar (isteğe bağlı)</Label>
                <Input type="number" inputMode="decimal" min={0} value={miktar} onChange={(e) => setMiktar(e.target.value)} placeholder="Örn. 100" />
              </div>
            </div>

            <div>
              <Label>Termin tarihi</Label>
              <Input type="date" value={termin} onChange={(e) => setTermin(e.target.value)} />
            </div>

            <div>
              <Label>Açıklama (isteğe bağlı)</Label>
              <Textarea value={aciklama} onChange={(e) => setAciklama(e.target.value)} rows={3} maxLength={1000} placeholder="Üretime iletilecek not" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Vazgeç
            </Button>
            <Button onClick={kaydet} disabled={busy} className="bg-vw-deep text-white hover:bg-vw-dark">
              {duzenleme ? "Kaydet" : "Talep aç"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stok uyarısı */}
      <AlertDialog open={!!stokUyari} onOpenChange={(o) => !o && setStokUyari(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stok yeterli görünüyor</AlertDialogTitle>
            <AlertDialogDescription>{stokUyari}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-vw-deep text-white hover:bg-vw-dark"
              onClick={() => {
                setStokUyari(null);
                void olustur();
              }}
            >
              Evet, talep aç
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 10 dk sonrası düzenleme: bildirim sorusu */}
      <AlertDialog open={bildirimSor} onOpenChange={(o) => !o && setBildirimSor(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Değişiklik bildirimi gönderilsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Talep 10 dakikadan eski; değişiklik kayıt altına alınır ve bağlı iş talimatı satırları kırmızı (değişti) olur.
              {planner
                ? " Bildirim seçerseniz ilgili personele hemen gönderilir."
                : " Bildirimi iş talimatını yayınlayan planlayıcı gönderir."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                setBildirimSor(false);
                void guncelle(false);
              }}
            >
              Hayır, bildirimsiz
            </Button>
            <AlertDialogAction
              className="bg-vw-deep text-white hover:bg-vw-dark"
              onClick={() => {
                setBildirimSor(false);
                void guncelle(true);
              }}
            >
              Evet, gönder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
