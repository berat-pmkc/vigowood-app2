"use client";

import { useState, useEffect, useRef } from "react";

interface LiveTimerProps {
  startTime: string;
  className?: string;
}

export function LiveTimer({ startTime, className }: LiveTimerProps) {
  const [elapsed, setElapsed] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const update = () => {
      const start = new Date(startTime).getTime();
      const diff = Date.now() - start;
      const totalSec = Math.floor(diff / 1000);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      if (hrs > 0) {
        setElapsed(`${hrs}s ${String(mins).padStart(2, "0")}dk ${String(secs).padStart(2, "0")}sn`);
      } else {
        setElapsed(`${mins}dk ${String(secs).padStart(2, "0")}sn`);
      }
    };

    update();
    intervalRef.current = setInterval(update, 1000);
    return () => clearInterval(intervalRef.current);
  }, [startTime]);

  return (
    <span className={className ?? "text-lg font-bold tabular-nums text-blue-700"}>
      {elapsed}
    </span>
  );
}
