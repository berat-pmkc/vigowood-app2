"use client";

import { SessionCard, type ActiveSession } from "./session-card";
import { Clock } from "lucide-react";
import type { TalimatHat } from "@/lib/talimat/types";
import { hataGoreSeansGrupla, hatRengi } from "@/lib/talimat/tablet-hat";

interface ActiveSessionsProps {
  sessions: ActiveSession[];
  hatlar: TalimatHat[];
  onClose: (session: ActiveSession) => void;
  onCancel: (sessionId: string) => void;
  onToggleDuraklat: (sessionId: string) => void | Promise<void>;
}

export function ActiveSessions({ sessions, hatlar, onClose, onCancel, onToggleDuraklat }: ActiveSessionsProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Devam eden seans yok</p>
        <p className="text-xs mt-1">Yeni seans başlatmak için + butonuna tıklayın</p>
      </div>
    );
  }

  const gruplar = hataGoreSeansGrupla(sessions, hatlar);

  return (
    <div className="space-y-5">
      {gruplar.map((g) => (
        <div key={g.hat?.hat_id ?? "hatsiz"}>
          <div
            className="mb-2 flex items-center gap-2 rounded-lg px-3 py-2 text-white"
            style={{ backgroundColor: hatRengi(g.hat) }}
          >
            <h3 className="min-w-0 flex-1 truncate text-sm font-bold uppercase tracking-wide">
              {g.hat?.ad ?? "Hat atanmamış"}
            </h3>
            <span className="rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">{g.items.length}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.items.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                onClose={onClose}
                onCancel={onCancel}
                onToggleDuraklat={onToggleDuraklat}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
