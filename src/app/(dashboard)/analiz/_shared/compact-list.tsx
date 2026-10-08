"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronsDown, Filter, X } from "lucide-react";
import { GRANULARITY_LABELS, type Granularity } from "@/lib/periods";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  FILTER_PREFIX,
  columnKind,
  describeFilter,
  toNum,
  parseColumnFilters,
  serializeFilter,
  type ColumnFilter,
  type FilterableColumn,
} from "./column-filters";

/** Kolon tanımı; `filter` ile kolon başlığı filtresi türü seçilir (varsayılan: biçime göre). */
export type CompactColumn = FilterableColumn;

export type CompactRow = Record<string, string | number | null>;

interface CompactListProps {
  title?: string;
  columns: CompactColumn[];
  rows: CompactRow[];
  /** Günlük/Haftalık/Aylık/Yıllık seçici gösterilsin (?g=) */
  showGrouping?: boolean;
  activeGranularity?: Granularity;
  emptyText?: string;
  /** Metin kolonları için filtrelenmemiş ayrık değerler (sunucudan; ≤50 değer) */
  filterOptions?: Record<string, string[]>;
  /** Odak modu: listelenen kolonlar odakta; diğerlerinin başlığı soluk, hücreleri boş görünür (kolon ve filtre chip'leri yerinde kalır). */
  visibleColumns?: string[];
  /** `dot` kolonları için değer → renk (ör. hat adı → hat rengi) */
  dotColors?: Record<string, string>;
}

const FIRST = 5;
const STEP = 10;

function fmt(v: string | number | null, f: CompactColumn["format"]): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "string") {
    // Sayı kolonlarında string gelen değerler (Supabase numeric) de biçimlenir
    if (!f || f === "text") return v;
    const n = toNum(v);
    if (n === null) return v;
    v = n;
  }
  switch (f) {
    case "dk":
      return `${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} dk`;
    case "percent":
      return `%${v.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`;
    default:
      return v.toLocaleString("tr-TR", { maximumFractionDigits: 2 });
  }
}

