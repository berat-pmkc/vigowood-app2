"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatTime, formatDuration } from "@/lib/utils";
import { CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import { KutuDetailSheet } from "./kutu-detail-sheet";
import type { KutuSessionEnriched } from "../page";

interface TodayKutuCompletedProps {
  sessions: KutuSessionEnriched[];
}

export function TodayKutuCompleted({ sessions }: TodayKutuCompletedProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedSession, setSelectedSession] = useState<KutuSessionEnriched | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Bugün henüz tamamlanan kutu üretimi yok
      </div>
    );
  }

  const displaySessions = expanded ? sessions : sessions.slice(0, 5);

  return (
    <div className="space-y-1">
      {displaySessions.map((session) => (
        <div
          key={session.session_id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
          onClick={() => setSelectedSession(session)}
        >
          <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{session.session_id}</span>
              {session.sku && (
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  {session.sku}
                </Badge>
              )}
            </div>
            <p className="text-sm truncate">
              {session.part_adi ?? session.part_id ?? "—"}
            </p>
          </div>

          <div className="text-right flex-shrink-0">
            <span className="font-bold tabular-nums">{session.qty}</span>
            <span className="text-xs text-muted-foreground ml-1">ad.</span>
          </div>

          <div className="text-right flex-shrink-0 text-xs text-muted-foreground hidden sm:block">
            {session.start_time && session.bitis_zamani
              ? formatDuration(session.start_time, session.bitis_zamani)
              : session.bitis_zamani
                ? formatTime(session.bitis_zamani)
                : "—"}
          </div>
        </div>
      ))}

      {sessions.length > 5 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="w-3 h-3 mr-1" /> Daha az göster
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3 mr-1" /> {sessions.length - 5} üretim daha
            </>
          )}
        </Button>
      )}

      {selectedSession && (
        <KutuDetailSheet
          session={selectedSession}
          open={!!selectedSession}
          onOpenChange={(open) => {
            if (!open) setSelectedSession(null);
          }}
        />
      )}
    </div>
  );
}
