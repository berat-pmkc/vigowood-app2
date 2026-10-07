"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  ListPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  Warehouse,
  XCircle,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRealtimeSubscription } from "@/hooks/use-realtime-subscription";
import { talepGeriCek, talepKapat, talepSil, talepStoktaMevcut, talepYenidenAc } from "@/lib/talep/actions";
import { TALEP_DURUM_COLOR, TALEP_DURUM_LABEL } from "@/lib/talimat/constants";
import { talepSerbestMi } from "@/lib/talimat/helpers";
import type { TalepBaglanti } from "@/lib/talimat/admin-actions";
import type { Depo, TalimatPersonel } from "@/lib/talimat/types";
import type { Talep, TalepDurum } from "@/lib/talep/types";
import { cn, formatDate, formatNumber } from "@/lib/utils";
import { TalepFormDialog } from "./talep-form-dialog";
import { TalimataAtaDialog } from "./talimata-ata-dialog";

export type TalepSekme = "aktif" | "tamamlanan" | "tamamlanmayan";

interface Props {
  sekme: TalepSekme;
  talepler: Talep[];
  toplam: number;
  baglantilar: TalepBaglanti[];
  depolar: Depo[];
  personeller: TalimatPersonel[];
  userId: string;
  planner: boolean;
  baslangic: string;
  bitis: string;
  vurgu: string | null;
}

const SEKMELER: Array<{ key: TalepSekme; label: string }> = [
  { key: "aktif", label: "Aktif Talepler" },
  { key: "tamamlanan", label: "Tamamlanan Talepler" },
  { key: "tamamlanmayan", label: "Tamamlanmayan Talepler" },
];

const CHIPS: Array<{ key: "tumu" | TalepDurum; label: string }> = [
  { key: "tumu", label: "Tümü" },
  { key: "acik", label: "Açık" },
  { key: "is_emri_verildi", label: "İş emri verilenler" },
  { key: "hazirlaniyor", label: "Hazırlığı başlayanlar" },
  { key: "hazir", label: "Tamamlananlar (hazır)" },
  { key: "pasif", label: "Pasif" },
];

type NedenIslem = { tip: "geri_cek" | "tamamlanmadi" | "stokta_mevcut"; talep: Talep };

const NEDEN_METIN: Record<NedenIslem["tip"], { baslik: string; aciklama: string; buton: string }> = {
  geri_cek: { baslik: "Talebi geri çek", aciklama: "Bağlı iş talimatı satırları pasife alınır.", buton: "Geri çek" },
  tamamlanmadi: { baslik: "Tamamlanmadı olarak kapat", aciklama: "Bağlı iş talimatı satırları pasife alınır.", buton: "Kapat" },
  stokta_mevcut: { baslik: "Stokta mevcut", aciklama: "Talep kapatılır, bağlı iş talimatı satırları pasife alınır.", buton: "Stokta mevcut" },
};