export function CompactList({
  title,
  columns,
  rows,
  showGrouping,
  activeGranularity,
  emptyText = "Bu dönemde kayıt yok",
  filterOptions,
  visibleColumns,
  dotColors,
}: CompactListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [visible, setVisible] = useState(FIRST);

  const allShown = visible >= rows.length;
  const g = activeGranularity ?? (searchParams.get("g") as Granularity | null);

  const isMuted = (key: string) => !!visibleColumns && !visibleColumns.includes(key);
  const filters = parseColumnFilters(searchParams, columns);
  const activeCols = columns.filter((c) => filters[c.key]);

  function setGranularity(next: Granularity) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("g", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function setFilter(key: string, f: ColumnFilter | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (f) params.set(FILTER_PREFIX + key, serializeFilter(f));
    else params.delete(FILTER_PREFIX + key);
    setVisible(FIRST);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    for (const c of columns) params.delete(FILTER_PREFIX + c.key);
    setVisible(FIRST);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="rounded-xl border border-[#a99c7d]/30 bg-white shadow-sm">
      {(title || showGrouping) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#a99c7d]/20 px-4 py-2.5">
          {title ? <h3 className="text-sm font-semibold text-[#474237]">{title}</h3> : <span />}
          {showGrouping && (
            <div className="flex overflow-hidden rounded-md border border-[#a99c7d]/40">
              {(Object.keys(GRANULARITY_LABELS) as Granularity[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setGranularity(k)}
                  className={`px-2.5 py-1 text-xs font-medium ${
                    g === k ? "bg-[#cdbd9d] text-[#474237]" : "bg-white text-[#5e5747] hover:bg-[#f0ede1]"
                  }`}
                >
                  {GRANULARITY_LABELS[k]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {activeCols.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-[#a99c7d]/20 bg-[#f0ede1]/50 px-4 py-2">
          {activeCols.map((c) => (
            <span
              key={c.key}
              className="inline-flex items-center gap-1 rounded-full border border-[#3368b1]/40 bg-white py-0.5 pl-2.5 pr-1 text-xs font-medium text-[#3368b1]"
            >
              {describeFilter(c.label, filters[c.key])}
              <button
                type="button"
                aria-label={`${c.label} filtresini kaldır`}
                onClick={() => setFilter(c.key, null)}
                className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-[#3368b1]/10"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAll}
            className="ml-1 text-xs font-medium text-[#5e5747] underline-offset-2 hover:underline"
          >
            Tüm filtreleri temizle
          </button>
        </div>
      )}

      <div className="max-h-[70vh] overflow-auto overscroll-x-contain">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`sticky top-0 z-10 whitespace-nowrap bg-[#f7f5ee] px-4 py-1.5 font-medium shadow-[0_1px_0_0_rgba(169,156,125,0.35),0_2px_4px_-2px_rgba(71,66,55,0.15)] ${
                    c.align === "right" ? "text-right" : "text-left"
                  } ${isMuted(c.key) ? "opacity-40" : ""}`}
                >
                  <span className={`inline-flex items-center gap-1 ${c.align === "right" ? "flex-row-reverse" : ""}`}>
                    <span>{c.label}</span>
                    {columnKind(c) && (
                      <HeaderFilter
                        column={c}
                        active={filters[c.key] ?? null}
                        options={filterOptions?.[c.key] ?? derivedOptions(rows, c)}
                        onApply={(f) => setFilter(c.key, f)}
                      />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-muted-foreground">
                  {activeCols.length > 0 ? "Filtreye uyan kayıt yok" : emptyText}
                </td>
              </tr>
            )}
            {rows.slice(0, visible).map((r, i) => (
              <tr key={i} className="border-b border-[#a99c7d]/10 last:border-0">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`whitespace-nowrap px-4 py-1.5 ${
                      c.align === "right" ? "text-right tabular-nums" : "text-left"
                    }`}
                  >
                    {isMuted(c.key) ? (
                      ""
                    ) : c.dot && r[c.key] ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ backgroundColor: dotColors?.[String(r[c.key])] ?? "#5e5747" }}
                        />
                        {fmt(r[c.key] ?? null, c.format)}
                      </span>
                    ) : (
                      fmt(r[c.key] ?? null, c.format)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > FIRST && (
        <button
          type="button"
          disabled={allShown}
          onClick={() => setVisible((v) => v + STEP)}
          className="flex w-full items-center justify-center gap-1.5 border-t border-[#a99c7d]/20 px-4 py-2 text-sm font-medium disabled:cursor-default"
          style={{ color: allShown ? "#9ca3af" : "#3368b1" }}
        >
          <ChevronsDown className="h-4 w-4" />
          {allShown ? "Tümü gösterildi" : `Devamını göster (+${Math.min(STEP, rows.length - visible)})`}
        </button>
      )}
    </div>
  );
}

function derivedOptions(rows: CompactRow[], c: CompactColumn): string[] | undefined {
  const kind = columnKind(c);
  if (kind !== "text" && kind !== "select") return undefined;
  const set = new Set<string>();
  for (const r of rows) {
    const v = r[c.key];
    set.add(v === null || v === undefined || v === "" ? "—" : String(v));
    if (set.size > 50) return undefined;
  }
  return [...set].sort((a, b) => a.localeCompare(b, "tr"));
}

const BTN = "min-h-10 flex-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors";

function HeaderFilter({
  column,
  active,
  options,
  onApply,
}: {
  column: CompactColumn;
  active: ColumnFilter | null;
  options?: string[];
  onApply: (f: ColumnFilter | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const isNumber = columnKind(column) === "number";

  // taslak durum (açılışta aktif filtreden doldurulur)
  const [contains, setContains] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [op, setOp] = useState<"" | "gt0" | "eq0">("");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");

  function syncFromActive() {
    setSearch("");
    if (active?.kind === "text") {
      setContains(active.contains ?? "");
      setPicked(active.values ?? []);
    } else {
      setContains("");
      setPicked([]);
    }
    if (active?.kind === "number") {
      setOp(active.op === "range" ? "" : active.op);
      setMin(active.op === "range" && active.min !== undefined ? String(active.min) : "");
      setMax(active.op === "range" && active.max !== undefined ? String(active.max) : "");
    } else {
      setOp("");
      setMin("");
      setMax("");
    }
  }

  function commit(f: ColumnFilter | null) {
    onApply(f);
    setOpen(false);
  }

  function apply() {
    if (isNumber) {
      if (op) return commit({ kind: "number", op });
      const toN = (s: string) => {
        const n = Number(s.trim().replace(",", "."));
        return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
      };
      const lo = toN(min);
      const hi = toN(max);
      if (lo === undefined && hi === undefined) return commit(null);
      return commit({ kind: "number", op: "range", min: lo, max: hi });
    }
    if (picked.length) return commit({ kind: "text", values: picked });
    if (contains.trim()) return commit({ kind: "text", contains: contains.trim() });
    return commit(null);
  }

  const shown = (options ?? []).filter((o) => o.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")));
  const on = "border-[#3368b1] bg-[#3368b1] text-white";
  const off = "border-[#a99c7d]/40 bg-white hover:bg-[#f0ede1]";

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        if (v) syncFromActive();
        setOpen(v);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${column.label} filtresi`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded hover:bg-[#f0ede1]"
          style={{ color: active ? "#3368b1" : "#a99c7d" }}
        >
          <Filter className="h-3.5 w-3.5" fill={active ? "#3368b1" : "none"} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3 p-3 text-sm font-normal text-[#474237]">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#a99c7d]">{column.label}</p>

        {isNumber ? (
          <>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOp(op === "gt0" ? "" : "gt0")} className={`${BTN} ${op === "gt0" ? on : off}`}>
                Değeri olanlar (&gt;0)
              </button>
              <button type="button" onClick={() => setOp(op === "eq0" ? "" : "eq0")} className={`${BTN} ${op === "eq0" ? on : off}`}>
                Boş / 0
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                inputMode="decimal"
                placeholder="Min"
                value={min}
                onChange={(e) => {
                  setMin(e.target.value);
                  setOp("");
                }}
                className="h-10 w-full rounded-md border border-[#a99c7d]/40 px-2 text-sm"
              />
              <span className="text-muted-foreground">–</span>
              <input
                inputMode="decimal"
                placeholder="Maks"
                value={max}
                onChange={(e) => {
                  setMax(e.target.value);
                  setOp("");
                }}
                className="h-10 w-full rounded-md border border-[#a99c7d]/40 px-2 text-sm"
              />
            </div>
          </>
        ) : (
          <>
            <input
              placeholder="İçerir..."
              value={contains}
              onChange={(e) => {
                setContains(e.target.value);
                setPicked([]);
              }}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="h-10 w-full rounded-md border border-[#a99c7d]/40 px-2 text-sm"
            />
            {options && options.length > 0 && (
              <div className="space-y-1.5">
                {options.length > 8 && (
                  <input
                    placeholder="Listede ara..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-9 w-full rounded-md border border-[#a99c7d]/30 px-2 text-xs"
                  />
                )}
                <div className="max-h-44 overflow-y-auto rounded-md border border-[#a99c7d]/20">
                  {shown.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">Sonuç yok</p>}
                  {shown.map((o) => {
                    const checked = picked.includes(o);
                    return (
                      <label
                        key={o}
                        className="flex min-h-10 cursor-pointer items-center gap-2 px-2 py-1 text-sm hover:bg-[#f0ede1]"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setContains("");
                            setPicked(checked ? picked.filter((x) => x !== o) : [...picked, o]);
                          }}
                          className="h-4 w-4 accent-[#3368b1]"
                        />
                        <span className="truncate">{o}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => commit(null)}
            className="min-h-10 flex-1 rounded-md border border-[#a99c7d]/40 bg-white px-3 text-sm font-medium hover:bg-[#f0ede1]"
          >
            Temizle
          </button>
          <button
            type="button"
            onClick={apply}
            className="min-h-10 flex-1 rounded-md bg-[#3368b1] px-3 text-sm font-semibold text-white hover:bg-[#2a5898]"
          >
            Uygula
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
