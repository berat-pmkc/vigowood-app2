"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, GitBranch } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BomItemWithStock {
  step_bom_id: string;
  step_id: string;
  part_id: string;
  part_name: string;
  part_type: string | null;
  is_asm_reference: boolean;
  qty_per: number;
  qty_needed: number;
  stock_available: number | null;
  is_sufficient: boolean;
}

interface MaterialCheckPanelProps {
  items: BomItemWithStock[];
  className?: string;
}

export function MaterialCheckPanel({ items, className }: MaterialCheckPanelProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-2">Bu adımda malzeme tanımlı değil</p>
    );
  }

  return (
    <div className={cn("rounded-lg border overflow-hidden", className)}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="text-left px-3 py-2 font-medium">Malzeme</th>
            <th className="text-center px-3 py-2 font-medium w-16">Gerekli</th>
            <th className="text-center px-3 py-2 font-medium w-16">Stok</th>
            <th className="text-center px-3 py-2 font-medium w-10">Durum</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.step_bom_id} className="border-t">
              <td className="px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {item.is_asm_reference && (
                    <GitBranch className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                  )}
                  <span className={cn("font-medium truncate", item.is_asm_reference && "text-blue-700")}>
                    {item.part_name}
                  </span>
                </div>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="text-xs text-muted-foreground">{item.part_id}</span>
                  {item.is_asm_reference && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-blue-50 text-blue-600 border-blue-200">
                      Alt Montaj
                    </Badge>
                  )}
                  {item.part_type && !item.is_asm_reference && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                      {item.part_type}
                    </Badge>
                  )}
                </div>
              </td>
              <td className="text-center px-3 py-2 tabular-nums font-semibold">
                {item.qty_needed}
              </td>
              <td className="text-center px-3 py-2 tabular-nums">
                {item.is_asm_reference ? (
                  <span className="text-muted-foreground">—</span>
                ) : (
                  <span className={cn(
                    "font-medium",
                    item.is_sufficient ? "text-emerald-600" : "text-red-600"
                  )}>
                    {item.stock_available ?? 0}
                  </span>
                )}
              </td>
              <td className="text-center px-3 py-2">
                {item.is_asm_reference ? (
                  <GitBranch className="w-4 h-4 text-blue-400 mx-auto" />
                ) : item.is_sufficient ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mx-auto" />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
