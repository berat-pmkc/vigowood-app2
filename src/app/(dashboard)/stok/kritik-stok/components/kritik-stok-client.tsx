"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  type ColumnDef,
} from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { DataTableColumnHeader } from "@/components/shared/data-table-column-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Check, X, Pencil, Info, AlertTriangle, Plus, Minus } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";
import { updateKritikStok } from "../../mamul/actions";
import { saveKritikStokUyari } from "../actions";
import type { KritikStokOneri } from "@/lib/kritikStok";

interface KritikStokClientProps {
  data: KritikStokOneri[];
  canEdit: boolean;
  initialSariEsik: number;
}

type Seviye = "kirmizi" | "sari" | "normal";

/** Kritik stok tanımlı değilse (<=0) uyarı verilmez. */
function seviyeOf(row: KritikStokOneri, sariEsik: number): Seviye {
  const kritik = row.mamul_stok_kritik;
  if (!(kritik > 0)) return "normal";
  if (row.stok_toplam <= kritik) return "kirmizi";
  if (row.stok_toplam <= kritik + sariEsik) return "sari";
  return "normal";
}

/** Kritik seviyeye mesafe: negatif = kritik altında */
const marj = (r: KritikStokOneri) => r.stok_toplam - r.mamul_stok_kritik;

const trNorm = (s: string | null | undefined) =>
  (s ?? "")
    .toLocaleLowerCase("tr")
    .replace(/ı/g, "i")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

type SiraKey = "kritige_yakin" | "en_cok_stok" | "en_az_stok" | "sku";
const SIRA_LABEL: Record<SiraKey, string> = {
  kritige_yakin: "Kritik seviyeye en yakın",
  en_cok_stok: "En çok stoğu olan",
  en_az_stok: "En az stoğu olan",
  sku: "SKU (A-Z)",
};

const ROW_CLASS: Record<Seviye, string> = {
  kirmizi: "bg-[#ee7683]/20 hover:bg-[#ee7683]/30 shadow-[inset_4px_0_0_#ee7683]",
  sari: "bg-[#f28a19]/15 hover:bg-[#f28a19]/25 shadow-[inset_4px_0_0_#f28a19]",
  normal: "",
};

const DURUM_LABEL: Record<KritikStokOneri["durum"], string> = {
  kritik: "Kritik",
  dusuk: "Düşük",
  saglikli: "Sağlıklı",
};

const DURUM_CLASS: Record<KritikStokOneri["durum"], string> = {
  kritik: "bg-vw-error/20 text-vw-error border-vw-error/30",
  dusuk: "bg-vw-warning/20 text-vw-warning border-vw-warning/30",
  saglikli: "bg-vw-success/20 text-vw-success border-vw-success/30",
};

function DurumBadge({ durum }: { durum: KritikStokOneri["durum"] }) {
  return (
    <Badge className={cn("text-xs", DURUM_CLASS[durum])}>{DURUM_LABEL[durum]}</Badge>
  );
}

