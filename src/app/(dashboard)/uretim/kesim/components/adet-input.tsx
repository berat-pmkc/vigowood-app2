"use client";

import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AdetInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

const QUICK_VALUES = [1, 5, 10, 15, 20];

export function AdetInput({ value, onChange, min = 1, max = 100 }: AdetInputProps) {
  const decrease = () => onChange(Math.max(min, value - 1));
  const increase = () => onChange(Math.min(max, value + 1));

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex items-center gap-6">
        <Button
          type="button"
          variant="outline"
          className="w-16 h-16 rounded-full text-2xl"
          onClick={decrease}
          disabled={value <= min}
        >
          <Minus className="w-6 h-6" />
        </Button>

        <span className="text-5xl font-bold text-vw-dark min-w-[80px] text-center tabular-nums">
          {value}
        </span>

        <Button
          type="button"
          variant="outline"
          className="w-16 h-16 rounded-full text-2xl"
          onClick={increase}
          disabled={value >= max}
        >
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <div className="flex gap-2">
        {QUICK_VALUES.map((qv) => (
          <Button
            key={qv}
            type="button"
            variant={value === qv ? "default" : "outline"}
            className="h-10 px-4 text-sm"
            onClick={() => onChange(qv)}
          >
            {qv}
          </Button>
        ))}
      </div>
    </div>
  );
}
