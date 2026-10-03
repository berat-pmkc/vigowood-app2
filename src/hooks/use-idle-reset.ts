"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const EVENTS = ["mousemove", "keydown", "touchstart", "scroll", "click"] as const;
const IDLE_MS = 5 * 60 * 1000;

/**
 * Kullanıcı 5 dk işlem yapmazsa ve URL'de filtre (search param) varsa
 * sayfayı varsayılan filtrelere sıfırlar.
 */
export function useIdleReset(enabled: boolean, idleMs: number = IDLE_MS) {
  const router = useRouter();
  const pathname = usePathname();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const fire = () => {
      if (window.location.search) router.replace(pathname);
    };
    const reset = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(fire, idleMs);
    };

    reset();
    EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [enabled, idleMs, pathname, router]);
}
