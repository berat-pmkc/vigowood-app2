"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { PaketlemeStatusBadge } from "./paketleme-status-badge";
import { EditSessionDialog } from "./edit-session-dialog";
import { formatDuration } from "@/lib/utils";
import { CheckCircle, Users, Pencil } from "lucide-react";

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

interface CompletedSessionsSheetProps {
  sessions: CompletedSession[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompletedSessionsSheet({ sessions, open, onOpenChange }: CompletedSessionsSheetProps) {
  const [editSession, setEditSession] = useState<CompletedSession | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const handleEdit = (s: CompletedSession) => {
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
                  const workers = s.workers as Array<{ id: string; name: string }> | null;
                  return (
                    <div
                      key={s.session_id}
                      className="border rounded-lg p-3 space-y-2 hover:bg-muted/30 transition-colors"
                    >
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm truncate max-w-[200px]">
                          {s.urun_adi ?? s.sku ?? "—"}
                        </span>
                        <div className="flex items-center gap-1">
                          <PaketlemeStatusBadge durum={s.durum} />
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
                            {s.birim_paketleme_dk != null ? `${s.birim_paketleme_dk}` : "—"}
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

                      {/* SKU + date */}
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        {s.sku && <span>{s.sku}</span>}
                        {s.end_time && (
                          <span>
                            {new Date(s.end_time).toLocaleDateString("tr-TR", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
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
