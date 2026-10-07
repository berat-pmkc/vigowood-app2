"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DB_SCHEMA } from "@/lib/supabase/schema";

export type TalepBildirimOlay = "yeni" | "degisti" | "geri_cekildi" | "kapandi" | "yeniden_acildi";

export type TalepBildirim = {
  id: string;
  talep_id: string;
  olay: TalepBildirimOlay;
  ozet: string | null;
  olusturan: string | null;
  created_at: string;
  goruldu_at: string | null;
};

export const TALEP_BILDIRIM_OLAY_LABEL: Record<TalepBildirimOlay, string> = {
  yeni: "Yeni talep",
  degisti: "Talep değişti",
  geri_cekildi: "Talep geri çekildi",
  kapandi: "Talep kapandı",
  yeniden_acildi: "Talep yeniden açıldı",
};

/** Görüldükten 30 dk sonra silinir (cron 5 dk'da bir); bu süreyi aşanları istemci de gizler */
const GORULDU_OMUR_MS = 30 * 60 * 1000;

export function bildirimHref(b: Pick<TalepBildirim, "talep_id" | "olay">): string {
  return `/talepler?talep=${b.talep_id}${b.olay === "degisti" ? "&degisiklik=1" : ""}`;
}

type SorguZinciri = {
  from: (t: string) => {
    select: (c: string) => {
      order: (
        c: string,
        o: { ascending: boolean },
      ) => { limit: (n: number) => Promise<{ data: TalepBildirim[] | null; error: unknown }> };
    };
  };
};

/**
 * Kullanıcının kendi talep bildirimleri (RLS: yalnız kendi satırları).
 * Realtime + pencere odaklanınca yeniden çeker.
 */
export function useTalepBildirimleri(enabled = true) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<TalepBildirim[]>([]);
  const [yuklendi, setYuklendi] = useState(false);
  const kanalId = useRef(`talep-bildirim-${Math.random().toString(36).slice(2, 8)}`);

  const yenile = useCallback(async () => {
    // Tablo generated types içinde olmayabilir
    const { data, error } = await (supabase as unknown as SorguZinciri)
      .from("talep_bildirimleri")
      .select("id, talep_id, olay, ozet, olusturan, created_at, goruldu_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error || !data) return;
    const sinir = Date.now() - GORULDU_OMUR_MS;
    setItems(data.filter((b) => !b.goruldu_at || new Date(b.goruldu_at).getTime() > sinir));
    setYuklendi(true);
  }, [supabase]);

  useEffect(() => {
    if (!enabled) return;
    void yenile();
    const channel = supabase
      .channel(kanalId.current)
      .on("postgres_changes", { event: "*", schema: DB_SCHEMA, table: "talep_bildirimleri" }, () => void yenile())
      .subscribe();
    const odak = () => {
      if (document.visibilityState === "visible") void yenile();
    };
    window.addEventListener("focus", odak);
    document.addEventListener("visibilitychange", odak);
    // Pasif süresi dolanları ekrandan düşür
    const zamanlayici = window.setInterval(() => void yenile(), 60_000);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("focus", odak);
      document.removeEventListener("visibilitychange", odak);
      window.clearInterval(zamanlayici);
    };
  }, [enabled, supabase, yenile]);

  const okunmamis = useMemo(() => items.filter((b) => !b.goruldu_at), [items]);

  /** Anında yerel güncelleme (Realtime geri dönüşünü beklemeden) */
  const yerelGoruldu = useCallback((ids: string[]) => {
    const set = new Set(ids);
    const simdi = new Date().toISOString();
    setItems((p) => p.map((b) => (set.has(b.id) && !b.goruldu_at ? { ...b, goruldu_at: simdi } : b)));
  }, []);

  return { items, okunmamis, sayi: okunmamis.length, yuklendi, yenile, yerelGoruldu, supabase };
}
