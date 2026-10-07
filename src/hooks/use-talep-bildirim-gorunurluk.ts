"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTalepBildirimleri, type TalepBildirimOlay } from "@/hooks/use-talep-bildirimleri";

const GORUNUR_ORAN = 0.6;
const GORUNUR_MS = 1000;
const TOPLU_MS = 400;

/**
 * /talepler: ekranda (>=%60, >=1 sn) görünen satırların bildirimlerini "görüldü" yapar.
 * Hiç görünmeyen satırların bildirimi okunmamış kalır.
 * @param satirAnahtari listedeki talep id'lerinin birleşimi (liste değişince yeniden gözlemlemek için)
 * @returns okunmamisTalepler: talep_id -> en son olay (satır işareti için)
 */
export function useTalepBildirimGorunurluk(satirAnahtari: string) {
  const { okunmamis, yerelGoruldu, supabase } = useTalepBildirimleri(true);

  const talepBazli = useMemo(() => {
    const m = new Map<string, { olay: TalepBildirimOlay; ids: string[] }>();
    // okunmamis: yeni -> eski sıralı; ilk görülen en son olaydır
    for (const b of okunmamis) {
      const e = m.get(b.talep_id);
      if (e) e.ids.push(b.id);
      else m.set(b.talep_id, { olay: b.olay, ids: [b.id] });
    }
    return m;
  }, [okunmamis]);

  const talepBazliRef = useRef(talepBazli);
  talepBazliRef.current = talepBazli;
  const bekleyen = useRef<Set<string>>(new Set());
  const topluZamanlayici = useRef<number | null>(null);

  const gonder = useRef(async () => {});
  gonder.current = async () => {
    topluZamanlayici.current = null;
    const ids = [...bekleyen.current];
    bekleyen.current.clear();
    if (ids.length === 0) return;
    yerelGoruldu(ids);
    const { error } = await (
      supabase as unknown as { rpc: (fn: string, a: Record<string, unknown>) => Promise<{ error: unknown }> }
    ).rpc("talep_bildirim_goruldu", { p_ids: ids });
    if (error) console.error("talep_bildirim_goruldu", error);
  };

  const idAnahtari = useMemo(() => [...talepBazli.keys()].sort().join("|"), [talepBazli]);

  useEffect(() => {
    if (!idAnahtari) return;
    const hedefler = idAnahtari.split("|");
    const zamanlayicilar = new Map<string, number>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          const tid = el.dataset.talepId;
          if (!tid) continue;
          const vh = entry.rootBounds?.height ?? window.innerHeight;
          const yeterli =
            entry.isIntersecting &&
            (entry.intersectionRatio >= GORUNUR_ORAN || entry.intersectionRect.height >= vh * GORUNUR_ORAN);
          const mevcut = zamanlayicilar.get(tid);
          if (yeterli && mevcut === undefined) {
            zamanlayicilar.set(
              tid,
              window.setTimeout(() => {
                zamanlayicilar.delete(tid);
                if (document.visibilityState !== "visible") return;
                const kayit = talepBazliRef.current.get(tid);
                if (!kayit) return;
                for (const id of kayit.ids) bekleyen.current.add(id);
                if (topluZamanlayici.current === null) {
                  topluZamanlayici.current = window.setTimeout(() => void gonder.current(), TOPLU_MS);
                }
              }, GORUNUR_MS),
            );
          } else if (!yeterli && mevcut !== undefined) {
            window.clearTimeout(mevcut);
            zamanlayicilar.delete(tid);
          }
        }
      },
      { threshold: [0, 0.25, GORUNUR_ORAN, 0.9, 1] },
    );

    for (const tid of hedefler) {
      const el = document.querySelector<HTMLElement>(`[data-talep-id="${tid}"]`);
      if (el) io.observe(el);
    }

    return () => {
      io.disconnect();
      zamanlayicilar.forEach((z) => window.clearTimeout(z));
    };
  }, [idAnahtari, satirAnahtari]);

  // /talepler?bildirim=1 -> ilk okunmamış satıra kaydır (bir kez)
  const kaydirildi = useRef(false);
  useEffect(() => {
    if (kaydirildi.current || !idAnahtari) return;
    if (new URLSearchParams(window.location.search).get("bildirim") !== "1") return;
    const rows = document.querySelectorAll<HTMLElement>("[data-talep-id]");
    for (const r of rows) {
      if (talepBazli.has(r.dataset.talepId ?? "")) {
        kaydirildi.current = true;
        r.scrollIntoView({ block: "center", behavior: "smooth" });
        break;
      }
    }
  }, [idAnahtari, satirAnahtari, talepBazli]);

  // sayfadan çıkarken bekleyenleri gönder
  useEffect(() => {
    return () => {
      if (topluZamanlayici.current !== null) {
        window.clearTimeout(topluZamanlayici.current);
        void gonder.current();
      }
    };
  }, []);

  return { okunmamisTalepler: talepBazli };
}
