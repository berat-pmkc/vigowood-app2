"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { X, Info } from "lucide-react";
import { hesaplaSatir, karMarjiRenk } from "@/lib/pricingCalculator";
import type { ShippingProvider } from "@/types/pricing";

// Row shape after enrichment from server
export interface PricingRow {
  id: string;
  listing_kodu: string;
  sku: string;
  urun_adi: string | null;
  satis_fiyati: number;
  komisyon_orani: number;
  reklam_orani: number;
  kargo_maliyeti: number;
  hedef_fiyat: number;
  desi: number;
  stopaj_orani: number;
  // Calculated fields (client-side)
  ham_fiyat: number;
  komisyon_bedeli: number;
  vergi_tutari: number;
  stopaj_tutari: number;
  reklam_bedeli: number;
  kar_marji: number;
  oneri_fiyat: number;
}

interface PricingTableProps {
  initialRows: any[];
  defaultProvider: ShippingProvider | null;
  kdvOrani: number;
  stopajOrani: number;
  onDirtyChange: (dirtyIds: Set<string>) => void;
  onRowsChange: (rows: PricingRow[]) => void;
  onDeactivate?: (id: string) => void;
}

// Editable cell component
function EditableCell({
  value,
  onChange,
  isPercentage = false,
}: {
  value: number;
  onChange: (val: number) => void;
  isPercentage?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const displayValue = isPercentage
    ? `%${(value * 100).toFixed(1)}`
    : `₺${Math.round(value).toFixed(0)}`;

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleStart = () => {
    setEditing(true);
    setLocalValue(isPercentage ? (value * 100).toFixed(1) : Math.round(value).toString());
  };

  const handleCommit = () => {
    setEditing(false);
    const parsed = parseFloat(localValue);
    if (!isNaN(parsed)) {
      onChange(isPercentage ? parsed / 100 : parsed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      handleCommit();
      // Move to next editable cell on Tab
      if (e.key === "Tab") {
        const parent = inputRef.current?.closest("td");
        const row = parent?.closest("tr");
        if (row) {
          const nextRow = e.shiftKey ? row.previousElementSibling : row.nextElementSibling;
          if (nextRow) {
            const colIndex = Array.from(row.children).indexOf(parent!);
            const targetCell = nextRow.children[colIndex];
            const clickTarget = targetCell?.querySelector("[data-editable]") as HTMLElement;
            if (clickTarget) setTimeout(() => clickTarget.click(), 0);
          }
        }
      }
    }
    if (e.key === "Escape") {
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        step={isPercentage ? "0.1" : "1"}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={handleKeyDown}
        className="h-7 w-24 px-1 text-right text-xs"
      />
    );
  }

  return (
    <span
      data-editable
      onClick={handleStart}
      className="cursor-pointer rounded px-1.5 py-0.5 text-right text-xs font-medium bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors"
    >
      {displayValue}
    </span>
  );
}

function recalcRow(row: PricingRow, desiFiyatlari: Record<string, number> | null, kdvOrani: number): PricingRow {
  const calc = hesaplaSatir({
    satisFiyati: row.satis_fiyati,
    komisyonOrani: row.komisyon_orani,
    reklamOrani: row.reklam_orani,
    stopajOrani: row.stopaj_orani,
    kdvOrani,
    desi: row.desi,
    desiFiyatlari,
    hedefFiyat: row.hedef_fiyat,
  });

  return {
    ...row,
    ham_fiyat: calc.hamFiyat,
    komisyon_bedeli: calc.komisyonBedeli,
    vergi_tutari: calc.vergiTutari,
    stopaj_tutari: calc.stopajTutari,
    reklam_bedeli: calc.reklamBedeli,
    kargo_maliyeti: calc.kargoMaliyeti,
    kar_marji: calc.karMarji,
    oneri_fiyat: calc.oneriFiyat,
  };
}

export function PricingTable({
  initialRows,
  defaultProvider,
  kdvOrani,
  stopajOrani,
  onDirtyChange,
  onRowsChange,
  onDeactivate,
}: PricingTableProps) {
  const desiFiyatlari = defaultProvider?.desi_fiyatlari ?? null;

  // Initialize rows with calculations
  const [rows, setRows] = useState<PricingRow[]>(() =>
    initialRows.map((r) =>
      recalcRow(
        {
          id: r.id,
          listing_kodu: r.listing_kodu,
          sku: r.sku,
          urun_adi: r.urun_adi,
          satis_fiyati: Number(r.satis_fiyati) || 0,
          komisyon_orani: Number(r.komisyon_orani) || 0,
          reklam_orani: Number(r.reklam_orani) || 0,
          kargo_maliyeti: Number(r.kargo_maliyeti) || 0,
          hedef_fiyat: Number(r.hedef_fiyat) || 0,
          desi: Number(r.desi) || 0,
          stopaj_orani: Number(r.stopaj_orani) || stopajOrani,
          ham_fiyat: 0,
          komisyon_bedeli: 0,
          vergi_tutari: 0,
          stopaj_tutari: 0,
          reklam_bedeli: 0,
          kar_marji: 0,
          oneri_fiyat: 0,
        },
        desiFiyatlari,
        kdvOrani
      )
    )
  );

  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // Sync rows to parent
  useEffect(() => {
    onRowsChange(rows);
  }, [rows, onRowsChange]);

  const updateCell = useCallback(
    (rowId: string, field: "satis_fiyati" | "komisyon_orani" | "reklam_orani", value: number) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          const updated = { ...r, [field]: value };
          return recalcRow(updated, desiFiyatlari, kdvOrani);
        })
      );
      setDirtyIds((prev) => {
        const next = new Set(prev);
        next.add(rowId);
        onDirtyChange(next);
        return next;
      });
    },
    [desiFiyatlari, kdvOrani, onDirtyChange]
  );

  // Expose method to bulk update reklam_orani
  useEffect(() => {
    // @ts-expect-error — exposing imperative method via ref-like pattern
    if (typeof window !== "undefined") window.__pricingTableBulkReklam = (oran: number) => {
      setRows((prev) =>
        prev.map((r) => recalcRow({ ...r, reklam_orani: oran }, desiFiyatlari, kdvOrani))
      );
      setDirtyIds((prev) => {
        const next = new Set(prev);
        rows.forEach(r => next.add(r.id));
        onDirtyChange(next);
        return next;
      });
    };
  }, [rows, desiFiyatlari, kdvOrani, onDirtyChange]);

  const columns = useMemo<ColumnDef<PricingRow, any>[]>(
    () => [
      {
        id: "actions",
        header: "",
        size: 32,
        cell: ({ row }) => (
          onDeactivate ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => onDeactivate(row.original.id)}
                  className="rounded p-0.5 text-muted-foreground/50 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">Listeden kaldır (geri alınabilir)</TooltipContent>
            </Tooltip>
          ) : null
        ),
      },
      {
        accessorKey: "listing_kodu",
        header: "Listing Kodu",
        size: 120,
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "sku",
        header: "SKU",
        size: 100,
        cell: ({ getValue }) => (
          <span className="text-xs font-mono">{getValue<string>()}</span>
        ),
      },
      {
        accessorKey: "satis_fiyati",
        header: "Satış ₺",
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.satis_fiyati}
            onChange={(v) => updateCell(row.original.id, "satis_fiyati", v)}
          />
        ),
      },
      {
        accessorKey: "hedef_fiyat",
        header: "Hedef ₺",
        size: 90,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">
            {getValue<number>() > 0 ? `₺${Math.round(getValue<number>()).toFixed(0)}` : "—"}
          </span>
        ),
      },
      {
        accessorKey: "ham_fiyat",
        header: "Ham ₺",
        size: 90,
        cell: ({ row }) => {
          const v = row.original.ham_fiyat;
          const cls = v >= 0 ? "text-green-700" : "text-red-700";
          return <span className={`text-xs font-semibold ${cls}`}>₺{Math.round(v).toFixed(0)}</span>;
        },
      },
      {
        accessorKey: "komisyon_orani",
        header: "Kom. %",
        size: 80,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.komisyon_orani}
            onChange={(v) => updateCell(row.original.id, "komisyon_orani", v)}
            isPercentage
          />
        ),
      },
      {
        accessorKey: "komisyon_bedeli",
        header: "Kom. ₺",
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">₺{Math.round(getValue<number>()).toFixed(0)}</span>
        ),
      },
      {
        accessorKey: "kargo_maliyeti",
        header: "Kargo ₺",
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">₺{Math.round(getValue<number>()).toFixed(0)}</span>
        ),
      },
      {
        accessorKey: "vergi_tutari",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-help">
                Vergi ₺ <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>%10 KDV (sabit)</TooltipContent>
          </Tooltip>
        ),
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">₺{Math.round(getValue<number>()).toFixed(0)}</span>
        ),
      },
      {
        accessorKey: "stopaj_tutari",
        header: () => (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex items-center gap-1 cursor-help">
                Stopaj ₺ <Info className="h-3 w-3 text-muted-foreground" />
              </span>
            </TooltipTrigger>
            <TooltipContent>%{(stopajOrani * 100).toFixed(1)} stopaj</TooltipContent>
          </Tooltip>
        ),
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">₺{Math.round(getValue<number>()).toFixed(0)}</span>
        ),
      },
      {
        accessorKey: "reklam_orani",
        header: "Reklam %",
        size: 80,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.reklam_orani}
            onChange={(v) => updateCell(row.original.id, "reklam_orani", v)}
            isPercentage
          />
        ),
      },
      {
        accessorKey: "reklam_bedeli",
        header: "Rek. ₺",
        size: 70,
        cell: ({ getValue }) => (
          <span className="text-xs text-muted-foreground">₺{Math.round(getValue<number>()).toFixed(0)}</span>
        ),
      },
      {
        accessorKey: "kar_marji",
        header: "Kar %",
        size: 80,
        cell: ({ getValue }) => {
          const v = getValue<number>();
          return (
            <span className={`rounded px-1.5 py-0.5 text-xs font-semibold ${karMarjiRenk(v)}`}>
              %{(v * 100).toFixed(1)}
            </span>
          );
        },
      },
      {
        accessorKey: "oneri_fiyat",
        header: "Öneri ₺",
        size: 80,
        cell: ({ getValue }) => (
          <span className="text-xs italic text-blue-600">
            {getValue<number>() > 0 ? `₺${Math.round(getValue<number>()).toFixed(0)}` : "—"}
          </span>
        ),
      },
    ],
    [updateCell, stopajOrani, onDeactivate]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _columnId, filterValue) => {
      const search = filterValue.toLowerCase();
      return (
        row.original.listing_kodu?.toLowerCase().includes(search) ||
        row.original.sku?.toLowerCase().includes(search) ||
        (row.original.urun_adi?.toLowerCase().includes(search) ?? false)
      );
    },
  });

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="flex items-center gap-3">
        <Input
          placeholder="SKU, listing kodu veya ürün adı ara..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="max-w-sm h-8 text-sm"
        />
        <span className="text-xs text-muted-foreground">
          {table.getFilteredRowModel().rows.length} / {rows.length} ürün
        </span>
        {dirtyIds.size > 0 && (
          <span className="text-xs font-medium text-amber-600">
            {dirtyIds.size} değişiklik kaydedilmedi
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-left">
          <thead className="bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="whitespace-nowrap px-2 py-2 text-xs font-semibold text-muted-foreground cursor-pointer select-none hover:text-foreground"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " ↑"}
                      {header.column.getIsSorted() === "desc" && " ↓"}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Bu pazaryerinde aktif listing bulunamadı.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-muted/30 transition-colors ${
                    dirtyIds.has(row.original.id) ? "bg-amber-50/50" : ""
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-2 py-1.5">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
