"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { satirGuncelle, topluMiktarYukle, sayimUygula, sayimIptal } from "../../actions";
import { cn } from "@/lib/utils";
import {
  CheckCheck, Download, Loader2, Search, TriangleAlert, Upload, XCircle,
} from "lucide-react";

interface Satir {
  id: string;
  kalem_tipi: string;
  kalem_id: string;
  kalem_adi: string | null;
  kategori: string;
  sistem_miktar: number;
  sayilan_miktar: number | null;
  fark: number | null;
  not_text: string | null;
}
interface Baslik {
  sayim_id: string;
  ad: string;
  sayim_tarihi: string;
  kapsam: string[] | null;
  durum: string;
  notlar: string | null;
  tamamlanma_zamani: string | null;
}

const KATEGORI_ETIKET: Record<string, string> = {
  YARIMAMUL: "Yarı mamül", HAZIR: "Hazır eleman",
  KUTU: "Kutu", KARTON: "Karton", MAMUL: "Mamül",
};

export function SayimDetayClient({
  baslik, satirlar: ilkSatirlar,
}: { baslik: Baslik; satirlar: Satir[] }) {
  const router = useRouter();
  const [satirlar, setSatirlar] = useState(ilkSatirlar);
  const [kategori, setKategori] = useState("hepsi");
  const [arama, setArama] = useState("");
  const [sadeceSayilmayan, setSadeceSayilmayan] = useState(false);
  const [isleniyor, basla] = useTransition();
  const dosyaRef = useRef<HTMLInputElement>(null);

  const kilitli = baslik.durum !== "taslak";

  const kategoriler = useMemo(
    () => [...new Set(satirlar.map((s) => s.kategori))].sort(),
    [satirlar],
  );

  const gorunen = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase("tr");
    return satirlar.filter((s) => {
      if (kategori !== "hepsi" && s.kategori !== kategori) return false;
      if (sadeceSayilmayan && s.sayilan_miktar !== null) return false;
      if (!q) return true;
      return (
        s.kalem_id.toLocaleLowerCase("tr").includes(q) ||
        (s.kalem_adi ?? "").toLocaleLowerCase("tr").includes(q)
      );
    });
  }, [satirlar, kategori, arama, sadeceSayilmayan]);

  const ozet = useMemo(() => {
    const sayilan = satirlar.filter((s) => s.sayilan_miktar !== null);
    const farkli = sayilan.filter((s) => (s.fark ?? 0) !== 0);
    return {
      toplam: satirlar.length,
      sayilan: sayilan.length,
      kalan: satirlar.length - sayilan.length,
      farkli: farkli.length,
    };
  }, [satirlar]);

  /** Miktar girişi — odak çıkınca kaydeder */
  const miktarKaydet = (satir: Satir, ham: string) => {
    const temiz = ham.trim().replace(",", ".");
    const yeni = temiz === "" ? null : Number(temiz);
    if (yeni !== null && !Number.isFinite(yeni)) {
      toast.error("Geçerli bir sayı girin");
      return;
    }
    if (yeni === satir.sayilan_miktar) return;

    // İyimser güncelleme; hata olursa geri alınır
    const onceki = satir.sayilan_miktar;
    setSatirlar((s) =>
      s.map((x) => (x.id === satir.id
        ? { ...x, sayilan_miktar: yeni, fark: (yeni ?? 0) - x.sistem_miktar }
        : x)),
    );

    basla(async () => {
      const r = await satirGuncelle(satir.id, yeni);
      if (!r.success) {
        toast.error(r.error);
        setSatirlar((s) =>
          s.map((x) => (x.id === satir.id
            ? { ...x, sayilan_miktar: onceki, fark: (onceki ?? 0) - x.sistem_miktar }
            : x)),
        );
      }
    });
  };

  const sablonIndir = () => {
    const veri = satirlar.map((s) => ({
      Kalem: s.kalem_id,
      Ad: s.kalem_adi ?? "",
      Kategori: KATEGORI_ETIKET[s.kategori] ?? s.kategori,
      "Sistem Miktar": s.sistem_miktar,
      "Sayılan Miktar": s.sayilan_miktar ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(veri);
    ws["!cols"] = [{ wch: 24 }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 16 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sayım");
    XLSX.writeFile(wb, `${baslik.sayim_id}-sayim.xlsx`);
  };

  const dosyaYukle = async (dosya: File) => {
    try {
      const buf = await dosya.arrayBuffer();
      const wb = XLSX.read(buf);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const satirlarHam = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      const gonderilecek: { kalem_id: string; sayilan: number }[] = [];
      for (const r of satirlarHam) {
        const kalem = String(r["Kalem"] ?? "").trim();
        const ham = r["Sayılan Miktar"];
        if (!kalem || ham === undefined || ham === null || String(ham).trim() === "") continue;
        const sayi = Number(String(ham).replace(",", "."));
        if (!Number.isFinite(sayi)) continue;
        gonderilecek.push({ kalem_id: kalem, sayilan: sayi });
      }

      if (gonderilecek.length === 0) {
        toast.error("Dosyada 'Sayılan Miktar' dolu satır bulunamadı");
        return;
      }

      const r = await topluMiktarYukle(baslik.sayim_id, gonderilecek);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.guncellenen} kalem güncellendi`);
      if (r.eslesmeyen && r.eslesmeyen.length > 0) {
        toast.warning(
          `${r.eslesmeyen.length} kalem eşleşmedi: ${r.eslesmeyen.slice(0, 5).join(", ")}${r.eslesmeyen.length > 5 ? "…" : ""}`,
        );
      }
      router.refresh();
    } catch {
      toast.error("Dosya okunamadı. Şablonu indirip onun üzerine yazın.");
    }
  };

  const uygula = () => {
    basla(async () => {
      const r = await sayimUygula(baslik.sayim_id);
      if (!r.success) {
        toast.error(r.error);
        return;
      }
      toast.success(`${r.guncellenen} kalem sabitlendi, ${r.hareket} düzeltme hareketi yazıldı`);
      router.refresh();
    });
  };

  const iptalEt = () => {
    basla(async () => {
      const r = await sayimIptal(baslik.sayim_id);
      if (!r.success) { toast.error(r.error); return; }
      toast.success("Sayım iptal edildi");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{baslik.ad}</h1>
            <Badge
              variant="outline"
              className={cn(
                baslik.durum === "taslak" && "border-amber-300 bg-amber-50 text-amber-700",
                baslik.durum === "tamamlandi" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                baslik.durum === "iptal" && "border-slate-300 bg-slate-100 text-slate-600",
              )}
            >
              {baslik.durum === "taslak" ? "Taslak"
                : baslik.durum === "tamamlandi" ? "Tamamlandı" : "İptal"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(baslik.sayim_tarihi).toLocaleDateString("tr-TR")} · {baslik.sayim_id}
            {baslik.notlar && ` · ${baslik.notlar}`}
          </p>
        </div>

        {!kilitli && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={sablonIndir}>
              <Download className="mr-2 size-4" />
              Excel İndir
            </Button>
            <Button variant="outline" onClick={() => dosyaRef.current?.click()}>
              <Upload className="mr-2 size-4" />
              Excel Yükle
            </Button>
            <input
              ref={dosyaRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void dosyaYukle(f);
                e.target.value = "";
              }}
            />

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline">
                  <XCircle className="mr-2 size-4" />
                  İptal Et
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sayım iptal edilsin mi?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Kayıt silinmez, iptal olarak işaretlenir. Stok bakiyelerine
                    hiçbir şey yazılmaz.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                  <AlertDialogAction onClick={iptalEt}>İptal Et</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button disabled={ozet.sayilan === 0 || isleniyor}>
                  {isleniyor
                    ? <Loader2 className="mr-2 size-4 animate-spin" />
                    : <CheckCheck className="mr-2 size-4" />}
                  Sayımı Uygula
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sayım uygulansın mı?</AlertDialogTitle>
                  <AlertDialogDescription asChild>
                    <div className="space-y-2 text-sm">
                      <p>
                        <b>{ozet.sayilan}</b> kalemin bakiyesi sayılan değere
                        sabitlenecek. Bunlardan <b>{ozet.farkli}</b> tanesinde
                        sistemle fark var; her biri için kaynağı <b>Sayım</b> olan
                        bir düzeltme hareketi yazılacak.
                      </p>
                      {ozet.kalan > 0 && (
                        <p className="rounded border border-amber-300 bg-amber-50 p-2 text-amber-900">
                          <b>{ozet.kalan}</b> kalem henüz sayılmadı. Bunlara
                          dokunulmayacak, bakiyeleri olduğu gibi kalacak.
                        </p>
                      )}
                      <p className="text-muted-foreground">
                        Bu işlem geri alınamaz. Geçmiş hareketler silinmez.
                      </p>
                    </div>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                  <AlertDialogAction onClick={uygula}>Uygula</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {kilitli && (
        <Card className="border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
          {baslik.durum === "tamamlandi"
            ? `Bu sayım uygulandı${baslik.tamamlanma_zamani ? ` (${new Date(baslik.tamamlanma_zamani).toLocaleString("tr-TR")})` : ""}. Kayıt salt okunur.`
            : "Bu sayım iptal edildi. Stok bakiyelerine hiçbir şey yazılmadı."}
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Toplam kalem", ozet.toplam],
          ["Sayılan", ozet.sayilan],
          ["Sayılmayan", ozet.kalan],
          ["Farklı çıkan", ozet.farkli],
        ].map(([b, d]) => (
          <Card key={String(b)} className="p-3">
            <p className="text-xs text-muted-foreground">{b}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">{d}</p>
          </Card>
        ))}
      </div>

      <Card className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={kategori} onValueChange={setKategori}>
            <TabsList>
              <TabsTrigger value="hepsi">Hepsi</TabsTrigger>
              {kategoriler.map((k) => (
                <TabsTrigger key={k} value={k}>{KATEGORI_ETIKET[k] ?? k}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={arama} onChange={(e) => setArama(e.target.value)}
              placeholder="Kod veya ad ara" className="pl-8"
            />
          </div>
          <Button
            variant={sadeceSayilmayan ? "default" : "outline"}
            onClick={() => setSadeceSayilmayan((v) => !v)}
          >
            Sayılmayanlar
          </Button>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Kalem</TableHead>
                <TableHead>Ad</TableHead>
                <TableHead className="w-[110px]">Kategori</TableHead>
                <TableHead className="w-[110px] text-right">Sistem</TableHead>
                <TableHead className="w-[130px] text-right">Sayılan</TableHead>
                <TableHead className="w-[110px] text-right">Fark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gorunen.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Kayıt bulunamadı
                  </TableCell>
                </TableRow>
              ) : (
                gorunen.slice(0, 400).map((s) => {
                  const fark = s.sayilan_miktar === null ? null : (s.sayilan_miktar - s.sistem_miktar);
                  return (
                    <TableRow key={s.id} className={cn(s.sayilan_miktar === null && "opacity-70")}>
                      <TableCell className="font-mono text-xs">{s.kalem_id}</TableCell>
                      <TableCell className="text-sm">{s.kalem_adi ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[11px]">
                          {KATEGORI_ETIKET[s.kategori] ?? s.kategori}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {Number(s.sistem_miktar).toLocaleString("tr-TR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="text" inputMode="decimal" disabled={kilitli}
                          defaultValue={s.sayilan_miktar ?? ""}
                          onBlur={(e) => miktarKaydet(s, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="h-8 text-right tabular-nums"
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right tabular-nums",
                          fark === null && "text-muted-foreground",
                          fark !== null && fark > 0 && "font-medium text-emerald-700",
                          fark !== null && fark < 0 && "font-medium text-red-700",
                        )}
                      >
                        {fark === null ? "—" : (fark > 0 ? "+" : "") + fark.toLocaleString("tr-TR")}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        {gorunen.length > 400 && (
          <div className="flex items-center gap-2 border-t p-3 text-xs text-muted-foreground">
            <TriangleAlert className="size-3.5" />
            {gorunen.length} kalemin ilk 400&apos;ü gösteriliyor. Aramayla daraltın
            veya Excel ile toplu girin.
          </div>
        )}
      </Card>
    </div>
  );
}
