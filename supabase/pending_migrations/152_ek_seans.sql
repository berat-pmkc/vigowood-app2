-- 152: Ek Seans (plan dışı, işçinin "Ek Seans Aç" ile başlattığı montaj/paketleme seansları).
-- Yalnız düğmeyle açılanlar sayılır (açık bayrak). Planlayıcı ekranı ek_seanslar görünümünü okur.

ALTER TABLE public.montaj_sessions
  ADD COLUMN IF NOT EXISTS ek_seans BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.pack_events
  ADD COLUMN IF NOT EXISTS ek_seans BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_montaj_sessions_ek_seans ON public.montaj_sessions (start_time) WHERE ek_seans;
CREATE INDEX IF NOT EXISTS idx_pack_events_ek_seans ON public.pack_events (start_time) WHERE ek_seans;

CREATE OR REPLACE VIEW public.ek_seanslar AS
SELECT
  'montaj'::text                                   AS kaynak,
  ms.session_id,
  ms.operator_id                                   AS personel_id,
  ms.operator_name                                 AS personel_adi,
  ms.sku,
  p.urun_adi,
  ms.step_id,
  ms.step_name,
  ms.seq_no,
  ms.qty::numeric                                  AS qty,
  CASE WHEN ms.durum = 'tamamlandi' THEN 'tamamlandi'
       WHEN ms.duraklatma_baslangic IS NOT NULL THEN 'beklemede'
       ELSE 'acik' END                             AS durum,
  ms.start_time,
  ms.end_time,
  CASE WHEN ms.durum = 'tamamlandi' THEN
    COALESCE(ms.net_sure_dk,
      GREATEST(0, EXTRACT(EPOCH FROM (ms.end_time - ms.start_time)) / 60 - COALESCE(ms.duraklama_dk, 0)))
  END::numeric(12,2)                               AS net_sure_dk,
  (ms.start_time AT TIME ZONE 'Europe/Istanbul')::date AS gun
FROM public.montaj_sessions ms
LEFT JOIN public.products p ON p.sku = ms.sku
WHERE ms.ek_seans AND ms.start_time IS NOT NULL
UNION ALL
SELECT
  'paketleme'::text,
  pe.session_id,
  pe.operator_id,
  pe.operator_name,
  pe.sku,
  p.urun_adi,
  NULL::text, NULL::text, NULL::integer,
  pe.qty::numeric,
  CASE WHEN pe.durum = 'tamamlandi' THEN 'tamamlandi'
       WHEN pe.duraklatma_baslangic IS NOT NULL THEN 'beklemede'
       ELSE 'acik' END,
  pe.start_time,
  pe.end_time,
  CASE WHEN pe.durum = 'tamamlandi' AND pe.end_time IS NOT NULL THEN
    GREATEST(0, EXTRACT(EPOCH FROM (pe.end_time - pe.start_time)) / 60 - COALESCE(pe.duraklama_dk, 0))
  END::numeric(12,2),
  (pe.start_time AT TIME ZONE 'Europe/Istanbul')::date
FROM public.pack_events pe
LEFT JOIN public.products p ON p.sku = pe.sku
WHERE pe.ek_seans AND pe.start_time IS NOT NULL;

ALTER VIEW public.ek_seanslar SET (security_invoker = true);
REVOKE ALL ON public.ek_seanslar FROM PUBLIC, anon;
GRANT SELECT ON public.ek_seanslar TO authenticated;
