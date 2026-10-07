"use client";

import { Pencil, Plus, Trash2, Unlink, Link2, PackagePlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { HighlightText, TreeRow } from "@/components/admin-tree";
import { PART_TYPE_LABELS } from "@/lib/constants";
import type { ListeProduct } from "./tree-filters";
import type { TreePart, TreePlaka, TreePlakaPart } from "./tree-types";
import { MAKINELER } from "./tree-types";

export interface ListeHandlers {
  isOpen: (key: string) => boolean;
  toggle: (key: string) => void;
  onAddPlaka: (sku: string) => void;
  onEditPlaka: (p: TreePlaka) => void;
  onDeletePlaka: (p: TreePlaka) => void;
  onNewPart: (sku: string, plaka: TreePlaka) => void;
  onLinkPart: (sku: string, plaka: TreePlaka) => void;
  onEditPart: (part: TreePart, pp: TreePlakaPart) => void;
  onRemovePart: (pp: TreePlakaPart, part: TreePart | undefined) => void;
}

function IconBtn({
  title,
  onClick,
  children,
  destructive,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={`h-8 gap-1 px-2 ${destructive ? "text-destructive hover:text-destructive" : ""}`}
    >
      {children}
    </Button>
  );
}

export function ListeTree({
  items,
  q,
  h,
}: {
  items: ListeProduct[];
  q: string;
  h: ListeHandlers;
}) {
  if (items.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Kayıt bulunamadı.</p>;
  }
  return (
    <div className="space-y-1.5">
      {items.map((it) => {
        const pKey = `p:${it.sku}`;
        const open = h.isOpen(pKey);
        return (
          <div key={it.sku} className="space-y-1">
            <TreeRow
              level={0}
              hasChildren={it.plates.length > 0}
              expanded={open}
              onToggle={() => h.toggle(pKey)}
              highlighted={it.productMatch}
              actions={
                <IconBtn title="Bu ürüne plaka ekle" onClick={() => h.onAddPlaka(it.sku)}>
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Plaka ekle</span>
                </IconBtn>
              }
            >
              <span className="font-mono text-sm font-semibold">
                <HighlightText text={it.sku} query={q} />
              </span>
              <span className="min-w-0 truncate text-sm">
                <HighlightText text={it.product?.urun_adi ?? "—"} query={q} />
              </span>
              {it.product && !it.product.aktif_mi && (
                <Badge variant="outline" className="text-[10px]">
                  Pasif
                </Badge>
              )}
              <Badge variant="secondary" className="text-[11px]">
                {it.plateCount} plaka
              </Badge>
              <Badge variant="secondary" className="text-[11px]">
                {it.partCount} parça
              </Badge>
              {it.plateCount === 0 && <span className="text-xs text-muted-foreground">Plakası yok</span>}
            </TreeRow>

            {open &&
              it.plates.map((pl) => {
                const plKey = `pl:${it.sku}:${pl.plaka.plaka_id}`;
                const plOpen = h.isOpen(plKey);
                const ks = pl.plaka.kesim_sureleri ?? {};
                return (
                  <div key={plKey} className="space-y-1">
                    <TreeRow
                      level={1}
                      hasChildren={pl.parts.length > 0}
                      expanded={plOpen}
                      onToggle={() => h.toggle(plKey)}
                      highlighted={pl.plateMatch}
                      actions={
                        <>
                          <IconBtn title="Yeni parça (otomatik kod)" onClick={() => h.onNewPart(it.sku, pl.plaka)}>
                            <PackagePlus className="h-4 w-4" />
                            <span className="hidden md:inline">Yeni parça</span>
                          </IconBtn>
                          <IconBtn title="Mevcut parçayı ekle" onClick={() => h.onLinkPart(it.sku, pl.plaka)}>
                            <Link2 className="h-4 w-4" />
                            <span className="hidden md:inline">Mevcut ekle</span>
                          </IconBtn>
                          <IconBtn title="Plakayı düzenle" onClick={() => h.onEditPlaka(pl.plaka)}>
                            <Pencil className="h-4 w-4" />
                          </IconBtn>
                          <IconBtn title="Plakayı sil" destructive onClick={() => h.onDeletePlaka(pl.plaka)}>
                            <Trash2 className="h-4 w-4" />
                          </IconBtn>
                        </>
                      }
                    >
                      <span className="font-mono text-xs font-semibold">
                        <HighlightText text={pl.plaka.plaka_id} query={q} />
                      </span>
                      <span className="min-w-0 truncate text-sm">
                        <HighlightText text={pl.plaka.plaka_adi} query={q} />
                      </span>
                      {pl.plaka.tipi && (
                        <Badge variant="outline" className="text-[11px]">
                          {pl.plaka.tipi}
                        </Badge>
                      )}
                      {pl.plaka.renk && (
                        <Badge variant="outline" className="text-[11px]">
                          {pl.plaka.renk}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {MAKINELER.filter((m) => (ks[m] ?? 0) > 0)
                          .map((m) => `${m}: ${ks[m]} dk`)
                          .join(" · ") || "süre yok"}
                      </span>
                      {pl.plaka.sku.length > 1 && (
                        <span className="text-[11px] text-muted-foreground">
                          (ortak: {pl.plaka.sku.filter((s) => s !== it.sku).join(", ")})
                        </span>
                      )}
                      <Badge variant="secondary" className="text-[11px]">
                        {pl.parts.length} parça
                      </Badge>
                    </TreeRow>

                    {plOpen &&
                      pl.parts.map(({ pp, part, match }) => (
                        <TreeRow
                          key={pp.ppart_id}
                          level={2}
                          highlighted={match}
                          actions={
                            <>
                              {part && (
                                <IconBtn title="Düzenle" onClick={() => h.onEditPart(part, pp)}>
                                  <Pencil className="h-4 w-4" />
                                  <span className="hidden md:inline">Düzenle</span>
                                </IconBtn>
                              )}
                              <IconBtn title="Plakadan kaldır" destructive onClick={() => h.onRemovePart(pp, part)}>
                                <Unlink className="h-4 w-4" />
                                <span className="hidden md:inline">Kaldır</span>
                              </IconBtn>
                            </>
                          }
                        >
                          <span className="font-mono text-xs">
                            <HighlightText text={pp.part_id} query={q} />
                          </span>
                          <span className="min-w-0 truncate">
                            <HighlightText text={part?.part_adi ?? "—"} query={q} />
                          </span>
                          {part && (
                            <Badge variant="outline" className="text-[11px]">
                              {PART_TYPE_LABELS[part.part_type] ?? part.part_type}
                            </Badge>
                          )}
                          <span className="font-mono text-xs text-muted-foreground">
                            adet: {pp.default_qty ?? "—"}
                          </span>
                        </TreeRow>
                      ))}
                  </div>
                );
              })}
          </div>
        );
      })}
    </div>
  );
}
