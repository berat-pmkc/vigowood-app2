"use client";

import { useEffect, useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { fetchCutLines } from "../actions";
import type { CutLine } from "@/lib/supabase/types";

interface KesimExpandableRowProps {
  cutId: string;
  colSpan: number;
  onEditLine: (line: CutLine) => void;
  onDeleteLine: (line: CutLine) => void;
}

export function KesimExpandableRow({
  cutId,
  colSpan,
  onEditLine,
  onDeleteLine,
}: KesimExpandableRowProps) {
  const [lines, setLines] = useState<CutLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchCutLines(cutId)
      .then((data) => {
        if (mounted) {
          setLines(data);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [cutId]);

  return (
    <TableRow className="bg-muted/30 hover:bg-muted/40">
      <TableCell colSpan={colSpan} className="p-0">
        <div className="px-12 py-3">
          <h4 className="text-sm font-medium mb-2 text-muted-foreground">
            Kesim Satırları ({lines.length})
          </h4>
          {loading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Yükleniyor...
            </div>
          ) : lines.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Satır bulunamadı</p>
          ) : (
            <div className="overflow-hidden rounded border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Satır ID</th>
                    <th className="px-3 py-2 text-left font-medium">Parça ID</th>
                    <th className="px-3 py-2 text-right font-medium">Adet</th>
                    <th className="px-3 py-2 text-left font-medium">Renk</th>
                    <th className="px-3 py-2 text-left font-medium">Not</th>
                    <th className="px-3 py-2 text-right font-medium w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.cut_line_id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-mono">{line.cut_line_id}</td>
                      <td className="px-3 py-1.5 font-mono">{line.part_id || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono">
                        {formatNumber(Number(line.adet))}
                      </td>
                      <td className="px-3 py-1.5">{line.renk || "—"}</td>
                      <td className="px-3 py-1.5 max-w-[200px] truncate">
                        {line.not_text || "—"}
                      </td>
                      <td className="px-3 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => onEditLine(line)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => onDeleteLine(line)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
