"use client";

import { SessionCard, type ActiveSession } from "./session-card";
import { Clock } from "lucide-react";

interface ActiveSessionsProps {
  sessions: ActiveSession[];
  onClose: (session: ActiveSession) => void;
  onCancel: (sessionId: string) => void;
}

export function ActiveSessions({ sessions, onClose, onCancel }: ActiveSessionsProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-10 h-10 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Devam eden seans yok</p>
        <p className="text-xs mt-1">Yeni seans başlatmak için + butonuna tıklayın</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
