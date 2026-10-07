"use client";

import { Link2, PackagePlus, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HighlightText, TreeRow } from "@/components/admin-tree";
import { PART_TYPE_LABELS } from "@/lib/constants";
import { UNASSIGNED, type ParcaProduct } from "./tree-filters";
import type { TreePart, TreePlaka } from "./tree-types";

export interface ParcalarHandlers {
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
  onNewPart: (sku: string | null, plateOptions: TreePlaka[]) => void;
  onEditPart: (part: TreePart) => void;
  onDeletePart: (part: TreePart) => void;
  onLinkToPlate: (sku: string | null, plaka: TreePlaka, partId: string) => void;
}

function stokOf(p: TreePart) {
  return p.part_type === "YARIMAMUL" ? p.yari_mamul_stok : p.hazir_eleman_aktif_stok;
}

export function ParcalarTree({
  items,
  q,
  h,
}: {
  items: ParcaProduct[];
  q: string;
  h: ParcalarHandlers;
}) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.map((it) => {
        const unassigned = it.sku === UNASSIGNED;
        const key = `pp:${it.sku}`;
        const open = h.isOpen(key);
        return (
          <div key={it.sku} className="space-y-1">
            <TreeRow
              level={0}
              hasChildren={it.parts.length > 0}
              expanded={open}
              onToggle={() => h.toggle(key)}
              highlighted={it.productMatch}
              actions={
                !unassigned && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2"
                    title="Bu ürüne yeni parça ekle"
                    onClick={() => h.onNewPart(it.sku, it.plateOptions)}
                  >
                    <PackagePlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Parça ekle</span>
                  </Button>
                )
              }
            >
              {unassigned ? (
                <span className="text-sm font-semibold">Ürüne bağlı olmayan yarı mamüller</span>
              ) : (
                <>
                  <span className="font-mono text-sm font-semibold">
                    <HighlightText text={it.sku} query={q} />
                  </span>
                  <span className="min-w-0 truncate text-sm">
                    <HighlightText text={it.product?.urun_adi ?? "—"} query={q} />
                  </span>
                </>
              )}
              <Badge variant="secondary" className="text-[11px]">
                {it.totalParts} parça
              </Badge>
            </TreeRow>

            {open &&
              it.parts.map(({ part, match, links }) => {
                const kritik = part.hazir_eleman_kritik_stok;
                const stok = stokOf(part);
                const low = kritik > 0 && stok < kritik;
                return (
                  <TreeRow
                    key={part.part_id}
                    level={1}
                    highlighted={match}
                    actions={
                      <>
                        {!unassigned && it.plateOptions.length > 0 && (
                          <PlateLinkMenu
                            part={part}
                            sku={it.sku}
                            plates={it.plateOptions.filter((pl) => !links.some((l) => l.plaka.plaka_id === pl.plaka_id))}
                            onPick={h.onLinkToPlate}
                          />
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2"
                          title="Düzenle"
                          onClick={() => h.onEditPart(part)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="hidden md:inline">Düzenle</span>
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                          title="Parçayı sil"
                          onClick={() => h.onDeletePart(part)}
                        >
                          <Trash2 className="h-4 w-4" />
                          <span className="hidden md:inline">Sil</span>
                        </Button>
                      </>
                    }
                  >
                    <span className="font-mono text-xs font-semibold">
                      <HighlightText text={part.part_id} query={q} />
                    </span>
                    <span className="min-w-0 truncate">
                      <HighlightText text={part.part_adi} query={q} />
                    </span>
                    <Badge variant="outline" className="text-[11px]">
                      {PART_TYPE_LABELS[part.part_type] ?? part.part_type}
                    </Badge>
                    {part.tur && <span className="text-xs text-muted-foreground">{part.tur}</span>}
                    {(part.mdf_tipi || part.mdf_renk) && (
                      <span className="text-xs text-muted-foreground">
                        {[part.mdf_tipi, part.mdf_renk].filter(Boolean).join(" / ")}
                      </span>
                    )}
                    <span className={`font-mono text-xs ${low ? "font-semibold text-vw-error" : "text-muted-foreground"}`}>
                      stok: {stok}
                      {kritik > 0 ? ` / kritik: ${kritik}` : ""}
                    </span>
                    <span className="flex flex-wrap gap-1">
                      {links.length === 0 ? (
                        <span className="text-[11px] text-muted-foreground">plakası yok</span>
                      ) : (
                        links.map((l) => (
                          <Badge key={l.pp.ppart_id} variant="secondary" className="font-mono text-[10px]">
                            {l.plaka.plaka_id} × {l.pp.default_qty ?? "—"}
                          </Badge>
                        ))
                      )}
                    </span>
                  </TreeRow>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}

/** Parçayı ürünün başka bir plakasına bağlamak için küçük menü (native select: tablette rahat). */
function PlateLinkMenu({
  part,
  sku,
  plates,
  onPick,
}: {
  part: TreePart;
  sku: string;
  plates: TreePlaka[];
  onPick: (sku: string | null, plaka: TreePlaka, partId: string) => void;
}) {
  if (plates.length === 0) return null;
  return (
    <label className="relative inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm hover:bg-accent" title="Plakaya bağla">
      <Link2 className="h-4 w-4" />
      <span className="hidden md:inline">Plakaya bağla</span>
      <select
        aria-label="Plakaya bağla"
        className="absolute inset-0 cursor-pointer opacity-0"
        value=""
        onChange={(e) => {
          const pl = plates.find((p) => p.plaka_id === e.target.value);
          if (pl) onPick(sku, pl, part.part_id);
        }}
      >
        <option value="">Plaka seçin...</option>
        {plates.map((p) => (
          <option key={p.plaka_id} value={p.plaka_id}>
            {p.plaka_id} — {p.plaka_adi}
          </option>
        ))}
      </select>
    </label>
  );
}
