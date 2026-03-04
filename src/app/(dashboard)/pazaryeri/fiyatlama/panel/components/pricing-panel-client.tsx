"use client";

import { useState, useCallback, useTransition, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, Download, Camera, Loader2 } from "lucide-react";
import type { Marketplace, ShippingProvider } from "@/types/pricing";
import { getListingsForMarketplace, updateListings, saveSnapshot } from "../../actions";
import { MarketplaceTabs } from "./marketplace-tabs";
import { PricingSummaryCards } from "./pricing-summary-cards";
import { PricingTable, type PricingRow } from "./pricing-table";

const KDV_ORANI = 0.10; // System-wide default

interface Props {
  marketplaces: Marketplace[];
}

export function PricingPanelClient({ marketplaces }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMp = searchParams.get("marketplace") ?? marketplaces[0]?.code ?? null;

  const [selectedCode, setSelectedCode] = useState<string | null>(initialMp);
  const [loading, setLoading] = useState(false);
  const [marketplace, setMarketplace] = useState<Marketplace | null>(null);
  const [rawListings, setRawListings] = useState<any[]>([]);
  const [defaultProvider, setDefaultProvider] = useState<ShippingProvider | null>(null);
  const [rows, setRows] = useState<PricingRow[]>([]);
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [snapshotDonem, setSnapshotDonem] = useState("");
  const tableKeyRef = useRef(0);

  const selectedMp = marketplaces.find((m) => m.code === selectedCode) ?? null;

  const loadListings = useCallback(
    async (code: string) => {
      const mp = marketplaces.find((m) => m.code === code);
      if (!mp) return;

      setLoading(true);
      try {
        const result = await getListingsForMarketplace(mp.id);
        setMarketplace(result.marketplace);
        setRawListings(result.listings);
        setDefaultProvider(result.defaultProvider);
        setDirtyIds(new Set());
        tableKeyRef.current++;
      } catch (e) {
        toast.error("Listingler yüklenemedi: " + (e instanceof Error ? e.message : "Hata"));
      } finally {
        setLoading(false);
      }
    },
    [marketplaces]
  );

  const handleSelectMarketplace = useCallback(
    (code: string) => {
      setSelectedCode(code);
      router.replace(`/pazaryeri/fiyatlama/panel?marketplace=${code}`, { scroll: false });
      loadListings(code);
    },
    [router, loadListings]
  );

  // Auto-load on mount
  useState(() => {
    if (selectedCode) loadListings(selectedCode);
  });

  // Summary calculations
  const summary = {
    toplamUrun: rows.length,
    ortalamaKarMarji:
      rows.length > 0 ? rows.reduce((s, r) => s + r.kar_marji, 0) / rows.length : 0,
    zarardaOlan: rows.filter((r) => r.kar_marji < 0).length,
    hedefUstunde: rows.filter((r) => r.kar_marji > 0).length,
  };

  // Save handler
  const handleSave = () => {
    if (dirtyIds.size === 0) {
      toast.info("Değişiklik yok");
      return;
    }

    startTransition(async () => {
      const updates = rows
        .filter((r) => dirtyIds.has(r.id))
        .map((r) => ({
          id: r.id,
          satis_fiyati: r.satis_fiyati,
          komisyon_orani: r.komisyon_orani,
          reklam_orani: r.reklam_orani,
          ham_fiyat: r.ham_fiyat,
          kar_marji: r.kar_marji,
          oneri_fiyat_min: r.oneri_fiyat_min,
          oneri_fiyat_std: r.oneri_fiyat_std,
          kargo_maliyeti: r.kargo_maliyeti,
          hedef_fiyat_kullanilan: r.hedef_std || r.hedef_min,
        }));

      const result = await updateListings(updates);
      if (result.success) {
        toast.success(`${updates.length} listing güncellendi`);
        setDirtyIds(new Set());
      } else {
        toast.error("Kaydetme hatası: " + result.error);
      }
    });
  };

  // Excel export
  const handleExcelExport = () => {
    if (rows.length === 0) {
      toast.info("Dışa aktarılacak veri yok");
      return;
    }

    const headers = [
      "Listing Kodu",
      "SKU",
      "Satış Fiyatı",
      "Hedef Min",
      "Hedef Std",
      "Ham Fiyat",
      "Komisyon %",
      "Komisyon ₺",
      "Kargo ₺",
      "Vergi ₺",
      "Stopaj ₺",
      "Reklam %",
      "Reklam ₺",
      "Kar Marjı %",
      "Öneri Min",
      "Öneri Std",
    ];

    const csvRows = rows.map((r) =>
      [
        r.listing_kodu,
        r.sku,
        r.satis_fiyati.toFixed(2),
        r.hedef_min.toFixed(2),
        r.hedef_std.toFixed(2),
        r.ham_fiyat.toFixed(2),
        (r.komisyon_orani * 100).toFixed(1),
        r.komisyon_bedeli.toFixed(2),
        r.kargo_maliyeti.toFixed(2),
        r.vergi_tutari.toFixed(2),
        r.stopaj_tutari.toFixed(2),
        (r.reklam_orani * 100).toFixed(1),
        r.reklam_bedeli.toFixed(2),
        (r.kar_marji * 100).toFixed(1),
        r.oneri_fiyat_min.toFixed(2),
        r.oneri_fiyat_std.toFixed(2),
      ].join("\t")
    );

    // BOM for Excel UTF-8
    const bom = "\uFEFF";
    const content = bom + headers.join("\t") + "\n" + csvRows.join("\n");
    const blob = new Blob([content], { type: "text/tab-separated-values;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fiyatlama_${selectedCode}_${new Date().toISOString().slice(0, 10)}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Excel dosyası indirildi");
  };

  // Snapshot handler
  const handleSnapshot = async () => {
    if (!snapshotDonem.trim() || !marketplace) return;

    startTransition(async () => {
      const result = await saveSnapshot(snapshotDonem.trim(), marketplace.id);
      if (result.success) {
        toast.success(`Snapshot kaydedildi: ${snapshotDonem}`);
        setSnapshotOpen(false);
        setSnapshotDonem("");
      } else {
        toast.error("Snapshot hatası: " + result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">Fiyatlama Paneli</h1>
          <p className="text-sm text-muted-foreground">
            Pazaryeri bazlı fiyat düzenle, kar marjı analiz et
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExcelExport}
            disabled={rows.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Excel
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSnapshotDonem(
                new Date().toISOString().slice(0, 7) // YYYY-MM default
              );
              setSnapshotOpen(true);
            }}
            disabled={rows.length === 0}
          >
            <Camera className="mr-1.5 h-3.5 w-3.5" />
            Snapshot
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={dirtyIds.size === 0 || isPending}
          >
            {isPending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            Kaydet ({dirtyIds.size})
          </Button>
        </div>
      </div>

      {/* Marketplace Tabs */}
      <MarketplaceTabs
        marketplaces={marketplaces}
        selected={selectedCode}
        onSelect={handleSelectMarketplace}
      />

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Yükleniyor...</span>
        </div>
      )}

      {/* Content */}
      {!loading && selectedCode && rawListings.length > 0 && (
        <>
          <PricingSummaryCards data={summary} />
          <PricingTable
            key={tableKeyRef.current}
            initialRows={rawListings}
            defaultProvider={defaultProvider}
            kdvOrani={KDV_ORANI}
            onDirtyChange={setDirtyIds}
            onRowsChange={setRows}
          />
        </>
      )}

      {!loading && selectedCode && rawListings.length === 0 && marketplace && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            <strong>{marketplace.name}</strong> pazaryerinde aktif listing bulunamadı.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Önce listing ekleyin veya mevcut listing&apos;leri aktifleştirin.
          </p>
        </div>
      )}

      {!selectedCode && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">Başlamak için bir pazaryeri seçin.</p>
        </div>
      )}

      {/* Snapshot Dialog */}
      <Dialog open={snapshotOpen} onOpenChange={setSnapshotOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fiyat Snapshot&apos;ı Al</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Mevcut fiyatların bir kopyasını kaydedin. Dönem kodu ile sonra karşılaştırabilirsiniz.
            </p>
            <Input
              placeholder="Dönem kodu (ör. 2026-03)"
              value={snapshotDonem}
              onChange={(e) => setSnapshotDonem(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {marketplace?.name} — {rows.length} listing kaydedilecek
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSnapshotOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleSnapshot} disabled={!snapshotDonem.trim() || isPending}>
              {isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
