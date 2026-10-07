"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface Props {
  value: number | null;
  /** Değer onaylandığında (blur / Enter / hızlı seçim) çağrılır */
  onCommit: (v: number | null) => void;
  disabled?: boolean;
  className?: string;
  /** Giriş genişliği */
  inputClassName?: string;
}

/** 50..250 ile başlar; her "daha fazla" tıklamasında 5 çarpan daha eklenir */
function secenekler(adim: number): number[] {
  return Array.from({ length: 5 * adim }, (_, i) => (i + 1) * 50);
}

/**
 * Miktar girişi: düzenlenebilir sayı + küçük "+" düğmesi (hızlı seçim: 50, 100, 150, 200, 250)
 * ve mavi aşağı ok ("daha fazla": her tıklamada 5 çarpan daha).
 */
export function MiktarHizliInput({ value, onCommit, disabled, className, inputClassName }: Props) {
  const [text, setText] = useState(value == null ? "" : String(value));
  const [focus, setFocus] = useState(false);
  const [open, setOpen] = useState(false);
  const [adim, setAdim] = useState(1);

  useEffect(() => {
    if (!focus) setText(value == null ? "" : String(value));
  }, [value, focus]);

  const commit = () => {
    const t = text.trim().replace(",", ".");
    const n = t === "" ? null : Number(t);
    if (n !== null && (!Number.isFinite(n) || n <= 0)) {
      setText(value == null ? "" : String(value));
      return;
    }
    if (n !== value) onCommit(n);
  };

  return (
    <div className={cn("flex items-center gap-1", className)}>
      <Input
        type="number"
        inputMode="decimal"
        min={0}
        value={text}
        disabled={disabled}
        onFocus={() => setFocus(true)}
        onBlur={() => {
          setFocus(false);
          commit();
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className={cn("h-8 w-20 px-2 text-right text-sm", inputClassName)}
      />
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setAdim(1);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-label="Hızlı miktar seç"
            className="flex h-6 w-6 items-center justify-center rounded border border-vw-side/50 bg-vw-light text-vw-deep hover:bg-vw-primary disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-60 p-2" align="end">
          <div className="grid grid-cols-5 gap-1">
            {secenekler(adim).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setText(String(n));
                  setOpen(false);
                  if (n !== value) onCommit(n);
                }}
                className={cn(
                  "rounded border px-1 py-1.5 text-xs font-medium hover:bg-vw-primary/40",
                  n === value ? "border-vw-deep bg-vw-primary/50" : "border-border",
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setAdim((a) => a + 1)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded bg-[#3368b1]/10 py-1 text-xs font-medium text-[#3368b1] hover:bg-[#3368b1]/20"
            aria-label="Daha fazla"
          >
            <ChevronDown className="h-4 w-4" /> daha fazla
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
