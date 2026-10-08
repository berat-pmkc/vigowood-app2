"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, RotateCcw, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { TALIMAT_ISTASYON_LABEL } from "@/lib/talimat/constants";
import { hataGoreGrupla } from "@/lib/talimat/helpers";
import { HAT_YAZI_RENGI, hatRengi, hatRengiAcik } from "@/lib/talimat/hat-renk";
import type { TalimatSatir } from "@/lib/talimat/types";

function zamanTr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

/** Türkçe karakterlerden bağımsız karşılaştırma (İ/ı/ş/ğ/ü/ö/ç) */
const trNorm = (t: string | null | undefined) =>
  (t ?? "")
    .replace(/İ/g, "i")
    .replace(/I/g, "i")
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ı/g, "i");

const ISTASYON_CHIPS = [
  { value: "", label: "Tümü" },
  { value: "montaj", label: "Montaj" },
  { value: "paketleme", label: "Paketleme" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Haftanın tamamlanan satırları */
  satirlar: TalimatSatir[];
  /** Plan düzenlenebilir mi (tekrar aktif et yalnızca o zaman) */
  editable: boolean;
  /** Sayacı sıfırlayıp satırı yeniden aktif eder */
  yenidenAktifEt: (satirId: string, istenen: number) => Promise<void>;
}

/** Tamamlanan iş talimatı satırları (salt okunur) + filtreler + "Tekrar aktif et" */
export function TamamlananlarDialog({ open, onOpenChange, satirlar, editable, yenidenAktifEt }: Props) {
  const [arama, setArama] = useState("");
  const [hatF, setHatF] = useState("");
  const [istasyonF, setIstasyonF] = useState("");
  const [urunF, setUrunF] = useState("");
  const [urunAcik, setUrunAcik] = useState(false);

  const hatSecenek = useMemo(() => {
    const m = new Map<string, string>();
    const siralar = new Map<string, number>();
    for (const s of satirlar)
      if (s.hat_id) {
        m.set(s.hat_id, s.hat_adi ?? s.hat_id);
        siralar.set(s.hat_id, s.hat_sira ?? 0);
      }
    return [...m.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "tr"))
      .map(([id, ad]) => [id, ad, siralar.get(id) ?? 0] as [string, string, number]);
  }, [satirlar]);

  const urunSecenek = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of satirlar) if (s.sku) m.set(s.sku, s.urun_adi ?? "");
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "tr"));
  }, [satirlar]);

  const filtreli = useMemo(() => {
    const q = trNorm(arama.trim());
    return satirlar.filter((s) => {
      if (hatF && s.hat_id !== hatF) return false;
      if (istasyonF && s.etkin_istasyon !== istasyonF) return false;
      if (urunF && s.sku !== urunF) return false;
      if (q && !trNorm(`${s.sku ?? ""} ${s.plaka_id ?? ""} ${s.urun_adi ?? ""} ${s.hat_adi ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [satirlar, arama, hatF, istasyonF, urunF]);

  const filtreVar = !!(arama || hatF || istasyonF || urunF);
  const temizle = () => {
    setArama("");
    setHatF("");
    setIstasyonF("");
    setUrunF("");
  };

  // Gruplar filtreli satırlardan türetilir: boş gruplar kendiliğinden gizlenir
  const gruplar = useMemo(
    () =>
      [...hataGoreGrupla(filtreli).entries()]
        .map(([pid, liste]) => ({ pid, ad: liste[0]?.hat_adi ?? pid, sira: liste[0]?.hat_sira ?? 0, liste }))
        .sort((a, b) => a.sira - b.sira || a.ad.localeCompare(b.ad, "tr")),
    [filtreli],
  );

  const [acik, setAcik] = useState<TalimatSatir | null>(null);
  const [deger, setDeger] = useState("");
  const [hata, setHata] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ac = (s: TalimatSatir) => {
    setAcik(s);
    setDeger(String(s.istenen_miktar ?? ""));
    setHata(null);
  };

  const onayla = async () => {
    if (!acik) return;
    const n = Number(deger.trim().replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return setHata("Geçerli bir miktar girin");
    setBusy(true);
    await yenidenAktifEt(acik.satir_id, n);
    setBusy(false);
    setAcik(null);
  };

  const kolonSayisi = editable ? 8 : 7;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Tamamlananlar ({satirlar.length})</DialogTitle>
          <DialogDescription>
            İstenen miktarına ulaşan satırlar ana listeden ve tablet listesinden otomatik çıkar. Tamamlanma zamanı yerine son üretim zamanı gösterilir.
          </DialogDescription>
        </DialogHeader>

        {satirlar.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={arama}
                  onChange={(e) => setArama(e.target.value)}
                  placeholder="Ürün kodu, ürün adı veya hat ara..."
                  className="h-9 pl-8"
                />
              </div>
              <select
                value={hatF}
                onChange={(e) => setHatF(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
                aria-label="Hat"
              >
                <option value="">Tüm hatlar</option>
                {hatSecenek.map(([id, ad, sira]) => (
                  <option key={id} value={id} style={{ color: hatRengi({ sira }) }}>● {ad}</option>
                ))}
              </select>
              <Popover open={urunAcik} onOpenChange={setUrunAcik}>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 max-w-[220px] justify-between font-normal">
                    <span className="truncate">{urunF || "Tüm ürünler"}</span>
                    <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(92vw,380px)] p-0" align="start">
                  <Command filter={(value, search) => (trNorm(value).includes(trNorm(search)) ? 1 : 0)}>
                    <CommandInput placeholder="Kod veya ad ara..." />
                    <CommandList>
                      <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="tum urunler"
                          onSelect={() => {
                            setUrunF("");
                            setUrunAcik(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !urunF ? "opacity-100" : "opacity-0")} /> Tüm ürünler
                        </CommandItem>
                        {urunSecenek.map(([sku, ad]) => (
                          <CommandItem
                            key={sku}
                            value={`${sku} ${ad}`}
                            onSelect={() => {
                              setUrunF(sku);
                              setUrunAcik(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4 shrink-0", urunF === sku ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">
                              <b>{sku}</b>
                              {ad ? ` · ${ad}` : ""}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {ISTASYON_CHIPS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setIstasyonF(c.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    istasyonF === c.value ? "border-vw-deep bg-vw-deep text-white" : "bg-background hover:bg-vw-light",
                  )}
                >
                  {c.label}
                </button>
              ))}
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {filtreli.length} / {satirlar.length} kalem
              </span>
              {filtreVar && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={temizle}>
                  <X className="mr-1 h-3.5 w-3.5" /> Temizle
                </Button>
              )}
            </div>
          </div>
        )}

        {satirlar.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Bu hafta tamamlanan satır yok.</p>
        ) : gruplar.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Filtreye uyan kalem yok.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-[#f0ede1] shadow-[0_1px_0_0_rgba(0,0,0,0.1)]">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-3 py-1.5">Sıra</th>
                  <th className="px-3 py-1.5">İstasyon</th>
                  <th className="px-3 py-1.5">Ürün</th>
                  <th className="px-3 py-1.5 text-right">İstenen</th>
                  <th className="px-3 py-1.5 text-right">Üretilen</th>
                  <th className="px-3 py-1.5">Son üretim</th>
                  <th className="px-3 py-1.5">Talep</th>
                  {editable && <th className="px-3 py-1.5" />}
                </tr>
              </thead>
              {gruplar.map((g) => (
                <tbody key={g.pid}>
                  <tr>
                    <td
                      colSpan={kolonSayisi}
                      className="px-3 py-1.5 text-sm font-bold text-white"
                      style={{ backgroundColor: hatRengi({ sira: g.sira }), color: HAT_YAZI_RENGI }}
                    >
                      {g.ad}
                    </td>
                  </tr>
                  {g.liste.map((s) => (
                    <tr key={s.satir_id} className="border-b last:border-0" style={{ backgroundColor: hatRengiAcik({ sira: g.sira }, 0.07) }}>
                      <td className="px-3 py-1.5 tabular-nums" style={{ boxShadow: "inset 5px 0 0 " + hatRengi({ sira: g.sira }) }}>{s.sira}</td>
                      <td className="px-3 py-1.5">{TALIMAT_ISTASYON_LABEL[s.etkin_istasyon]}</td>
                      <td className="px-3 py-1.5">
                        <span className="font-medium">{s.sku ?? s.plaka_id ?? "—"}</span>
                        <span className="ml-2 text-muted-foreground">{s.urun_adi ?? ""}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{s.istenen_miktar ?? "—"}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{s.uretilen}</td>
                      <td className="whitespace-nowrap px-3 py-1.5">{zamanTr(s.son_seans_at)}</td>
                      <td className="px-3 py-1.5">
                        {s.talep_id ? (
                          <Link href={`/talepler?talep=${s.talep_id}`} className="text-[#3368b1] underline">Talep</Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      {editable && (
                        <td className="px-3 py-1.5 text-right">
                          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => ac(s)}>
                            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Tekrar aktif et
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        )}

        <Dialog open={acik !== null} onOpenChange={(o) => !o && setAcik(null)}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Talimatı tekrar aktif et</DialogTitle>
              <DialogDescription>
                {acik?.sku ?? acik?.plaka_id} · üretilen {acik?.uretilen}. Yeni istenen miktarı girin (önceki miktardan büyük olması gerekmez). Sayaç sıfırlanır; yeni üretim bu andan itibaren sayılır.
              </DialogDescription>
            </DialogHeader>
            <Input
              inputMode="decimal"
              value={deger}
              onChange={(e) => setDeger(e.target.value)}
              placeholder="Yeni istenen miktar"
              autoFocus
            />
            {hata && <p className="text-sm text-[#c0424f]">{hata}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAcik(null)}>Vazgeç</Button>
              <Button className="bg-vw-deep text-white hover:bg-vw-dark" disabled={busy} onClick={onayla}>Aktif et</Button>
            </div>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
