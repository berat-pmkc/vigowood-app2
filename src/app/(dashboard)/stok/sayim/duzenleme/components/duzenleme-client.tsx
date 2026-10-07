"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { stokDuzeltToplu } from "../actions";

export interface DuzenlemeUrun {
  sku: string;
  ad: string | null;
  kategori: string | null;
  /** Tüm depoların toplamı */
  toplam: number;
  /** depo_id -> miktar */
  depoMiktar: Record<string, number>;
  /** Tüm zamanlar 'Stok Düzeltme' toplamları */
  artis: number;
  azalis: number;
  sonDuzeltme: string | null;
}

const fmt = (n: number) => Number(n).toLocaleString("tr-TR", { maximumFractionDigits: 2 });

export function DuzenlemeClient({
  depolar, urunler,
}: { depolar: { depo_id: string; ad: string }[]; urunler: DuzenlemeUrun[] }) {
  const router = useRouter();
  const [depoId, setDepoId] = useState(depolar[0]?.depo_id ?? "");
  const [arama, setArama] = useState("");
  const [kategori, setKategori] = useState("hepsi");
  const [sadeceDegisen, setSadeceDegisen] = useState(false);
  const [ortakNeden, setOrtakNeden] = useState("");
  // sku -> ham giriş (depo değişince sıfırlanır; her depo ayrı düzeltme)
  const [miktarlar, setMiktarlar] = useState<Record<string, string>>({});
  const [nedenler, setNedenler] = useState<Record<string, string>>({});
  const [kaydediliyor, basla] = useTransition();

  const kategoriler = useMemo(
    () => [...new Set(urunler.map((u) => u.kategori).filter(Boolean) as string[])].sort(),
    [urunler],
  );

  const sayiOku = (ham: string | undefined) => {
    const t = (ham ?? "").trim().replace(",", ".");
    if (t === "" || t === "-" || t === "+") return 0;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };

  const degisenler = useMemo(
    () => urunler.filter((u) => {
      const n = sayiOku(miktarlar[u.sku]);
      return Number.isNaN(n) || n !== 0;
    }),
    [urunler, miktarlar],
  );

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    return urunler.filter((u) => {
      if (kategori !== "hepsi" && u.kategori !== kategori) return false;
      if (sadeceDegisen) {
        const n = sayiOku(miktarlar[u.sku]);
        if (!Number.isNaN(n) && n === 0) return false;
      }
      if (!q) return true;
      return u.sku.toLocaleLowerCase("tr").includes(q) || (u.ad ?? "").toLocaleLowerCase("tr").includes(q);
    });
  }, [urunler, kategori, arama, sadeceDegisen, miktarlar]);

  const depoDegis = (id: string) => {
    if (degisenler.length > 0 && !window.confirm("Depo değişince girilen düzeltmeler temizlenir. Devam edilsin mi?")) {
      return;
    }
    setDepoId(id);
    setMiktarlar({});
    setNedenler({});
  };

  const kaydet = () => {
    const kalemler: { sku: string; qty: number; neden: string }[] = [];
    for (const u of degisenler) {
      const qty = sayiOku(miktarlar[u.sku]);
      if (Number.isNaN(qty)) {
        toast.error(`${u.sku}: geçerli bir sayı girin`);
        return;
      }
      const neden = (nedenler[u.sku] ?? "").trim() || ortakNeden.trim();
      if (!neden) {
        toast.error(`${u.sku}: neden yazın (satır nedeni veya ortak neden)`);
        return;
      }
      kalemler.push({ sku: u.sku, qty, neden });
    }
    if (kalemler.length === 0) {
      toast.error("Düzeltme miktarı girilmiş kalem yok");
      return;
    }
    basla(async () => {
      const r = await stokDuzeltToplu(depoId, kalemler);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      if (r.data.basarili > 0) toast.success(`${r.data.basarili} kalem düzeltildi`);
      if (r.data.hatalar.length > 0) {
        toast.error(
          `${r.data.hatalar.length} kalem yazılamadı: ` +
          r.data.hatalar.slice(0, 3).map((h) => `${h.sku} (${h.hata})`).join("; "),
        );
        // Başarısız olanlar ekranda kalsın, başarılar temizlensin
        const kalan = new Set(r.data.hatalar.map((h) => h.sku));
        setMiktarlar((m) => Object.fromEntries(Object.entries(m).filter(([k]) => kalan.has(k))));
        setNedenler((m) => Object.fromEntries(Object.entries(m).filter(([k]) => kalan.has(k))));
      } else {
        setMiktarlar({});
        setNedenler({});
        setOrtakNeden("");
      }
      router.refresh();
    });
  };

  if (depolar.length === 0) {
    return <Card className="p-6 text-sm text-muted-foreground">Tanımlı depo bulunamadı.</Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <div className="grid gap-3 md:grid-cols-[220px_1fr_180px_1fr]">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Depo</label>
            <Select value={depoId} onValueChange={depoDegis}>
              <SelectTrigger className="h-10"><SelectValue placeholder="Depo seçiniz" /></SelectTrigger>
              <SelectContent>
                {depolar.map((d) => <SelectItem key={d.depo_id} value={d.depo_id}>{d.ad}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ara</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={arama} onChange={(e) => setArama(e.target.value)} placeholder="SKU veya ürün adı" className="h-10 pl-8" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Kategori</label>
            <Select value={kategori} onValueChange={setKategori}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hepsi">Hepsi</SelectItem>
                {kategoriler.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Ortak neden (satır nedeni boşsa kullanılır)</label>
            <Input value={ortakNeden} onChange={(e) => setOrtakNeden(e.target.value)} placeholder="Örn. sayım farkı, hasar, yanlış giriş" className="h-10" />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <Button variant={sadeceDegisen ? "default" : "outline"} size="sm" onClick={() => setSadeceDegisen((v) => !v)}>
            Yalnızca düzeltilenler
          </Button>
          <Button onClick={kaydet} disabled={kaydediliyor || degisenler.length === 0} className="h-10">
            {kaydediliyor ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Save className="mr-2 size-4" />}
            Kaydet ({degisenler.length})
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[170px]">SKU</TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead className="w-[110px] text-right">Depo stoğu</TableHead>
                <TableHead className="w-[110px] text-right">Toplam stok</TableHead>
                <TableHead className="w-[130px] text-right">Düzeltme (+/−)</TableHead>
                <TableHead className="w-[100px] text-right">Sonuç</TableHead>
                <TableHead className="w-[220px]">Neden</TableHead>
                <TableHead className="w-[170px]">Önceki düzeltmeler</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">Kayıt bulunamadı</TableCell>
                </TableRow>
              ) : (
                gorunen.slice(0, 300).map((u) => {
                  const mevcut = u.depoMiktar[depoId] ?? 0;
                  const n = sayiOku(miktarlar[u.sku]);
                  const gecerli = !Number.isNaN(n);
                  const sonuc = mevcut + (gecerli ? n : 0);
                  return (
                    <TableRow key={u.sku}>
                      <TableCell className="font-mono text-xs">{u.sku}</TableCell>
                      <TableCell className="text-sm">{u.ad ?? "—"}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", mevcut < 0 && "text-red-700")}>{fmt(mevcut)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{fmt(u.toplam)}</TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="text" inputMode="decimal"
                          value={miktarlar[u.sku] ?? ""}
                          onChange={(e) => setMiktarlar((m) => ({ ...m, [u.sku]: e.target.value }))}
                          className={cn("h-9 text-right tabular-nums", !gecerli && "border-red-400")}
                          placeholder="+5 / -3"
                        />
                      </TableCell>
                      <TableCell className={cn(
                        "text-right tabular-nums font-medium",
                        gecerli && n !== 0 && sonuc < 0 && "text-red-700",
                        gecerli && n > 0 && sonuc >= 0 && "text-emerald-700",
                      )}>
                        {gecerli && n !== 0 ? fmt(sonuc) : "—"}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={nedenler[u.sku] ?? ""}
                          onChange={(e) => setNedenler((m) => ({ ...m, [u.sku]: e.target.value }))}
                          className="h-9" placeholder={ortakNeden || "Neden"}
                        />
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        <span className="font-medium text-emerald-700">+{fmt(u.artis)}</span>
                        {" / "}
                        <span className="font-medium text-red-700">−{fmt(u.azalis)}</span>
                        {u.sonDuzeltme && (
                          <span className="block text-muted-foreground">
                            Son: {new Date(u.sonDuzeltme).toLocaleDateString("tr-TR")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {gorunen.length > 300 && (
          <p className="border-t p-3 text-xs text-muted-foreground">
            {gorunen.length} üründen ilk 300&apos;ü gösteriliyor. Aramayla daraltın.
          </p>
        )}
      </Card>
    </div>
  );
}
