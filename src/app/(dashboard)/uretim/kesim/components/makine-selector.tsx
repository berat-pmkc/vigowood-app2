"use client";

import { Scissors, Box } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MAKINE_IDS, MAKINE_LABELS, type MakineId } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface MakineSelectorProps {
  value: MakineId | null;
  onChange: (value: MakineId) => void;
}

const MAKINE_ICONS: Record<MakineId, React.ReactNode> = {
  BÜYÜK: <Scissors className="w-8 h-8" />,
  KÜÇÜK: <Scissors className="w-6 h-6" />,
  KUTU: <Box className="w-7 h-7" />,
};

const MAKINE_DESCRIPTIONS: Record<MakineId, string> = {
  BÜYÜK: "600W lazer — büyük plakalar",
  KÜÇÜK: "300W lazer — küçük parçalar",
  KUTU: "BALA — kutu kesim",
};

export function MakineSelector({ value, onChange }: MakineSelectorProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {MAKINE_IDS.map((id) => (
        <Card
          key={id}
          className={cn(
            "flex flex-col items-center justify-center gap-3 p-6 cursor-pointer transition-all border-2",
            value === id
              ? "border-primary bg-primary/5 shadow-md"
              : "border-border hover:border-primary/50"
          )}
          onClick={() => onChange(id)}
        >
          <div className={cn(
            "p-3 rounded-full",
            value === id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          )}>
            {MAKINE_ICONS[id]}
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">{MAKINE_LABELS[id]}</p>
            <p className="text-xs text-muted-foreground mt-1">{MAKINE_DESCRIPTIONS[id]}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}
