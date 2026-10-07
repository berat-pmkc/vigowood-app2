"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { List, Puzzle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUrlFilters } from "@/components/admin-tree";
import type { Database } from "@/lib/supabase/types";
import { deletePlaka, deletePlakaPart, deletePartEverywhere } from "../actions";
import { PlakaEditSheet } from "./plaka-edit-sheet";
import { PartDialog, type PartDialogState } from "./part-dialog";
import { PlakalarToolbar } from "./plakalar-toolbar";
import { ListeTree, type ListeHandlers } from "./liste-tree";
import { ParcalarTree, type ParcalarHandlers } from "./parcalar-tree";
import {
  buildIndex,
  computeListe,
  computeParcalar,
  type Filters,
} from "./tree-filters";
import type { TreeData, TreePlaka } from "./tree-types";

type PlakaRow = Database["public"]["Tables"]["plakalar"]["Row"];

interface ConfirmState {
  title: string;
  description: string;
  actionLabel: string;
  run: () => Promise<{ success: boolean; error?: string }>;
  okMessage: string;
}

export function PlakalarTreeClient({ data }: { data: TreeData }) {
  const router = useRouter();
  const url = useUrlFilters();
  const view: "liste" | "parcalar" = url.get("view") === "parcalar" ? "parcalar" : "liste";

  const qParam = url.get("q");
  const skuParam = url.get("sku");
  const tipParam = url.get("tip");
  const mdfParam = url.get("mdf");
  const renkParam = url.get("renk");
  const makParam = url.get("mak");
  const plakasizParam = url.get("plakasiz");
  const filters: Filters = useMemo(
    () => ({
      q: qParam,
      sku: skuParam,
      tip: tipParam,
      mdf: mdfParam,
      renk: renkParam,
      mak: makParam,
      plakasiz: plakasizParam === "1",
    }),
    [qParam, skuParam, tipParam, mdfParam, renkParam, makParam, plakasizParam]
  );

  const idx = useMemo(() => buildIndex(data), [data]);
  const liste = useMemo(() => computeListe(data, idx, filters), [data, idx, filters]);
  const parcalar = useMemo(() => computeParcalar(data, idx, filters), [data, idx, filters]);

  // ── Genişlet/daralt ──
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isOpen = useCallback((k: string) => expanded.has(k), [expanded]);
  const toggle = useCallback((k: string) => {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }, []);

  const visibleKeys = useCallback((): string[] => {
    if (view === "liste") {
      return liste.flatMap((p) => [`p:${p.sku}`, ...p.plates.map((pl) => `pl:${p.sku}:${pl.plaka.plaka_id}`)]);
    }
    return parcalar.map((p) => `pp:${p.sku}`);
  }, [view, liste, parcalar]);

  const expandAll = useCallback(() => setExpanded(new Set(visibleKeys())), [visibleKeys]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  // Arama/parça filtresi aktifken eşleşmeleri görebilmek için otomatik aç
  const autoOpenSig = `${view}|${qParam}|${tipParam}|${mdfParam}|${renkParam}|${makParam}|${skuParam}`;
  useEffect(() => {
    if (qParam || tipParam || mdfParam || renkParam || makParam) {
      setExpanded(new Set(visibleKeys()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenSig]);

  // ── Seçenekler ──
  const skuOptions = useMemo(() => {
    const set = new Set<string>(idx.platesBySku.keys());
    if (filters.plakasiz) for (const p of data.products) set.add(p.sku);
    return [...set].sort().map((sku) => ({
      sku,
      label: `${sku}${idx.productMap.get(sku)?.urun_adi ? ` — ${idx.productMap.get(sku)?.urun_adi}` : ""}`,
    }));
  }, [idx, data.products, filters.plakasiz]);

  const mdfOptions = useMemo(
    () => [...new Set(data.plakalar.map((p) => p.tipi).filter((x): x is string => !!x))].sort(),
    [data.plakalar]
  );
  const renkOptions = useMemo(
    () => [...new Set(data.plakalar.map((p) => p.renk).filter((x): x is string => !!x))].sort(),
    [data.plakalar]
  );
  const partMdfOptions = useMemo(
    () => [...new Set([...mdfOptions, ...data.parts.map((p) => p.mdf_tipi).filter((x): x is string => !!x)])].sort(),
    [mdfOptions, data.parts]
  );
  const partRenkOptions = useMemo(
    () => [...new Set([...renkOptions, ...data.parts.map((p) => p.mdf_renk).filter((x): x is string => !!x)])].sort(),
    [renkOptions, data.parts]
  );
  const turOptions = useMemo(
    () => [...new Set(data.parts.map((p) => p.tur).filter((x): x is string => !!x))].sort(),
    [data.parts]
  );

  // ── Dialog durumları ──
  const [partDialog, setPartDialog] = useState<PartDialogState | null>(null);
  const [sheet, setSheet] = useState<{ open: boolean; mode: "create" | "edit"; plaka: PlakaRow | null; sku: string | null }>({
    open: false,
    mode: "create",
    plaka: null,
    sku: null,
  });
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const refresh = useCallback(() => router.refresh(), [router]);

  const toRow = (p: TreePlaka): PlakaRow =>
    ({ ...p, plaka_kategori: "MDF" }) as unknown as PlakaRow;

  const runConfirm = async () => {
    if (!confirm) return;
    const c = confirm;
    setConfirm(null);
    const r = await c.run();
    if (r.success) {
      toast.success(c.okMessage);
      refresh();
    } else {
      toast.error(r.error ?? "İşlem başarısız");
    }
  };

  const listeHandlers: ListeHandlers = {
    isOpen,
    toggle,
    onAddPlaka: (sku) => setSheet({ open: true, mode: "create", plaka: null, sku }),
    onEditPlaka: (p) => setSheet({ open: true, mode: "edit", plaka: toRow(p), sku: null }),
    onDeletePlaka: (p) =>
      setConfirm({
        title: "Plaka silinsin mi?",
        description: `${p.plaka_id} — ${p.plaka_adi}. Plakanın parça bağlantıları da silinir. Üretimde (kesimde) kullanılmış plaka silinemez.`,
        actionLabel: "Sil",
        okMessage: "Plaka silindi",
        run: () => deletePlaka(p.plakalar_id),
      }),
    onNewPart: (sku, plaka) => setPartDialog({ kind: "new", sku, plakaId: plaka.plaka_id, plateOptions: [plaka] }),
    onLinkPart: (sku, plaka) => setPartDialog({ kind: "link", plaka, sku }),
    onEditPart: (part, pp) => setPartDialog({ kind: "edit", part, pp }),
    onRemovePart: (pp, part) =>
      setConfirm({
        title: "Parça plakadan kaldırılsın mı?",
        description: `${pp.part_id}${part ? ` — ${part.part_adi}` : ""} bu plakadan çıkarılır (parça kaydı silinmez).`,
        actionLabel: "Kaldır",
        okMessage: "Parça plakadan kaldırıldı",
        run: () => deletePlakaPart(pp.ppart_id),
      }),
  };

  const parcalarHandlers: ParcalarHandlers = {
    isOpen,
    toggle,
    onNewPart: (sku, plateOptions) => setPartDialog({ kind: "new", sku, plakaId: null, plateOptions }),
    onEditPart: (part) => {
      setPartDialog({ kind: "edit", part, pp: null });
    },
    onDeletePart: (part) =>
      setConfirm({
        title: "Parça silinsin mi?",
        description: `${part.part_id} — ${part.part_adi}. Tüm plaka bağlantıları silinir. Reçetede (BOM), kesimde veya stok hareketinde kullanılıyorsa silinmez.`,
        actionLabel: "Sil",
        okMessage: "Parça silindi",
        run: () => deletePartEverywhere(part.part_id),
      }),
    onLinkToPlate: (sku, plaka, partId) => setPartDialog({ kind: "link", plaka, sku, partId }),
  };

  const onChange = useCallback(
    (u: Partial<Record<keyof Filters, string>>) => url.set(u as Record<string, string | undefined>),
    [url]
  );
  const onClear = useCallback(
    () => url.set({ q: "", sku: "", tip: "", mdf: "", renk: "", mak: "", plakasiz: "" }),
    [url]
  );

  const count = view === "liste" ? liste.length : parcalar.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-muted p-1">
          <Button
            variant={view === "liste" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => url.set({ view: "" })}
          >
            <List className="h-4 w-4" />
            Liste
          </Button>
          <Button
            variant={view === "parcalar" ? "default" : "ghost"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => url.set({ view: "parcalar" })}
          >
            <Puzzle className="h-4 w-4" />
            Parçalar
          </Button>
        </div>
        <Button
          size="sm"
          className="shrink-0"
          onClick={() => setSheet({ open: true, mode: "create", plaka: null, sku: filters.sku || null })}
        >
          <Plus className="mr-1 h-4 w-4" />
          Yeni Plaka
        </Button>
      </div>

      <PlakalarToolbar
        filters={filters}
        onChange={onChange}
        onClear={onClear}
        skuOptions={skuOptions}
        mdfOptions={mdfOptions}
        renkOptions={renkOptions}
        view={view}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        onImported={refresh}
      />

      <p className="text-xs text-muted-foreground">{count} ürün listeleniyor</p>

      {view === "liste" ? (
        <ListeTree items={liste} q={filters.q} h={listeHandlers} />
      ) : (
        <ParcalarTree items={parcalar} q={filters.q} h={parcalarHandlers} />
      )}

      <PlakaEditSheet
        plaka={sheet.plaka}
        mode={sheet.mode}
        open={sheet.open}
        defaultSku={sheet.sku}
        onOpenChange={(o) => setSheet((s) => ({ ...s, open: o }))}
        onSaved={refresh}
      />

      <PartDialog
        state={partDialog}
        onClose={() => setPartDialog(null)}
        onSaved={refresh}
        allParts={data.parts}
        tipOptions={partMdfOptions}
        renkOptions={partRenkOptions}
        turOptions={turOptions}
      />

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={runConfirm} className="bg-destructive hover:bg-destructive/90">
              {confirm?.actionLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