function KritikStokEditCell({
  row,
  canEdit,
}: {
  row: KritikStokOneri;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(row.mamul_stok_kritik));
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    const num = Number(value);
    if (!Number.isFinite(num) || num < 0) {
      setError("Geçersiz değer");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updateKritikStok(row.sku, Math.round(num));
      if (result.success) {
        setEditing(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") {
      setValue(String(row.mamul_stok_kritik));
      setEditing(false);
      setError(null);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-7 w-20 px-2 text-xs font-mono"
          autoFocus
          disabled={isPending}
        />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave} disabled={isPending}>
          <Check className="h-3.5 w-3.5 text-vw-success" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={() => {
            setValue(String(row.mamul_stok_kritik));
            setEditing(false);
            setError(null);
          }}
          disabled={isPending}
        >
          <X className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
        {error && <span className="text-xs text-vw-error">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-sm">{formatNumber(row.mamul_stok_kritik)}</span>
      {canEdit && (
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 opacity-60 hover:opacity-100"
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function getColumns(canEdit: boolean): ColumnDef<KritikStokOneri>[] {
  return [
    {
      accessorKey: "sku",
      header: ({ column }) => <DataTableColumnHeader column={column} title="SKU" />,
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-sm">{row.original.sku}</span>
          {row.original.urun_adi && (
            <div className="max-w-[180px] truncate text-xs text-muted-foreground">
              {row.original.urun_adi}
            </div>
          )}
        </div>
      ),
      size: 200,
    },
    {
      accessorKey: "stok_toplam",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mevcut Stok" />,
      cell: ({ row }) => (
        <span className="font-mono tabular-nums text-sm">{formatNumber(row.original.stok_toplam)}</span>
      ),
      size: 110,
    },
    {
      accessorKey: "mamul_stok_kritik",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Mevcut Kritik Stok" />,
      cell: ({ row }) => <KritikStokEditCell row={row.original} canEdit={canEdit} />,
      size: 160,
    },
    {
      accessorKey: "onerilen_kritik_stok",
      header: ({ column }) => (
        <span title="Sistemin Hesapladığı Kritik Stok">
          <DataTableColumnHeader column={column} title="Sistemin Hesapladığı" />
        </span>
      ),
      meta: { className: "bg-vw-info/10 text-vw-info" },
      cell: ({ row }) => {
        const fark = row.original.onerilen_kritik_stok - row.original.mamul_stok_kritik;
        return (
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-vw-info/10 px-1.5 py-0.5 font-mono tabular-nums text-sm font-semibold text-vw-info">
              {formatNumber(row.original.onerilen_kritik_stok)}
            </span>
            {Math.abs(fark) > 0 && (
              <span
                className={cn(
                  "text-xs tabular-nums",
                  fark > 0 ? "text-vw-warning" : "text-muted-foreground"
                )}
              >
                ({fark > 0 ? "+" : ""}
                {formatNumber(fark)})
              </span>
            )}
          </div>
        );
      },
      size: 150,
    },
    {
      accessorKey: "satis_90gun",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Satış (90g)" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatNumber(row.original.satis_90gun)}
        </span>
      ),
      meta: { className: "hidden md:table-cell" },
      size: 100,
    },
    {
      accessorKey: "paketlenen_90gun",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Paketlenen (90g)" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm text-muted-foreground">
          {formatNumber(row.original.paketlenen_90gun)}
        </span>
      ),
      meta: { className: "hidden lg:table-cell" },
      size: 120,
    },
    {
      accessorKey: "gunluk_satis_hizi",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Günlük Satış Hızı" />,
      cell: ({ row }) => (
        <span className="tabular-nums text-sm">
          {row.original.gunluk_satis_hizi > 0 ? formatNumber(row.original.gunluk_satis_hizi) : "—"}
        </span>
      ),
      meta: { className: "hidden md:table-cell" },
      size: 130,
    },
    {
      accessorKey: "tedarik_suresi_gun",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Tedarik Süresi" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <span className="tabular-nums text-sm">{formatNumber(row.original.tedarik_suresi_gun)} gün</span>
          <Badge variant="outline" className="text-[10px] px-1 py-0">
            {row.original.tedarik_suresi_kaynak === "gercek" ? "gerçek" : "varsayılan"}
          </Badge>
        </div>
      ),
      meta: { className: "hidden xl:table-cell" },
      size: 160,
    },
    {
      accessorKey: "durum",
      header: "Durum",
      cell: ({ row }) => <DurumBadge durum={row.original.durum} />,
      size: 100,
    },
  ];
}

export function KritikStokClient({ data, canEdit, initialSariEsik }: KritikStokClientProps) {
  const [search, setSearch] = useState("");
  const [durumFilter, setDurumFilter] = useState<string>("all");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [sira, setSira] = useState<SiraKey>("kritige_yakin");
  const [renk, setRenk] = useState<"all" | Seviye>("all");
  const [sariEsik, setSariEsik] = useState(initialSariEsik);
  const [esikInput, setEsikInput] = useState(String(initialSariEsik));
  const [, startSave] = useTransition();
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyEsik = (raw: number) => {
    const n = Number.isFinite(raw) ? Math.max(0, Math.min(100000, Math.round(raw))) : 0;
    setSariEsik(n);
    setEsikInput(String(n));
    if (!canEdit) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      startSave(async () => {
        const r = await saveKritikStokUyari(n);
        if (!r.success) toast.error(r.error);
      });
    }, 600);
  };

  const filtered = useMemo(() => {
    const q = trNorm(search.trim());
    const list = data.filter((row) => {
      if (durumFilter !== "all" && row.durum !== durumFilter) return false;
      if (renk !== "all" && seviyeOf(row, sariEsik) !== renk) return false;
      if (q && !trNorm(row.sku).includes(q) && !trNorm(row.urun_adi).includes(q)) return false;
      return true;
    });
    const cmpSku = (a: KritikStokOneri, b: KritikStokOneri) => a.sku.localeCompare(b.sku);
    if (sira === "kritige_yakin") list.sort((a, b) => marj(a) - marj(b) || cmpSku(a, b));
    else if (sira === "en_cok_stok") list.sort((a, b) => b.stok_toplam - a.stok_toplam || cmpSku(a, b));
    else if (sira === "en_az_stok") list.sort((a, b) => a.stok_toplam - b.stok_toplam || cmpSku(a, b));
    else list.sort(cmpSku);
    return list;
  }, [data, search, durumFilter, renk, sariEsik, sira]);

  const renkSayilari = useMemo(() => {
    const c = { all: data.length, kirmizi: 0, sari: 0, normal: 0 };
    for (const r of data) c[seviyeOf(r, sariEsik)]++;
    return c;
  }, [data, sariEsik]);

  const kritikSayisi = useMemo(() => data.filter((r) => r.durum === "kritik").length, [data]);
  const dusukSayisi = useMemo(() => data.filter((r) => r.durum === "dusuk").length, [data]);

  const columns = useMemo(() => getColumns(canEdit), [canEdit]);

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.sku,
  });

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Kritik Stok Yönetimi</h1>
        <p className="text-sm text-muted-foreground">
          Aktif ürünler için önerilen kritik stok seviyeleri ve mevcut ayarlar
        </p>
      </div>

      {/* KPI özet */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground sm:text-sm">Toplam Ürün</p>
            <p className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{formatNumber(data.length)}</p>
          </CardContent>
        </Card>
        <Card className="border-vw-error/30 bg-vw-error/5">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-vw-error sm:text-sm">Kritik</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-vw-error sm:text-2xl">
              {formatNumber(kritikSayisi)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-vw-warning/30 bg-vw-warning/5">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-vw-warning sm:text-sm">Düşük</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-vw-warning sm:text-2xl">
              {formatNumber(dusukSayisi)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-vw-success/30 bg-vw-success/5">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-vw-success sm:text-sm">Sağlıklı</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-vw-success sm:text-2xl">
              {formatNumber(data.length - kritikSayisi - dusukSayisi)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Açıklama kartı */}
      <Card className="border-vw-info/30 bg-vw-info/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-vw-info">
            <Info className="h-4 w-4" />
            Önerilen Değer Nasıl Hesaplanıyor?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Sistem her ürün için üç bilgiyi birleştirerek bir <b>&quot;önerilen kritik stok&quot;</b> değeri
            hesaplar. Bu, &quot;bu üründen elde en az kaç tane bulunmalı ki bir sonraki üretim/paketleme
            partisi tamamlanana kadar stok tükenmesin&quot; sorusuna verilen cevaptır:
          </p>
          <ol className="ml-4 list-decimal space-y-1">
            <li>
              <b>Günlük Satış Hızı</b> — Son 7, 30 ve 90 günün satışlarının ağırlıklı ortalaması
              alınır (yakın güne %20, son aya %50, son 3 aya %30 ağırlık verilir). Böylece tek
              günlük anormal bir satış, öneriyi yanıltmaz.
            </li>
            <li>
              <b>Tedarik Süresi</b> — Ürünün son 90 günde <i>gerçekte</i> kaç günde bir paketlendiği
              hesaplanır (paketleme kayıtlarından). Örneğin bir ürün ortalama 20 günde bir
              paketleniyorsa, tedarik süresi ~20 gün kabul edilir. Yeterli paketleme geçmişi
              olmayan ürünlerde, Ayarlar&apos;daki varsayılan tampon gün sayısı kullanılır.
            </li>
            <li>
              <b>Güvenlik Payı</b> — Talep dalgalanmalarına karşı hesaplanan değer %30 artırılır.
            </li>
          </ol>
          <p className="rounded-md bg-background/60 px-3 py-2 font-mono text-xs">
            Önerilen Kritik Stok = YUKARI YUVARLA(Günlük Satış Hızı × Tedarik Süresi (gün) × 1.3)
          </p>
          <p className="flex items-start gap-1.5">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-vw-warning" />
            Bu öneri bir referans değerdir; mevsimsellik, kampanya veya özel siparişler gibi
            durumları hesaba katmaz. &quot;Mevcut Kritik Stok&quot; sütunundaki kalem düzenlenebilir —
            öneriyi kabul etmek zorunlu değildir.
          </p>
        </CardContent>
      </Card>

      {/* Filtreler */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="SKU veya ürün adı ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={durumFilter} onValueChange={setDurumFilter}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue placeholder="Tüm Durumlar" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            <SelectItem value="kritik">Kritik</SelectItem>
            <SelectItem value="dusuk">Düşük</SelectItem>
            <SelectItem value="saglikli">Sağlıklı</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={sira}
          onValueChange={(v) => {
            setSira(v as SiraKey);
            setSorting([]);
          }}
        >
          <SelectTrigger className="w-full sm:w-[220px]">
            <SelectValue placeholder="Sıralama" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(SIRA_LABEL) as SiraKey[]).map((k) => (
              <SelectItem key={k} value={k}>
                {SIRA_LABEL[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Renk uyarısı: hızlı filtreler + sarı eşik */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Tümü", "border-border bg-background"],
              ["kirmizi", "Kırmızı (kritik altı)", "border-[#ee7683] bg-[#ee7683]/15"],
              ["sari", "Sarı (yaklaşan)", "border-[#f28a19] bg-[#f28a19]/15"],
              ["normal", "Normal", "border-border bg-background"],
            ] as const
          ).map(([k, label, cls]) => (
            <button
              key={k}
              type="button"
              onClick={() => setRenk(k)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition",
                cls,
                renk === k ? "ring-2 ring-vw-deep" : "opacity-80 hover:opacity-100"
              )}
            >
              {label} ({formatNumber(renkSayilari[k])})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="sari-esik" className="text-xs font-medium text-muted-foreground">
            Sarı uyarı eşiği (adet)
          </label>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => applyEsik(sariEsik - 10)}
              disabled={!canEdit || sariEsik <= 0}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Input
              id="sari-esik"
              type="number"
              min={0}
              step={1}
              value={esikInput}
              disabled={!canEdit}
              onChange={(e) => setEsikInput(e.target.value)}
              onBlur={() => applyEsik(Number(esikInput))}
              onKeyDown={(e) => e.key === "Enter" && applyEsik(Number(esikInput))}
              className="h-8 w-20 px-2 text-center font-mono text-sm"
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => applyEsik(sariEsik + 10)}
              disabled={!canEdit}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <DataTable
        table={table}
        emptyMessage="Ürün bulunamadı."
        rowClassName={(r) => ROW_CLASS[seviyeOf(r, sariEsik)]}
      />
    </div>
  );
}
