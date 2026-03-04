"use client";

import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Crown, Search } from "lucide-react";
import { karMarjiRenk } from "@/lib/pricingCalculator";
import type { Marketplace } from "@/types/pricing";

interface MarketplaceCell {
  satis_fiyati: number;
  ham_fiyat: number;
  kar_marji: number;
  komisyon_orani: number;
  kargo_maliyeti: number;
}

interface SkuRow {
  sku: string;
  urun_adi: string | null;
  byMarketplace: Record<string, MarketplaceCell>;
}

interface Props {
  data: {
    marketplaces: Marketplace[];
    skuRows: SkuRow[];
  };
}

export function KarsilastirmaClient({ data }: Props) {
  const { marketplaces, skuRows } = data;
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return skuRows;
    const q = search.toLowerCase();
    return skuRows.filter(
      (r) =>
        r.sku.toLowerCase().includes(q) ||
        (r.urun_adi?.toLowerCase().includes(q) ?? false)
    );
  }, [skuRows, search]);

  // Summary: per-marketplace average margin
  const mpSummary = useMemo(() => {
    const result: Record<string, { total: number; count: number }> = {};
    for (const mp of marketplaces) {
      result[mp.id] = { total: 0, count: 0 };
    }
    for (const row of skuRows) {
      for (const [mpId, cell] of Object.entries(row.byMarketplace)) {
        if (result[mpId]) {
          result[mpId].total += cell.kar_marji;
          result[mpId].count++;
        }
      }
    }
    return result;
  }, [marketplaces, skuRows]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Pazaryerleri Arası Karşılaştırma</h1>
        <p className="text-sm text-muted-foreground">
          Aynı SKU&apos;nun farklı pazaryerlerindeki satış fiyatı ve kar marjı karşılaştırması.
          En kârlı pazaryeri yeşil ile vurgulanır.
        </p>
      </div>

      {skuRows.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center text-muted-foreground">
          Karşılaştırılacak listing verisi bulunamadı.
        </div>
      ) : (
        <>
          {/* Marketplace summary cards */}
          <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
            {marketplaces.map((mp) => {
              const s = mpSummary[mp.id];
              const avg = s && s.count > 0 ? s.total / s.count : 0;
              return (
                <div key={mp.id} className="rounded-lg border bg-card p-3">
                  <p className="text-sm font-semibold text-vw-dark">{mp.name}</p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{s?.count ?? 0} ürün</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${karMarjiRenk(avg)}`}>
                      %{(avg * 100).toFixed(1)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="SKU veya ürün adı ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 pl-8 text-sm"
              />
            </div>
            <span className="text-xs text-muted-foreground">
              {filtered.length} / {skuRows.length} SKU
            </span>
          </div>

          {/* Comparison Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left">
              <thead className="bg-muted/50">
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/50 whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground min-w-[100px]">
                    SKU
                  </th>
                  {marketplaces.map((mp) => (
                    <th
                      key={mp.id}
                      colSpan={2}
                      className="whitespace-nowrap px-3 py-2 text-center text-xs font-semibold text-muted-foreground border-l"
                    >
                      {mp.name}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-muted/50 px-3 py-1 text-[10px] text-muted-foreground/70">
                    Ürün
                  </th>
                  {marketplaces.map((mp) => (
                    <th key={`${mp.id}-sub`} colSpan={2} className="border-l">
                      <div className="flex">
                        <span className="flex-1 px-2 py-1 text-center text-[10px] text-muted-foreground/70">Satış ₺</span>
                        <span className="flex-1 px-2 py-1 text-center text-[10px] text-muted-foreground/70">Marj %</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={1 + marketplaces.length * 2} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Eşleşen SKU bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filtered.map((row) => {
                    // Find best marketplace (highest kar_marji)
                    let bestMpId: string | null = null;
                    let bestMarj = -Infinity;
                    for (const [mpId, cell] of Object.entries(row.byMarketplace)) {
                      if (cell.kar_marji > bestMarj) {
                        bestMarj = cell.kar_marji;
                        bestMpId = mpId;
                      }
                    }

                    return (
                      <tr key={row.sku} className="hover:bg-muted/30 transition-colors">
                        <td className="sticky left-0 z-10 bg-card whitespace-nowrap px-3 py-1.5">
                          <div className="text-xs font-mono font-medium">{row.sku}</div>
                          {row.urun_adi && (
                            <div className="max-w-[200px] truncate text-[10px] text-muted-foreground">
                              {row.urun_adi}
                            </div>
                          )}
                        </td>
                        {marketplaces.map((mp) => {
                          const cell = row.byMarketplace[mp.id];
                          const isBest = mp.id === bestMpId && Object.keys(row.byMarketplace).length > 1;

                          if (!cell) {
                            return (
                              <td key={mp.id} colSpan={2} className="border-l px-3 py-1.5 text-center text-xs text-muted-foreground/40">
                                —
                              </td>
                            );
                          }

                          return (
                            <td
                              key={mp.id}
                              colSpan={2}
                              className={`border-l transition-colors ${isBest ? "bg-green-50/70" : ""}`}
                            >
                              <div className="flex items-center">
                                <div className="flex-1 px-2 py-1.5 text-center">
                                  <span className="text-xs font-medium">
                                    ₺{cell.satis_fiyati.toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex-1 px-2 py-1.5 text-center">
                                  <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-xs font-semibold ${karMarjiRenk(cell.kar_marji)}`}>
                                    {isBest && <Crown className="h-3 w-3" />}
                                    %{(cell.kar_marji * 100).toFixed(1)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-3 w-3 rounded bg-green-50 border border-green-200" />
              En kârlı pazaryeri
            </span>
            <span className="flex items-center gap-1">
              <Crown className="h-3 w-3 text-green-700" />
              En yüksek marj
            </span>
            <Badge variant="outline" className="text-[10px]">
              {skuRows.filter((r) => Object.keys(r.byMarketplace).length > 1).length} SKU çoklu pazaryerinde
            </Badge>
          </div>
        </>
      )}
    </div>
  );
}
