"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Link2, CheckCircle2, BarChart3, Clock } from "lucide-react";
import { getRecentMappings } from "../actions";
import type { Database } from "@/lib/supabase/types";

type SkuMapping = Database["public"]["Tables"]["sku_mappings"]["Row"];

interface Stats {
  totalMasterSku: number;
  totalMatched: number;
  totalUnmatched: number;
  total: number;
  matchRate: number;
  channels: {
    trendyol: { total: number; matched: number; unmatched: number };
    ikas: { total: number; matched: number; unmatched: number };
  };
}

interface SummaryTabProps {
  stats: Stats;
}

export function SummaryTab({ stats }: SummaryTabProps) {
  const [recentMappings, setRecentMappings] = useState<SkuMapping[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getRecentMappings()
      .then(setRecentMappings)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const channelRows = [
    {
      name: "Trendyol",
      ...stats.channels.trendyol,
      rate: stats.channels.trendyol.total > 0
        ? Math.round((stats.channels.trendyol.matched / stats.channels.trendyol.total) * 100)
        : 0,
    },
    {
      name: "İkas",
      ...stats.channels.ikas,
      rate: stats.channels.ikas.total > 0
        ? Math.round((stats.channels.ikas.matched / stats.channels.ikas.total) * 100)
        : 0,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Master SKU</CardTitle>
            <Link2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMasterSku}</div>
            <p className="text-xs text-muted-foreground">
              Benzersiz ürün kodu
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Toplam Eşleşme</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-vw-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMatched}</div>
            <p className="text-xs text-muted-foreground">
              Eşleştirilmiş kayıt ({stats.total} toplam)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Eşleşme Oranı</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">%{stats.matchRate}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalUnmatched} eşleşmemiş
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Channel Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kanal Bazlı Dağılım</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kanal</TableHead>
                <TableHead className="text-right">Toplam</TableHead>
                <TableHead className="text-right">Eşleşen</TableHead>
                <TableHead className="text-right">Eşleşmeyen</TableHead>
                <TableHead className="text-right">Oran</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channelRows.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        row.name === "Trendyol"
                          ? "bg-orange-100 text-orange-700 border-orange-200"
                          : "bg-blue-100 text-blue-700 border-blue-200"
                      }
                    >
                      {row.name}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{row.total}</TableCell>
                  <TableCell className="text-right font-mono text-vw-success">
                    {row.matched}
                  </TableCell>
                  <TableCell className="text-right font-mono text-vw-error">
                    {row.unmatched}
                  </TableCell>
                  <TableCell className="text-right font-mono">%{row.rate}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Mappings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" />
            Son Eklenen / Güncellenen
          </CardTitle>
          <CardDescription>Son 10 eşleştirme</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
              Yükleniyor...
            </div>
          ) : recentMappings.length === 0 ? (
            <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
              Henüz eşleştirme yok
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Master SKU</TableHead>
                  <TableHead>Kanal</TableHead>
                  <TableHead className="hidden sm:table-cell">Kanal SKU</TableHead>
                  <TableHead className="hidden md:table-cell">Ürün Adı</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead className="text-right hidden sm:table-cell">Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {m.master_sku}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          m.channel === "trendyol"
                            ? "bg-orange-100 text-orange-700 border-orange-200"
                            : "bg-blue-100 text-blue-700 border-blue-200"
                        }
                      >
                        {m.channel === "trendyol" ? "TY" : "İkas"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm hidden sm:table-cell">
                      {m.channel_sku || "—"}
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[200px] hidden md:table-cell">
                      {m.channel_product_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          m.match_status === "matched"
                            ? "bg-vw-success/20 text-vw-success border-vw-success/30"
                            : "bg-vw-error/20 text-vw-error border-vw-error/30"
                        }
                      >
                        {m.match_status === "matched" ? "Eşleşti" : "Eşleşmedi"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground hidden sm:table-cell">
                      {m.updated_at
                        ? new Date(m.updated_at).toLocaleDateString("tr-TR")
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
