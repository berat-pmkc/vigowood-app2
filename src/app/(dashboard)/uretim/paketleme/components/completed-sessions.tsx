"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PaketlemeStatusBadge } from "./paketleme-status-badge";
import { formatDuration } from "@/lib/utils";
import { CheckCircle, Users } from "lucide-react";

export interface CompletedSession {
  session_id: string;
  sku: string | null;
  urun_adi?: string;
  qty: number;
  start_time: string | null;
  end_time: string | null;
  durum: string;
  worker_count: number | null;
  workers: Array<{ id: string; name: string }> | null;
  birim_paketleme_dk: number | null;
}

interface CompletedSessionsProps {
  sessions: CompletedSession[];
}

export function CompletedSessions({ sessions }: CompletedSessionsProps) {
  if (sessions.length === 0) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Son Tamamlanan Seanslar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Henüz tamamlanan seans yok
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          Son Tamamlanan Seanslar
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Ürün</th>
                <th className="pb-2 font-medium text-right">Adet</th>
                <th className="pb-2 font-medium text-center">Kişi</th>
                <th className="pb-2 font-medium text-right">Süre</th>
                <th className="pb-2 font-medium text-right">dk/birim</th>
                <th className="pb-2 font-medium text-center">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {sessions.map((s) => {
                const workers = s.workers as Array<{ id: string; name: string }> | null;
                return (
                  <tr key={s.session_id} className="hover:bg-muted/30">
                    <td className="py-2.5">
                      <div>
                        <span className="font-medium truncate block max-w-[200px]">
                          {s.urun_adi ?? s.sku ?? "—"}
                        </span>
                        {s.sku && s.urun_adi && (
                          <span className="text-xs text-muted-foreground">{s.sku}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-medium tabular-nums">{s.qty}</td>
                    <td className="py-2.5 text-center">
                      {workers && workers.length > 0 ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs"
                          title={workers.map((w) => w.name).join(", ")}
                        >
                          <Users className="w-3 h-3" />
                          {workers.length}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">{s.worker_count ?? 1}</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right text-muted-foreground tabular-nums">
                      {formatDuration(s.start_time, s.end_time)}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">
                      {s.birim_paketleme_dk != null ? (
                        <span className="font-medium">{s.birim_paketleme_dk} dk</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center">
                      <PaketlemeStatusBadge durum={s.durum} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-2">
          {sessions.map((s) => {
            const workers = s.workers as Array<{ id: string; name: string }> | null;
            return (
              <div
                key={s.session_id}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm truncate max-w-[180px]">
                    {s.urun_adi ?? s.sku ?? "—"}
                  </span>
                  <PaketlemeStatusBadge durum={s.durum} />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Adet:</span>
                  <span className="font-bold tabular-nums">{s.qty}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Süre:</span>
                  <span className="tabular-nums">{formatDuration(s.start_time, s.end_time)}</span>
                </div>
                {s.birim_paketleme_dk != null && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">dk/birim:</span>
                    <span className="font-medium tabular-nums">{s.birim_paketleme_dk} dk</span>
                  </div>
                )}
                {workers && workers.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {workers.map((w) => w.name).join(", ")}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
