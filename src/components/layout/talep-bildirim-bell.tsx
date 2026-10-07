"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn, formatDistanceToNow } from "@/lib/utils";
import {
  TALEP_BILDIRIM_OLAY_LABEL,
  bildirimHref,
  useTalepBildirimleri,
} from "@/hooks/use-talep-bildirimleri";

/** Üst çubukta, tüm ekranlarda: talep bildirimleri (yeni talep / değişiklik) */
export function TalepBildirimBell() {
  const router = useRouter();
  const [acik, setAcik] = useState(false);
  const { items, sayi } = useTalepBildirimleri(true);

  const git = (href: string) => {
    setAcik(false);
    router.push(href);
  };

  return (
    <Popover open={acik} onOpenChange={setAcik}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative" aria-label="Talep bildirimleri">
              <ClipboardList className="size-4" />
              {sayi > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ee7683] px-1 text-[10px] font-bold text-white">
                  {sayi > 99 ? "99+" : sayi}
                </span>
              )}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Talep bildirimleri</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-sm font-semibold">Talep bildirimleri</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => git("/talepler?bildirim=1")}>
            Tümünü gör
          </Button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Bildirim yok</p>
          ) : (
            items.map((b) => {
              const okundu = !!b.goruldu_at;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => git(bildirimHref(b))}
                  className={cn(
                    "flex w-full items-start gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted/60",
                    okundu && "opacity-50",
                  )}
                >
                  <span
                    className={cn("mt-1.5 size-2 shrink-0 rounded-full", okundu ? "bg-transparent" : "bg-[#ee7683]")}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className={cn("block", !okundu && "font-semibold")}>{TALEP_BILDIRIM_OLAY_LABEL[b.olay]}</span>
                    <span className="block truncate text-xs text-muted-foreground">{b.ozet}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {formatDistanceToNow(b.created_at)}
                      {okundu && " · görüldü"}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
