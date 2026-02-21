"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FIRMA_TIPI_LABELS, type FirmaTipi } from "@/lib/constants";
import { FirmaEditSheet } from "./firma-edit-sheet";
import { deleteFirma } from "../actions";
import type { SevkiyatFirmaRow } from "@/app/(dashboard)/sevkiyat/actions";
import { Building2, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

interface FirmalarClientProps {
  firmalar: SevkiyatFirmaRow[];
}

export function FirmalarClient({ firmalar }: FirmalarClientProps) {
  const [editItem, setEditItem] = useState<SevkiyatFirmaRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [search, setSearch] = useState("");
  const [filterTip, setFilterTip] = useState<string>("all");

  const filtered = firmalar.filter((f) => {
    if (filterTip !== "all" && f.firma_tipi !== filterTip) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        f.profil_adi.toLowerCase().includes(s) ||
        (f.firma_adi ?? "").toLowerCase().includes(s) ||
        (f.country_code ?? "").toLowerCase().includes(s)
      );
    }
    return true;
  });

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`"${name}" silinecek. Emin misiniz?`)) return;
    const result = await deleteFirma(id);
    if (result.success) toast.success("Silindi");
    else toast.error(result.error);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Building2 className="w-5 h-5" />
          Firma Profilleri
        </h2>
        <Button
          size="sm"
          onClick={() => {
            setEditItem(null);
            setIsNew(true);
          }}
        >
          <Plus className="w-4 h-4 mr-1" />
          Yeni Firma
        </Button>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <div className="flex gap-1">
          <Button
            variant={filterTip === "all" ? "default" : "outline"}
            size="sm"
            className="h-9 text-xs"
            onClick={() => setFilterTip("all")}
          >
            Tümü
          </Button>
          {(Object.entries(FIRMA_TIPI_LABELS) as [FirmaTipi, string][]).map(([key, label]) => (
            <Button
              key={key}
              variant={filterTip === key ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs"
              onClick={() => setFilterTip(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((firma) => (
          <Card key={firma.id} className="p-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{firma.profil_adi}</p>
                {firma.firma_adi && (
                  <p className="text-xs text-muted-foreground truncate">{firma.firma_adi}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => {
                    setEditItem(firma);
                    setIsNew(false);
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(firma.id, firma.profil_adi)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="text-[10px]">
                {FIRMA_TIPI_LABELS[firma.firma_tipi as FirmaTipi] ?? firma.firma_tipi}
              </Badge>
              {firma.country_code && (
                <Badge variant="outline" className="text-[10px]">{firma.country_code}</Badge>
              )}
              {firma.varsayilan && (
                <Badge className="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-300">Varsayılan</Badge>
              )}
              {!firma.aktif && (
                <Badge variant="destructive" className="text-[10px]">Pasif</Badge>
              )}
            </div>
            {(firma.telefon || firma.email) && (
              <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                {firma.telefon && <p>{firma.telefon}</p>}
                {firma.email && <p>{firma.email}</p>}
              </div>
            )}
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Firma bulunamadı
        </div>
      )}

      <FirmaEditSheet
        firma={editItem}
        isNew={isNew}
        open={isNew || editItem !== null}
        onClose={() => {
          setEditItem(null);
          setIsNew(false);
        }}
      />
    </div>
  );
}
