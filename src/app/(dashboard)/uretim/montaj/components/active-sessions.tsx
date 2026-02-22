"use client";

import { SessionCard, type ActiveMontajSession } from "./session-card";
import { Wrench } from "lucide-react";

interface ActiveSessionsProps {
  sessions: ActiveMontajSession[];
  onClose: (session: ActiveMontajSession) => void;
  onCancel: (sessionId: string) => void;
}

export function ActiveSessions({ sessions, onClose, onCancel }: ActiveSessionsProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Wrench className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">Devam eden montaj seansı yok</p>
        <p className="text-xs mt-1">Yeni seans başlatmak için &quot;Yeni Seans&quot; butonunu kullanın</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
      {sessions.map((session) => (
        <SessionCard
          key={session.session_id}
          session={session}
          onClose={onClose}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}
