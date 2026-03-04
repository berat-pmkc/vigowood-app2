"use client";

import { useCallback, useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Edit2, Truck, Plus, Trash2, Store, Loader2 } from "lucide-react";
import {
  updateShippingProvider,
  updateMarketplaceShipping,
  createShippingProvider,
  deleteShippingProvider,
  createMarketplace,
  deleteMarketplace,
} from "../../../fiyatlama/actions";
import type { ShippingProvider, Marketplace, MarketplaceShipping } from "@/types/pricing";

interface Props {
  providers: ShippingProvider[];
  marketplaces: Marketplace[];
  mappings: MarketplaceShipping[];
}

export function KargoClient({ providers, marketplaces, mappings }: Props) {
  const [isPending, startTransition] = useTransition();
  const [editProvider, setEditProvider] = useState<ShippingProvider | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Create shipping provider dialog
  const [createProviderOpen, setCreateProviderOpen] = useState(false);
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderCode, setNewProviderCode] = useState("");

  // Create marketplace dialog
  const [createMpOpen, setCreateMpOpen] = useState(false);
  const [newMpCode, setNewMpCode] = useState("");
  const [newMpName, setNewMpName] = useState("");
  const [newMpVergiDahil, setNewMpVergiDahil] = useState(true);
  const [newMpStopaj, setNewMpStopaj] = useState("1.0");
  const [newMpHedefTipi, setNewMpHedefTipi] = useState<"perakende" | "toptan">("perakende");

  // Desi editor state
  const [formName, setFormName] = useState("");
  const [desiEntries, setDesiEntries] = useState<Array<{ desi: string; fiyat: number }>>([]);

  const openEdit = useCallback((provider: ShippingProvider) => {
    setEditProvider(provider);
    setFormName(provider.name);
    const entries = Object.entries(provider.desi_fiyatlari || {})
      .map(([desi, fiyat]) => ({ desi, fiyat: Number(fiyat) }))
      .sort((a, b) => Number(a.desi) - Number(b.desi));
    setDesiEntries(entries.length > 0 ? entries : [{ desi: "1", fiyat: 0 }]);
    setSheetOpen(true);
  }, []);

  const handleAddDesiRow = useCallback(() => {
    setDesiEntries((prev) => {
      const lastDesi = prev.length > 0 ? Number(prev[prev.length - 1].desi) : 0;
      return [...prev, { desi: String(lastDesi + 1), fiyat: 0 }];
    });
  }, []);

  const handleRemoveDesiRow = useCallback((index: number) => {
    setDesiEntries((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleDesiChange = useCallback((index: number, field: "desi" | "fiyat", value: string) => {
    setDesiEntries((prev) => {
      const next = [...prev];
      if (field === "desi") {
        next[index] = { ...next[index], desi: value };
      } else {
        next[index] = { ...next[index], fiyat: Number(value) || 0 };
      }
      return next;
    });
  }, []);

  const handleSaveProvider = useCallback(() => {
    if (!editProvider) return;

    const desiObj: Record<string, number> = {};
    for (const entry of desiEntries) {
      if (entry.desi && entry.fiyat >= 0) {
        desiObj[entry.desi] = entry.fiyat;
      }
    }

    startTransition(async () => {
      const result = await updateShippingProvider(editProvider.id, {
        name: formName,
        desi_fiyatlari: desiObj,
      });
      if (result.success) {
        toast.success("Kargo firması güncellendi");
        setSheetOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }, [editProvider, formName, desiEntries]);

  const handleCreateProvider = useCallback(() => {
    if (!newProviderName.trim() || !newProviderCode.trim()) {
      toast.error("Ad ve kod gereklidir");
      return;
    }

    startTransition(async () => {
      const result = await createShippingProvider({
        name: newProviderName.trim(),
        code: newProviderCode.trim().toUpperCase(),
        desi_fiyatlari: {},
      });
      if (result.success) {
        toast.success("Kargo firması eklendi. Tüm pazaryerlerine otomatik eşleştirildi.");
        setCreateProviderOpen(false);
        setNewProviderName("");
        setNewProviderCode("");
      } else {
        toast.error(result.error);
      }
    });
  }, [newProviderName, newProviderCode]);

  const handleDeleteProvider = useCallback((id: string, name: string) => {
    if (!confirm(`${name} kargo firmasını silmek istediğinize emin misiniz?`)) return;
    startTransition(async () => {
      const result = await deleteShippingProvider(id);
      if (result.success) {
        toast.success("Kargo firması silindi");
      } else {
        toast.error(result.error);
      }
    });
  }, []);

  const handleCreateMarketplace = useCallback(() => {
    if (!newMpCode.trim() || !newMpName.trim()) {
      toast.error("Kod ve ad gereklidir");
      return;
    }
    const stopaj = parseFloat(newMpStopaj);
    if (isNaN(stopaj) || stopaj < 0 || stopaj > 100) {
      toast.error("Geçerli bir stopaj oranı girin");
      return;
    }

    startTransition(async () => {
      const result = await createMarketplace({
        code: newMpCode.trim().toUpperCase(),
        name: newMpName.trim(),
        vergi_dahil: newMpVergiDahil,
        stopaj_orani: stopaj / 100,
        hedef_fiyat_tipi: newMpHedefTipi,
      });
      if (result.success) {
        toast.success("Pazaryeri eklendi. Tüm kargo firmalarına otomatik eşleştirildi.");
        setCreateMpOpen(false);
        setNewMpCode("");
        setNewMpName("");
        setNewMpStopaj("1.0");
      } else {
        toast.error(result.error);
      }
    });
  }, [newMpCode, newMpName, newMpVergiDahil, newMpStopaj, newMpHedefTipi]);

  const handleDeleteMarketplace = useCallback((id: string, name: string) => {
    if (!confirm(`${name} pazaryerini silmek istediğinize emin misiniz?`)) return;
    startTransition(async () => {
      const result = await deleteMarketplace(id);
      if (result.success) {
        toast.success("Pazaryeri silindi");
      } else {
        toast.error(result.error);
      }
    });
  }, []);

  const handleMappingChange = useCallback((marketplaceId: string, providerId: string) => {
    startTransition(async () => {
      const result = await updateMarketplaceShipping(marketplaceId, providerId);
      if (result.success) {
        toast.success("Kargo eşleştirmesi güncellendi");
      } else {
        toast.error(result.error);
      }
    });
  }, []);

  const getDefaultProvider = useCallback((marketplaceId: string) => {
    const mapping = mappings.find(
      (m) => m.marketplace_id === marketplaceId && m.varsayilan
    );
    return mapping?.shipping_provider_id ?? "";
  }, [mappings]);

  return (
    <div className="space-y-6">
      {/* Kargo Firmaları */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-vw-dark">Kargo Firmaları</h2>
          <Button size="sm" onClick={() => setCreateProviderOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Yeni Kargo Firması
          </Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => {
            const desiCount = Object.keys(provider.desi_fiyatlari || {}).length;
            return (
              <Card key={provider.id} className="relative">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <Truck className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm font-medium">{provider.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(provider)}>
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteProvider(provider.id, provider.name)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-xs">
                      {provider.code}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {desiCount} desi kademesi
                    </span>
                    {!provider.aktif && <Badge variant="secondary">Pasif</Badge>}
                  </div>
                  {desiCount > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {Object.entries(provider.desi_fiyatlari || {})
                        .sort(([a], [b]) => Number(a) - Number(b))
                        .slice(0, 5)
                        .map(([desi, fiyat]) => (
                          <span key={desi} className="text-xs text-muted-foreground">
                            {desi}d:{fiyat}₺
                          </span>
                        ))}
                      {desiCount > 5 && (
                        <span className="text-xs text-muted-foreground">+{desiCount - 5}</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Pazaryeri-Kargo Eşleştirmesi */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-vw-dark">Pazaryeri — Kargo Eşleştirmesi</h2>
          <Button size="sm" onClick={() => setCreateMpOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Yeni Pazaryeri
          </Button>
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pazaryeri</TableHead>
                <TableHead>Kod</TableHead>
                <TableHead>Hedef Tipi</TableHead>
                <TableHead>Stopaj</TableHead>
                <TableHead>Varsayılan Kargo</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {marketplaces.map((mp) => (
                <TableRow key={mp.id}>
                  <TableCell className="font-medium">{mp.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{mp.code}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">
                      {mp.hedef_fiyat_tipi}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    %{((mp.stopaj_orani ?? 0.01) * 100).toFixed(1)}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={getDefaultProvider(mp.id)}
                      onValueChange={(val) => handleMappingChange(mp.id, val)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Kargo seçin" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteMarketplace(mp.id, mp.name)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Edit Desi Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Desi Tablosu Düzenle</SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Firma Adı</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Desi — Fiyat Tablosu</Label>
                <Button variant="outline" size="sm" onClick={handleAddDesiRow}>
                  <Plus className="mr-1 h-3 w-3" />
                  Satır Ekle
                </Button>
              </div>

              <div className="space-y-1">
                <div className="grid grid-cols-[80px_1fr_40px] gap-2 text-xs font-medium text-muted-foreground">
                  <span>Desi</span>
                  <span>Fiyat (₺)</span>
                  <span></span>
                </div>
                {desiEntries.map((entry, i) => (
                  <div key={i} className="grid grid-cols-[80px_1fr_40px] gap-2">
                    <Input
                      type="number"
                      value={entry.desi}
                      onChange={(e) => handleDesiChange(i, "desi", e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Input
                      type="number"
                      value={entry.fiyat}
                      onChange={(e) => handleDesiChange(i, "fiyat", e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveDesiRow(i)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={handleSaveProvider} disabled={isPending} className="w-full">
              {isPending ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Create Shipping Provider Dialog */}
      <Dialog open={createProviderOpen} onOpenChange={setCreateProviderOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Kargo Firması</DialogTitle>
            <DialogDescription>
              Eklendikten sonra tüm pazaryerlerine otomatik eşleştirilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Firma Adı</Label>
              <Input
                placeholder="ör. Aras Kargo"
                value={newProviderName}
                onChange={(e) => setNewProviderName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Kod</Label>
              <Input
                placeholder="ör. ARAS"
                value={newProviderCode}
                onChange={(e) => setNewProviderCode(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateProviderOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateProvider} disabled={isPending || !newProviderName.trim() || !newProviderCode.trim()}>
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Marketplace Dialog */}
      <Dialog open={createMpOpen} onOpenChange={setCreateMpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Pazaryeri</DialogTitle>
            <DialogDescription>
              Eklendikten sonra tüm kargo firmalarına otomatik eşleştirilir.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Pazaryeri Adı</Label>
              <Input
                placeholder="ör. Hepsiburada"
                value={newMpName}
                onChange={(e) => setNewMpName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Kod</Label>
              <Input
                placeholder="ör. HB"
                value={newMpCode}
                onChange={(e) => setNewMpCode(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <Label>Vergi Dahil</Label>
              <Switch checked={newMpVergiDahil} onCheckedChange={setNewMpVergiDahil} />
            </div>
            <div>
              <Label>Stopaj Oranı (%)</Label>
              <Input
                type="number"
                step="0.1"
                value={newMpStopaj}
                onChange={(e) => setNewMpStopaj(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Hedef Fiyat Tipi</Label>
              <Select value={newMpHedefTipi} onValueChange={(v) => setNewMpHedefTipi(v as "perakende" | "toptan")}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="perakende">Perakende</SelectItem>
                  <SelectItem value="toptan">Toptan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateMpOpen(false)}>
              İptal
            </Button>
            <Button onClick={handleCreateMarketplace} disabled={isPending || !newMpCode.trim() || !newMpName.trim()}>
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Ekle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
