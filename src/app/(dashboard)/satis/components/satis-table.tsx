"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

export interface SkuSalesRow {
  sku: string;
  toplam_adet: number;
  toplam_tutar: number;
}

interface SatisTableProps {
  trRows: SkuSalesRow[];
  ihracatRows: SkuSalesRow[];
  trToplam: number;
  ihracatToplam: number;
}

function SkuTable({
  rows,
  title,
  badge,
}: {
  rows: SkuSalesRow[];
  title: string;
  badge?: string;
}) {
  if (rows.length === 0) return null;

  const totalAdet = rows.reduce((s, r) => s + r.toplam_adet, 0);
  const totalTutar = rows.reduce((s, r) => s + r.toplam_tutar, 0);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {badge && (
            <Badge variant="outline" className="text-xs">
              {badge}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="max-h-[400px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]">#</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Toplam Adet</TableHead>
                <TableHead className="text-right">Toplam Tutar</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={row.sku}>
                  <TableCell className="text-muted-foreground">
                    {i + 1}
                  </TableCell>
                  <TableCell className="font-medium">{row.sku}</TableCell>
                  <TableCell className="text-right">
                    {formatNumber(row.toplam_adet)}
                  </TableCell>
                  <TableCell className="text-right">
                    ₺{formatNumber(Math.round(row.toplam_tutar))}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 font-bold">
                <TableCell colSpan={2}>Toplam</TableCell>
                <TableCell className="text-right">
                  {formatNumber(totalAdet)}
                </TableCell>
                <TableCell className="text-right">
                  ₺{formatNumber(Math.round(totalTutar))}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

export function SatisTable({
  trRows,
  ihracatRows,
  trToplam,
  ihracatToplam,
}: SatisTableProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SkuTable
        rows={trRows}
        title="TR Satışlar"
        badge={`₺${formatNumber(Math.round(trToplam))}`}
      />
      <SkuTable
        rows={ihracatRows}
        title="İhracat Satışlar"
        badge={`₺${formatNumber(Math.round(ihracatToplam))}`}
      />
    </div>
  );
}
