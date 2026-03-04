"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { karMarjiRenk } from "@/lib/pricingCalculator";
import type { PricingSnapshot, Marketplace } from "@/types/pricing";

interface Props {
  donemKodu: string;
  data: {
    snapshots: PricingSnapshot[];
    marketplaces: Marketplace[];
    currentListings: Record<string, any>;
  };
}

function DiffBadge({ current, snapshot, isPercent = false }: { current: number; snapshot: number; isPercent?: boolean }) {
  if (current === 0 && snapshot === 0) return <Minus className="h-3 w-3 text-muted-foreground" />;

  const diff = current - snapshot;
  if (Math.abs(diff) < 0.001) return <Minus className="h-3 w-3 text-muted-foreground" />;

  const isPositive = diff > 0;
  const display = isPercent
    ? `${isPositive ? "+" : ""}${(diff * 100).toFixed(1)}pp`
    : `${isPositive ? "+" : ""}₺${diff.toFixed(2)}`;

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
      {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {display}
    </span>
  );
}

export function GecmisDetailClient({ donemKodu, data }: Props) {
  const { snapshots, marketplaces, currentListings } = data;
  const [selectedMpId, setSelectedMpId] = useState<string>(marketplaces[0]?.id ?? "");
  const [search, setSearch] = useState("");

  const filteredSnapshots = useMemo(() => {
    let result = snapshots.filter((s) => s.marketplace_id === selectedMpId);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.sku?.toLowerCase().includes(q) ||
          s.listing_kodu?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [snapshots, selectedMpId, search]);

  const selectedMp = marketplaces.find((m) => m.id === selectedMpId);

  // Summary stats
  const avgMarj = filteredSnapshots.length > 0
    ? filteredSnapshots.reduce((s, r) => s + (Number(r.kar_marji) || 0), 0) / filteredSnapshots.length
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/pazaryeri/fiyatlama/gecmis">
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-vw-dark">
            Dönem: {donemKodu}
          </h1>
          <p className="text-sm text-muted-foreground">
            {snapshots.length} kayıt, {marketplaces.length} pazaryeri
          </p>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Bu döneme ait snapshot verisi bulunamadı.
        </div>
      ) : (
        <>
          {/* Marketplace tabs */}
          <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1">
            {marketplaces.map((mp) => {
              const count = snapshots.filter((s) => s.marketplace_id === mp.id).length;
              return (
                <button
                  key={mp.id}
                  onClick={() => setSelectedMpId(mp.id)}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
                    selectedMpId === mp.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {mp.name}
                  <span className={`text-xs ${selectedMpId === mp.id ? "text-primary-foreground/70" : "text-muted-foreground/60"}`}>
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>

          {/* Summary bar */}
          <div className="flex items-center gap-4 rounded-lg border bg-card px-4 py-2">
            <span className="text-sm text-muted-foreground">
              {selectedMp?.name}: <strong>{filteredSnapshots.length}</strong> listing
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-semibold ${karMarjiRenk(avgMarj)}`}>
              Ort. Marj: %{(avgMarj * 100).toFixed(1)}
            </span>
          </div>

          {/* Search */}
          <Input
            placeholder="SKU veya listing kodu ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm h-8 text-sm"
          />

          {/* Snapshot Table */}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-left">
              <thead className="bg-muted/50">
                <tr>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Listing Kodu</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">SKU</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Satış ₺ (Snapshot)</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Satış ₺ (Mevcut)</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Fark</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Komisyon %</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Kargo ₺</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Ham Fiyat ₺</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Kar Marjı % (Snapshot)</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Kar Marjı % (Mevcut)</th>
                  <th className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-muted-foreground">Hedef ₺</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredSnapshots.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Kayıt bulunamadı.
                    </td>
                  </tr>
                ) : (
                  filteredSnapshots.map((snap) => {
                    const current = currentListings[`${snap.marketplace_id}:${snap.sku}`];
                    const currentSatis = current ? Number(current.satis_fiyati) : null;
                    const currentMarj = current ? Number(current.kar_marji) : null;
                    const snapSatis = Number(snap.satis_fiyati) || 0;
                    const snapMarj = Number(snap.kar_marji) || 0;

                    return (
                      <tr key={snap.id} className="hover:bg-muted/30 transition-colors">
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs font-mono">{snap.listing_kodu}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs font-mono">{snap.sku}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs">₺{snapSatis.toFixed(2)}</td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                          {currentSatis != null ? `₺${currentSatis.toFixed(2)}` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          {currentSatis != null ? (
                            <DiffBadge current={currentSatis} snapshot={snapSatis} />
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                          %{((Number(snap.komisyon_orani) || 0) * 100).toFixed(1)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs">
                          ₺{(Number(snap.kargo_maliyeti) || 0).toFixed(2)}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs font-semibold">
                          <span className={(Number(snap.ham_fiyat) || 0) >= 0 ? "text-green-700" : "text-red-700"}>
                            ₺{(Number(snap.ham_fiyat) || 0).toFixed(2)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${karMarjiRenk(snapMarj)}`}>
                            %{(snapMarj * 100).toFixed(1)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5">
                          {currentMarj != null ? (
                            <div className="flex items-center gap-1">
                              <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${karMarjiRenk(currentMarj)}`}>
                                %{(currentMarj * 100).toFixed(1)}
                              </span>
                              <DiffBadge current={currentMarj} snapshot={snapMarj} isPercent />
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-1.5 text-xs text-muted-foreground">
                          {Number(snap.hedef_fiyat) > 0 ? `₺${Number(snap.hedef_fiyat).toFixed(2)}` : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
