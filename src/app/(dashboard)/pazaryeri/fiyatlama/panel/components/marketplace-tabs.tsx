"use client";

import { cn } from "@/lib/utils";
import type { Marketplace } from "@/types/pricing";

interface MarketplaceTabsProps {
  marketplaces: Marketplace[];
  selected: string | null;
  onSelect: (code: string) => void;
}

export function MarketplaceTabs({ marketplaces, selected, onSelect }: MarketplaceTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto rounded-lg border bg-card p-1">
      {marketplaces.map((mp) => (
        <button
          key={mp.code}
          onClick={() => onSelect(mp.code)}
          className={cn(
            "whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            selected === mp.code
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {mp.code}
        </button>
      ))}
    </div>
  );
}
