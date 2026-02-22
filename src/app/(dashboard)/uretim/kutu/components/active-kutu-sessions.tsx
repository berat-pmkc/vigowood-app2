"use client";

import { ActiveKutuCard } from "./active-kutu-card";
import { Box } from "lucide-react";
import type { KutuSessionEnriched } from "../page";

interface ActiveKutuSessionsProps {
  sessions: KutuSessionEnriched[];
}

export function ActiveKutuSessions({ sessions }: ActiveKutuSessionsProps) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Box className="w-12 h-12 mb-3 opacity-30" />
        <p className="text-sm">Aktif kutu üretimi yok</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {sessions.map((session) => (
        <ActiveKutuCard key={session.session_id} session={session} />
      ))}
    </div>
  );
}
