"use client";

import { SessionCard, type ActiveMontajSession } from "./session-card";
import { Wrench } from "lucide-react";
import type { TalimatHat } from "@/lib/talimat/types";
import { hataGoreSeansGrupla, hatRengi } from "@/lib/talimat/tablet-hat";

interface ActiveSessionsProps {
  sessions: ActiveMontajSession[];
  hatlar: TalimatHat[];
  onClose: (session: ActiveMontajSession) => void;
  onCancel: (sessionId: string) => void;
  onToggleBeklet?: (sessionId: string) => Promise<void> | void;
  canCancel: boolean;
}

export function ActiveSessions({ sessions, hatlar, onClose, onCancel, onToggleBeklet, canCancel }: ActiveSessionsProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Devam eden montaj seansı yok</p>
        <p className="text-xs mt-1">Yeni seans başlatmak için &quot;Yeni Seans&quot; butonunu kullanın</p>
      </div>
    );
  }

  // Hat kategorilerine göre (hat sırası), hatsız eski seanslar en sonda
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {g.items.map((session) => (
              <SessionCard
                key={session.session_id}
                session={session}
                onClose={onClose}
                onCancel={onCancel}
                onToggleBeklet={onToggleBeklet}
                canCancel={canCancel}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
