"use client";

import { useState, useMemo } from "react";
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

type DateFilter = "bugun" | "dun" | "bu_hafta" | "gecen_hafta" | "bu_ay" | "gecen_ay";

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: "bugun", label: "Bugün" },
  { key: "dun", label: "Dün" },
  { key: "bu_hafta", label: "Bu Hafta" },
  { key: "gecen_hafta", label: "Geçen Hafta" },
  { key: "bu_ay", label: "Bu Ay" },
  { key: "gecen_ay", label: "Geçen Ay" },
];

function getDateRange(filter: DateFilter): { start: Date; end: Date } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrowStart = new Date(todayStart);
  tomorrowStart.setDate(tomorrowStart.getDate() + 1);

  switch (filter) {
    case "bugun":
      return { start: todayStart, end: tomorrowStart };
    case "dun": {
      const yesterdayStart = new Date(todayStart);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      return { start: yesterdayStart, end: todayStart };
    }
    case "bu_hafta": {
      const day = todayStart.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      const weekStart = new Date(todayStart);
      weekStart.setDate(weekStart.getDate() - mondayOffset);
      return { start: weekStart, end: tomorrowStart };
    }
    case "gecen_hafta": {
      const day = todayStart.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      const thisWeekStart = new Date(todayStart);
      thisWeekStart.setDate(thisWeekStart.getDate() - mondayOffset);
      const lastWeekStart = new Date(thisWeekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      return { start: lastWeekStart, end: thisWeekStart };
    }
    case "bu_ay": {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart, end: tomorrowStart };
    }
    case "gecen_ay": {
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: lastMonthStart, end: thisMonthStart };
    }
  }
}

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
  const [activeFilter, setActiveFilter] = useState<DateFilter>("bugun");

  const filteredSessions = useMemo(() => {
    const { start, end } = getDateRange(activeFilter);
    return sessions.filter((s) => {
      if (!s.end_time) return false;
      const endDate = new Date(s.end_time);
      return endDate >= start && endDate < end;
    });
  }, [sessions, activeFilter]);

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
              {filteredSessions.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold px-1.5">
                  {filteredSessions.length}
                </span>
              )}
            </SheetTitle>
          </SheetHeader>

          {/* Quick date filters */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  activeFilter === f.key
                    ? "bg-emerald-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {filteredSessions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Bu dönemde tamamlanan seans yok
              </p>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map((s) => {
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
