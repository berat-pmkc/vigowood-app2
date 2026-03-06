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
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import { Save, Download, Loader2, Plus, Megaphone, Pencil, Truck } from "lucide-react";
import type { Marketplace, ShippingProvider } from "@/types/pricing";
import {
  getListingsForMarketplace,
  updateListings,

  createListing,
  deactivateListing,
  bulkUpdateReklamOrani,
  updateMarketplaceStopaj,
} from "../../actions";
import { MarketplaceTabs } from "./marketplace-tabs";
import { PricingSummaryCards } from "./pricing-summary-cards";
import { PricingTable, type PricingRow } from "./pricing-table";

const KDV_ORANI = 0.10; // System-wide default

interface Props {
  marketplaces: Marketplace[];
  allProducts: Array<{ sku: string; urun_adi: string | null }>;
}

export function PricingPanelClient({ marketplaces, allProducts }: Props) {
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
  const [addListingOpen, setAddListingOpen] = useState(false);
  const [newListingSku, setNewListingSku] = useState("");
  const [newListingKodu, setNewListingKodu] = useState("");
  const [newListingBarkod, setNewListingBarkod] = useState("");
  const [bulkReklamOpen, setBulkReklamOpen] = useState(false);
  const [bulkReklamValue, setBulkReklamValue] = useState("");
  const [stopajEditOpen, setStopajEditOpen] = useState(false);
  const [stopajValue, setStopajValue] = useState("");
  const [deactivateConfirmId, setDeactivateConfirmId] = useState<string | null>(null);
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
          oneri_fiyat: r.oneri_fiyat,
          kargo_maliyeti: r.kargo_maliyeti,
          hedef_fiyat_kullanilan: r.hedef_fiyat,
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

  // Add listing handler
  const handleAddListing = async () => {
    if (!marketplace || !newListingSku || !newListingKodu) return;

    startTransition(async () => {
      const product = allProducts.find(p => p.sku === newListingSku);
      const result = await createListing({
        marketplace_id: marketplace.id,
        sku: newListingSku,
        listing_kodu: newListingKodu,
        barkod: newListingBarkod || undefined,
        urun_adi: product?.urun_adi || undefined,
      });

      if (result.success) {
        toast.success("Listing eklendi");
        setAddListingOpen(false);
        setNewListingSku("");
        setNewListingKodu("");
        setNewListingBarkod("");
        loadListings(selectedCode!);
      } else {
        toast.error(result.error);
      }
    });
  };

  // Deactivate listing handler
  const handleDeactivate = async (id: string) => {
    setDeactivateConfirmId(id);
  };

  const confirmDeactivate = async () => {
    if (!deactivateConfirmId) return;
    startTransition(async () => {
      const result = await deactivateListing(deactivateConfirmId);
      if (result.success) {
        toast.success("Listing listeden kaldırıldı");
        setDeactivateConfirmId(null);
        loadListings(selectedCode!);
      } else {
        toast.error(result.error);
      }
    });
  };

  // Bulk reklam handler
  const handleBulkReklam = async () => {
    if (!marketplace) return;
    const oran = parseFloat(bulkReklamValue);
    if (isNaN(oran) || oran < 0 || oran > 100) {
      toast.error("Geçerli bir yüzde girin (0-100)");
      return;
    }

    startTransition(async () => {
      const result = await bulkUpdateReklamOrani(marketplace.id, oran / 100);
      if (result.success) {
        toast.success(`Tüm ürünlere %${oran} reklam oranı uygulandı`);
        setBulkReklamOpen(false);
        setBulkReklamValue("");
        loadListings(selectedCode!);
      } else {
        toast.error(result.error);
      }
    });
  };

  // Stopaj update handler
  const handleStopajUpdate = async () => {
    if (!marketplace) return;
    const oran = parseFloat(stopajValue);
    if (isNaN(oran) || oran < 0 || oran > 100) {
      toast.error("Geçerli bir yüzde girin (0-100)");
      return;
    }

    startTransition(async () => {
      const result = await updateMarketplaceStopaj(marketplace.id, oran / 100);
      if (result.success) {
        toast.success(`Stopaj oranı %${oran} olarak güncellendi`);
        setStopajEditOpen(false);
        loadListings(selectedCode!);
      } else {
        toast.error(result.error);
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
      "Listing Kodu", "SKU", "Satış Fiyatı", "Hedef Fiyat",
      "Ham Fiyat", "Komisyon %", "Komisyon ₺", "Kargo ₺",
      "Vergi ₺", "Stopaj ₺", "Reklam %", "Reklam ₺",
      "Kar Marjı %", "Öneri Fiyat",
    ];

    const csvRows = rows.map((r) =>
      [
        r.listing_kodu, r.sku,
        Math.round(r.satis_fiyati).toFixed(0),
        Math.round(r.hedef_fiyat).toFixed(0),
        Math.round(r.ham_fiyat).toFixed(0),
        (r.komisyon_orani * 100).toFixed(1),
        Math.round(r.komisyon_bedeli).toFixed(0),
        Math.round(r.kargo_maliyeti).toFixed(0),
        Math.round(r.vergi_tutari).toFixed(0),
        Math.round(r.stopaj_tutari).toFixed(0),
        (r.reklam_orani * 100).toFixed(1),
        Math.round(r.reklam_bedeli).toFixed(0),
        (r.kar_marji * 100).toFixed(1),
        Math.round(r.oneri_fiyat).toFixed(0),
      ].join("\t")
    );

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

  // SKUs already in this marketplace (for filtering "Ürün Ekle" combobox)
  const existingSkus = new Set(rawListings.map((l: any) => l.sku));

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
          {marketplace && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAddListingOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Ürün Ekle
              </Button>
              <Popover open={bulkReklamOpen} onOpenChange={setBulkReklamOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Megaphone className="mr-1.5 h-3.5 w-3.5" />
                    Toplu Reklam %
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Toplu Reklam Oranı</p>
                    <p className="text-xs text-muted-foreground">
                      Tüm aktif ürünlere uygulanır
                    </p>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="100"
                        placeholder="%"
                        value={bulkReklamValue}
                        onChange={(e) => setBulkReklamValue(e.target.value)}
                        className="h-8"
                      />
                      <Button size="sm" onClick={handleBulkReklam} disabled={isPending}>
                        Uygula
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExcelExport}
            disabled={rows.length === 0}
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Excel
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
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
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {dirtyIds.size === 0
                ? "Değişiklik yok"
                : "Değiştirilen satış fiyatı, komisyon ve reklam oranlarını veritabanına kaydeder."}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      {/* Marketplace Tabs */}
      <MarketplaceTabs
        marketplaces={marketplaces}
        selected={selectedCode}
        onSelect={handleSelectMarketplace}
      />

      {/* Info bar: Kargo + Stopaj */}
      {marketplace && defaultProvider && (
        <div className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Truck className="h-3.5 w-3.5" />
            Kargo: <strong>{defaultProvider.name}</strong>
          </span>
          <span className="text-border">|</span>
          <Popover open={stopajEditOpen} onOpenChange={(open) => {
            setStopajEditOpen(open);
            if (open) setStopajValue(((marketplace.stopaj_orani ?? 0.01) * 100).toFixed(1));
          }}>
            <PopoverTrigger asChild>
              <button className="flex items-center gap-1 hover:text-foreground transition-colors">
                Stopaj: <strong>%{((marketplace.stopaj_orani ?? 0.01) * 100).toFixed(1)}</strong>
                <Pencil className="h-3 w-3" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56" align="start">
              <div className="space-y-2">
                <p className="text-sm font-medium">Stopaj Oranı</p>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={stopajValue}
                    onChange={(e) => setStopajValue(e.target.value)}
                    className="h-8"
                  />
                  <span className="text-sm">%</span>
                  <Button size="sm" onClick={handleStopajUpdate} disabled={isPending}>
                    Kaydet
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

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
            stopajOrani={marketplace?.stopaj_orani ?? 0.01}
            onDirtyChange={setDirtyIds}
            onRowsChange={setRows}
            onDeactivate={handleDeactivate}
          />
        </>
      )}

      {!loading && selectedCode && rawListings.length === 0 && marketplace && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">
            <strong>{marketplace.name}</strong> pazaryerinde aktif listing bulunamadı.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            &quot;Ürün Ekle&quot; butonu ile listing ekleyin.
          </p>
          <Button
            className="mt-3"
            size="sm"
            onClick={() => setAddListingOpen(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Ürün Ekle
          </Button>
        </div>
      )}

      {!selectedCode && (
        <div className="rounded-lg border bg-card p-8 text-center">
          <p className="text-muted-foreground">Başlamak için bir pazaryeri seçin.</p>
        </div>
      )}

      {/* Add Listing Dialog */}
      <Dialog open={addListingOpen} onOpenChange={setAddListingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ürün Ekle — {marketplace?.name}</DialogTitle>
            <DialogDescription>
              Bu pazaryerine yeni bir listing ekleyin.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <label className="text-sm font-medium">SKU</label>
              <Command className="rounded-lg border mt-1">
                <CommandInput placeholder="SKU ara..." />
                <CommandList className="max-h-40">
                  <CommandEmpty>SKU bulunamadı</CommandEmpty>
                  <CommandGroup>
                    {allProducts
                      .filter(p => !existingSkus.has(p.sku))
                      .map(p => (
                        <CommandItem
                          key={p.sku}
                          value={p.sku}
                          onSelect={() => setNewListingSku(p.sku)}
                          className={newListingSku === p.sku ? "bg-accent" : ""}
                        >
                          <span className="font-mono text-xs">{p.sku}</span>
                          <span className="ml-2 text-xs text-muted-foreground truncate">
                            {p.urun_adi}
                          </span>
                        </CommandItem>
                      ))}
                  </CommandGroup>
                </CommandList>
              </Command>
              {newListingSku && (
                <p className="mt-1 text-xs text-green-600">Seçili: {newListingSku}</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Listing Kodu</label>
              <Input
                placeholder="ör. TRN-001"
                value={newListingKodu}
                onChange={(e) => setNewListingKodu(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Barkod (opsiyonel)</label>
              <Input
                placeholder="Barkod"
                value={newListingBarkod}
                onChange={(e) => setNewListingBarkod(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddListingOpen(false)}>
              İptal
            </Button>
            <Button
              onClick={handleAddListing}
              disabled={!newListingSku || !newListingKodu || isPending}
            >
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm Dialog */}
      <Dialog open={!!deactivateConfirmId} onOpenChange={(open) => !open && setDeactivateConfirmId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Listeden Kaldır</DialogTitle>
            <DialogDescription>
              Bu listing pasife alınacak. Daha sonra geri alınabilir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeactivateConfirmId(null)}>
              İptal
            </Button>
            <Button variant="destructive" onClick={confirmDeactivate} disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Kaldır
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