export function TaleplerClient({
  sekme,
  talepler,
  toplam,
  baglantilar,
  depolar,
  personeller,
  userId,
  planner,
  baslangic,
  bitis,
  vurgu,
}: Props) {
  const router = useRouter();
  const yenile = useCallback(() => router.refresh(), [router]);

  useRealtimeSubscription({
    channelName: "talepler-sayfasi",
    subscriptions: [
      { event: "*", table: "talepler" },
      { event: "*", table: "talimat_satirlar" },
    ],
    debounceMs: 1200,
  });

  // filtreler
  const [chip, setChip] = useState<"tumu" | TalepDurum>("tumu");
  const [fNo, setFNo] = useState("");
  const [fEden, setFEden] = useState("");
  const [fUrun, setFUrun] = useState("");
  const [fDepo, setFDepo] = useState("");
  const [fAciklama, setFAciklama] = useState("");
  const [tBas, setTBas] = useState(baslangic);
  const [tBit, setTBit] = useState(bitis);

  const baglantiMap = useMemo(() => new Map(baglantilar.map((b) => [b.talep_id, b])), [baglantilar]);

  const sayilar = useMemo(() => {
    const m: Record<string, number> = { tumu: talepler.length };
    for (const t of talepler) m[t.durum] = (m[t.durum] ?? 0) + 1;
    return m;
  }, [talepler]);

  const edenler = useMemo(() => [...new Set(talepler.map((t) => t.olusturan_adi ?? t.olusturan))].sort((a, b) => a.localeCompare(b, "tr")), [talepler]);

  const gorunen = useMemo(() => {
    const no = fNo.trim().replace("#", "");
    const u = fUrun.trim().toLocaleLowerCase("tr");
    const a = fAciklama.trim().toLocaleLowerCase("tr");
    return talepler.filter((t) => {
      if (sekme === "aktif" && chip !== "tumu" && t.durum !== chip) return false;
      if (no && !String(t.talep_no).includes(no)) return false;
      if (fEden && (t.olusturan_adi ?? t.olusturan) !== fEden) return false;
      if (u && !`${t.sku} ${t.urun_adi ?? ""}`.toLocaleLowerCase("tr").includes(u)) return false;
      if (fDepo && t.hedef_depo_id !== fDepo) return false;
      if (a && !(t.aciklama ?? "").toLocaleLowerCase("tr").includes(a)) return false;
      return true;
    });
  }, [talepler, sekme, chip, fNo, fEden, fUrun, fDepo, fAciklama]);

  // vurgulu satıra kaydır
  const vurguRef = useRef<HTMLTableRowElement | null>(null);
  useEffect(() => {
    vurguRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [vurgu, talepler]);

  // diyaloglar
  const [formAcik, setFormAcik] = useState(false);
  const [duzenle, setDuzenle] = useState<Talep | null>(null);
  const [ataTalep, setAtaTalep] = useState<Talep | null>(null);
  const [silTalep, setSilTalep] = useState<Talep | null>(null);
  const [nedenIslem, setNedenIslem] = useState<NedenIslem | null>(null);
  const [neden, setNeden] = useState("");

  const sekmeHref = (s: TalepSekme) => (s === "aktif" ? "/talepler" : `/talepler?sekme=${s}`);

  const tarihUygula = () => {
    const qs = new URLSearchParams({ sekme });
    if (tBas) qs.set("baslangic", tBas);
    if (tBit) qs.set("bitis", tBit);
    router.push(`/talepler?${qs.toString()}`);
  };

  const nedenOnayla = async () => {
    if (!nedenIslem) return;
    const { tip, talep } = nedenIslem;
    const n = neden.trim() || null;
    const r =
      tip === "geri_cek"
        ? await talepGeriCek(talep.talep_id, n)
        : tip === "tamamlanmadi"
          ? await talepKapat(talep.talep_id, "tamamlanmadi", n)
          : await talepStoktaMevcut(talep.talep_id, n);
    if (!r.success) return void toast.error(r.error);
    toast.success("İşlem tamamlandı");
    setNedenIslem(null);
    setNeden("");
    yenile();
  };

  const bugun = new Date().toLocaleDateString("sv-SE");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Talepler</h1>
          <p className="text-sm text-muted-foreground">Üretim talepleri — en eski üstte, yeni talepler listenin sonuna eklenir</p>
        </div>
        <div className="ml-auto flex gap-2">
          {planner && (
            <Button asChild variant="outline" size="sm">
              <Link href="/ops/board/mavi-yaka">
                <ClipboardList className="mr-1.5 h-4 w-4" /> Mavi Yaka planı
              </Link>
            </Button>
          )}
          <Button
            size="sm"
            className="bg-vw-deep text-white hover:bg-vw-dark"
            onClick={() => {
              setDuzenle(null);
              setFormAcik(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Yeni Talep
          </Button>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {SEKMELER.map((s) => (
          <Link
            key={s.key}
            href={sekmeHref(s.key)}
            className={cn(
              "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              sekme === s.key ? "bg-background text-vw-dark shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </div>

      {/* Durum çipleri (aktif) veya tarih filtresi (geçmiş) */}
      {sekme === "aktif" ? (
        <div className="flex flex-wrap gap-1.5">
          {CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setChip(c.key)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                chip === c.key ? "border-vw-deep bg-vw-deep text-white" : "border-border hover:bg-muted",
              )}
            >
              {c.label} <span className="ml-1 tabular-nums opacity-80">{sayilar[c.key] ?? 0}</span>
            </button>
          ))}
        </div>
      ) : (
        <Card className="flex-row flex-wrap items-end gap-3 p-3">
          <div>
            <Label className="text-xs">Başlangıç</Label>
            <Input type="date" value={tBas} onChange={(e) => setTBas(e.target.value)} className="h-9 w-40" />
          </div>
          <div>
            <Label className="text-xs">Bitiş</Label>
            <Input type="date" value={tBit} onChange={(e) => setTBit(e.target.value)} className="h-9 w-40" />
          </div>
          <Button size="sm" onClick={tarihUygula} className="bg-vw-deep text-white hover:bg-vw-dark">
            Uygula
          </Button>
          {(baslangic || bitis) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setTBas("");
                setTBit("");
                router.push(`/talepler?sekme=${sekme}`);
              }}
            >
              <X className="mr-1 h-4 w-4" /> Temizle
            </Button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{toplam} kayıt</span>
        </Card>
      )}

      {vurgu && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Seçili talep vurgulandı.
          <Link href={sekmeHref(sekme)} className="text-[#3368b1] hover:underline">
            Vurguyu kaldır
          </Link>
        </div>
      )}

      {/* Tablo */}
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[1250px] border-collapse text-sm">
          <thead className="bg-vw-light text-left text-xs font-semibold uppercase tracking-wide text-vw-deep">
            <tr>
              <th className="px-2 py-2">Talep No</th>
              <th className="px-2 py-2">Tarih</th>
              <th className="px-2 py-2">Talep Eden</th>
              <th className="px-2 py-2">Ürün</th>
              <th className="px-2 py-2">Depo</th>
              <th className="px-2 py-2 text-right">Depo Stok</th>
              <th className="px-2 py-2 text-right">Toplam Stok</th>
              <th className="px-2 py-2 text-right">İstenen</th>
              <th className="px-2 py-2 text-right">Üretilen</th>
              <th className="px-2 py-2">Termin</th>
              <th className="px-2 py-2">Durum</th>
              <th className="px-2 py-2">Açıklama</th>
              <th className="px-2 py-2" />
            </tr>
            <tr className="border-t bg-white normal-case">
              <th className="px-1 py-1">
                <Input value={fNo} onChange={(e) => setFNo(e.target.value)} placeholder="No" className="h-7 w-16 px-1.5 text-xs font-normal" />
              </th>
              <th />
              <th className="px-1 py-1">
                <select
                  value={fEden}
                  onChange={(e) => setFEden(e.target.value)}
                  className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs font-normal"
                >
                  <option value="">Tümü</option>
                  {edenler.map((e) => (
                    <option key={e} value={e}>
                      {e}
                    </option>
                  ))}
                </select>
              </th>
              <th className="px-1 py-1">
                <Input value={fUrun} onChange={(e) => setFUrun(e.target.value)} placeholder="Kod / ad" className="h-7 px-1.5 text-xs font-normal" />
              </th>
              <th className="px-1 py-1">
                <select
                  value={fDepo}
                  onChange={(e) => setFDepo(e.target.value)}
                  className="h-7 w-full rounded-md border border-input bg-transparent px-1 text-xs font-normal"
                >
                  <option value="">Tümü</option>
                  {depolar.map((d) => (
                    <option key={d.depo_id} value={d.depo_id}>
                      {d.ad}
                    </option>
                  ))}
                </select>
              </th>
              <th colSpan={6} />
              <th className="px-1 py-1">
                <Input value={fAciklama} onChange={(e) => setFAciklama(e.target.value)} placeholder="Açıklama" className="h-7 px-1.5 text-xs font-normal" />
              </th>
              <th />
            </tr>
          </thead>
          <tbody>
            {gorunen.length === 0 && (
              <tr>
                <td colSpan={13} className="py-12 text-center text-sm text-muted-foreground">
                  Talep bulunamadı.
                </td>
              </tr>
            )}
            {gorunen.map((t) => {
              const renk = TALEP_DURUM_COLOR[t.durum] ?? TALEP_DURUM_COLOR.acik;
              const bag = baglantiMap.get(t.talep_id);
              const kapali = !!t.kapanis;
              const benim = t.olusturan === userId;
              const yetkili = benim || planner;
              const serbest = talepSerbestMi(t.created_at);
              const terminGecti = !kapali && !!t.termin_tarihi && t.termin_tarihi < bugun;
              const vurgulu = vurgu === t.talep_id;
              return (
                <tr
                  key={t.talep_id}
                  ref={vurgulu ? vurguRef : undefined}
                  className={cn("border-b align-top", vurgulu && "bg-[#fff9c4]/60", t.durum === "pasif" && "text-[#78909c]")}
                >
                  <td className="px-2 py-2.5 font-semibold tabular-nums">#{t.talep_no}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 tabular-nums">{formatDate(t.created_at)}</td>
                  <td className="px-2 py-2.5">{t.olusturan_adi ?? t.olusturan}</td>
                  <td className="min-w-[180px] px-2 py-2.5">
                    <div className="font-medium">{t.sku}</div>
                    <div className="text-xs text-muted-foreground">{t.urun_adi}</div>
                  </td>
                  <td className="px-2 py-2.5">{t.depo_adi ?? "—"}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{t.depo_stok != null ? formatNumber(t.depo_stok) : "—"}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{formatNumber(t.toplam_stok)}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{t.istenen_miktar != null ? formatNumber(t.istenen_miktar) : "—"}</td>
                  <td className="px-2 py-2.5 text-right tabular-nums">{t.bagli_satir_sayisi > 0 ? formatNumber(t.uretilen) : "—"}</td>
                  <td className={cn("whitespace-nowrap px-2 py-2.5 tabular-nums", terminGecti && "font-semibold text-[#c0424f]")}>
                    {formatDate(t.termin_tarihi)}
                  </td>
                  <td className="min-w-[130px] px-2 py-2.5">
                    <div className="flex flex-col items-start gap-1">
                      <Badge className="border-0" style={{ background: renk.bg, color: renk.fg }}>
                        {TALEP_DURUM_LABEL[t.durum] ?? t.durum}
                      </Badge>
                      {t.kapanis_neden && <span className="text-[11px] text-muted-foreground">{t.kapanis_neden}</span>}
                      {bag?.kirmizi && <span className="text-[11px] font-semibold text-[#c0424f]">Değişti</span>}
                      {bag && (
                        <Link
                          href={`/ops/board/mavi-yaka?hafta=${bag.hafta_baslangic}`}
                          className="inline-flex items-center gap-1 text-[11px] text-[#3368b1] hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" /> Talimatı gör
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="min-w-[160px] max-w-[260px] px-2 py-2.5 text-xs text-muted-foreground">{t.aciklama ?? ""}</td>
                  <td className="px-1 py-2">
                    {yetkili && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="İşlemler">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          {!kapali && (
                            <>
                              <DropdownMenuItem
                                onClick={() => {
                                  setDuzenle(t);
                                  setFormAcik(true);
                                }}
                              >
                                <Pencil className="mr-2 h-4 w-4" /> Düzenle
                                {!serbest && <span className="ml-auto text-[10px] text-muted-foreground">kayıtlı</span>}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setNeden("");
                                  setNedenIslem({ tip: "geri_cek", talep: t });
                                }}
                              >
                                <Undo2 className="mr-2 h-4 w-4" /> Geri çek
                              </DropdownMenuItem>
                              {t.bagli_satir_sayisi === 0 && (
                                <DropdownMenuItem className="text-[#c0424f]" onClick={() => setSilTalep(t)}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Sil
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                          {planner && !kapali && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setAtaTalep(t)}>
                                <ListPlus className="mr-2 h-4 w-4" /> İş talimatına ata
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setNeden("");
                                  setNedenIslem({ tip: "stokta_mevcut", talep: t });
                                }}
                              >
                                <Warehouse className="mr-2 h-4 w-4" /> Stokta mevcut
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  const r = await talepKapat(t.talep_id, "tamamlandi");
                                  if (!r.success) toast.error(r.error);
                                  else toast.success("Talep tamamlandı");
                                  yenile();
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-[#3caa35]" /> Tamamlandı
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setNeden("");
                                  setNedenIslem({ tip: "tamamlanmadi", talep: t });
                                }}
                              >
                                <XCircle className="mr-2 h-4 w-4 text-[#c0424f]" /> Tamamlanmadı
                              </DropdownMenuItem>
                            </>
                          )}
                          {kapali && (
                            <DropdownMenuItem
                              onClick={async () => {
                                const r = await talepYenidenAc(t.talep_id);
                                if (!r.success) toast.error(r.error);
                                else toast.success("Talep yeniden açıldı");
                                yenile();
                              }}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Yeniden aç
                            </DropdownMenuItem>
                          )}
                          {!kapali && benim && !planner && !serbest && (
                            <div className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-muted-foreground">
                              <CalendarClock className="h-3 w-3" /> 10 dk geçti: değişiklikler kayıt altına alınır
                            </div>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <TalepFormDialog
        open={formAcik}
        onClose={() => setFormAcik(false)}
        depolar={depolar}
        talep={duzenle}
        planner={planner}
        onDone={yenile}
      />

      <TalimataAtaDialog talep={ataTalep} personeller={personeller} onClose={() => setAtaTalep(null)} onDone={yenile} />

      {/* Neden diyaloğu */}
      <Dialog open={!!nedenIslem} onOpenChange={(o) => !o && setNedenIslem(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{nedenIslem && NEDEN_METIN[nedenIslem.tip].baslik}</DialogTitle>
            <DialogDescription>
              {nedenIslem && `#${nedenIslem.talep.talep_no} · ${nedenIslem.talep.sku}. ${NEDEN_METIN[nedenIslem.tip].aciklama}`}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Neden (isteğe bağlı)</Label>
            <Textarea value={neden} onChange={(e) => setNeden(e.target.value)} rows={3} maxLength={500} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNedenIslem(null)}>
              Vazgeç
            </Button>
            <Button onClick={nedenOnayla} className="bg-vw-deep text-white hover:bg-vw-dark">
              {nedenIslem && NEDEN_METIN[nedenIslem.tip].buton}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!silTalep} onOpenChange={(o) => !o && setSilTalep(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Talep silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              #{silTalep?.talep_no} · {silTalep?.sku} kalıcı olarak silinecek.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#c0424f] text-white hover:bg-[#a63744]"
              onClick={async () => {
                if (!silTalep) return;
                const r = await talepSil(silTalep.talep_id);
                if (!r.success) toast.error(r.error);
                else toast.success("Talep silindi");
                setSilTalep(null);
                yenile();
              }}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
