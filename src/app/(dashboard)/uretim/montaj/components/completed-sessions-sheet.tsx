"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MontajSessionStatusBadge } from "./montaj-session-status-badge";
import { EditSessionDialog } from "./edit-session-dialog";
import { formatDuration } from "@/lib/utils";
import { getSkuBadgeStyle } from "@/lib/sku-colors";
import { CheckCircle, Users, Pencil } from "lucide-react";
import { parseWorkers } from "../utils";

export interface CompletedMontajSession {
  session_id: string;
  sku: string;
  urun_adi?: string;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean | null;
  qty: number;
  start_time: string | null;
  end_time: string | null;
  durum: string;
  worker_count: number | null;
  workers: Array<{ id: string; name: string }> | null;
  birim_montaj_dk: number | null;
}

interface CompletedSessionsSheetProps {
  sessions: CompletedMontajSession[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompletedSessionsSheet({ sessions, open, onOpenChange }: CompletedSessionsSheetProps) {
  const [editSession, setEditSession] = useState<CompletedMontajSession | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = (s: CompletedMontajSession) => {
    setEditSession(s);
    setEditOpen(true);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Tamamlanan Seanslar
            </SheetTitle>
          </SheetHeader>

          <div className="mt-4">
            {sessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Henüz tamamlanan seans yok
              </p>
            ) : (
              <div className="space-y-2">
                {sessions.map((s) => {
                  const workers = parseWorkers(s.workers);
                  const skuStyle = s.sku ? getSkuBadgeStyle(s.sku) : null;
                  return (
                    <div
                      key={s.session_id}
                      className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors"
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        {skuStyle ? (
                          <span
                            className="font-bold text-xs px-2 py-0.5 rounded truncate max-w-[200px]"
                            style={{ backgroundColor: skuStyle.backgroundColor, color: skuStyle.color }}
                          >
                            {s.sku}
                          </span>
                        ) : (
                          <span className="font-medium text-sm truncate max-w-[200px]">—</span>
                        )}
                        <div className="flex items-center gap-1">
                          <MontajSessionStatusBadge durum={s.durum} />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleEdit(s)}
                            title="Düzenle"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Step info */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">
                          Adım {s.seq_no}: {s.step_name || "—"}
                        </Badge>
                        {s.is_final_step && (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                            Son
                          </Badge>
                        )}
                      </div>

                      {/* Details */}
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs block">Adet</span>
                          <span className="font-bold tabular-nums">{s.qty}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">Süre</span>
                          <span className="tabular-nums">
                            {formatDuration(s.start_time, s.end_time)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs block">dk/birim</span>
                          <span className="font-medium tabular-nums">
                            {s.birim_montaj_dk != null ? `${s.birim_montaj_dk}` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Workers */}
                      {workers && workers.length > 0 && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Users className="w-3 h-3" />
                          {workers.map((w) => w.name).join(", ")}
                        </div>
                      )}

                      {/* Date */}
                      {s.end_time && (
                        <div className="text-xs text-muted-foreground text-right">
                          {new Date(s.end_time).toLocaleDateString("tr-TR", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <EditSessionDialog
        session={editSession}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}
