-- =============================================================
-- 154: Talimat satırı sayaç sıfırlama ("Tekrar aktif et")
-- talimat_satirlar.sayac_baslangic (NULL = plan haftası başlangıcı): satır
-- üretilen/katkı/son seans hesapları yalnızca greatest(hafta başı, sayac_baslangic)
-- ve sonrasında KAPANAN seanslar için sayılır. Böylece tamamlanan bir iş yeniden
-- aktif edilirken yeni istenen, önceki üretilenden büyük olmak zorunda kalmaz.
-- talep_durum (talep düzeyi üretilen) DEĞİŞMEZ: talep açıldığından beri kümülatif
-- kalır, satır üretilenini okumaz.
-- Görünümlerde yeni kolonlar sona eklenir.
-- =============================================================

ALTER TABLE public.talimat_satirlar ADD COLUMN IF NOT EXISTS sayac_baslangic TIMESTAMPTZ;

-- ── 1) etkin: sayac_baslangic + sayac_bas_ts (sona) ──
CREATE OR REPLACE VIEW public.talimat_satir_etkin AS
SELECT
  s.satir_id, s.plan_id, s.personel_id, s.sira, s.istasyon, s.sku, s.plaka_id,
  s.istenen_miktar, s.not_text, s.talep_id, s.durum,
  s.pasif_neden, s.pasif_baslangic, s.pasif_until,
  s.degisti, s.onay_bekliyor, s.created_at, s.updated_at,
  p.hafta_baslangic,
  p.durum AS plan_durum,
  (p.hafta_baslangic::timestamp AT TIME ZONE 'Europe/Istanbul')        AS hafta_bas_ts,
  ((p.hafta_baslangic + 7)::timestamp AT TIME ZONE 'Europe/Istanbul')  AS hafta_son_ts,
  COALESCE(s.istasyon, CASE WHEN s.plaka_id IS NOT NULL THEN 'kesim' ELSE 'montaj' END) AS etkin_istasyon,
  (
    (s.durum = 'pasif'
       AND (s.pasif_baslangic IS NULL OR s.pasif_baslangic <= public.talimat_bugun())
       AND (s.pasif_until IS NULL OR s.pasif_until >= public.talimat_bugun()))
    OR EXISTS (
      SELECT 1 FROM public.talimat_pasifler tp
      WHERE tp.plan_id = s.plan_id
        AND tp.iptal_at IS NULL
        AND public.talimat_bugun() BETWEEN tp.baslangic AND tp.bitis
        AND (tp.kapsam = 'liste' OR (tp.kapsam = 'personel' AND tp.personel_id = s.personel_id))
    )
  ) AS etkin_pasif,
  s.sayac_baslangic,
  GREATEST((p.hafta_baslangic::timestamp AT TIME ZONE 'Europe/Istanbul'),
           COALESCE(s.sayac_baslangic, (p.hafta_baslangic::timestamp AT TIME ZONE 'Europe/Istanbul'))) AS sayac_bas_ts
FROM public.talimat_satirlar s
JOIN public.talimat_planlar p ON p.plan_id = s.plan_id;

-- ── 2) ilerleme: üretilen + son seans sayac_bas_ts'ten itibaren ──
-- (paketlemeye_hazir ürün düzeyi haftalık değerdir; sayaçtan etkilenmez)
CREATE OR REPLACE VIEW public.talimat_satir_ilerleme AS
SELECT
  e.satir_id, e.plan_id, e.personel_id, e.sira, e.istasyon, e.etkin_istasyon,
  e.sku, e.plaka_id, e.istenen_miktar, e.not_text, e.talep_id, e.durum,
  e.pasif_neden, e.pasif_baslangic, e.pasif_until,
  e.degisti, e.onay_bekliyor,
  (e.degisti OR e.onay_bekliyor) AS kirmizi,
  e.hafta_baslangic, e.plan_durum, e.etkin_pasif,
  pr.uretilen,
  CASE WHEN e.istenen_miktar IS NOT NULL THEN e.istenen_miktar - pr.uretilen END AS fark,
  (e.durum = 'tamamlandi'
     OR (e.istenen_miktar IS NOT NULL AND pr.uretilen >= e.istenen_miktar)) AS tamamlandi_mi,
  CASE
    WHEN e.etkin_pasif THEN 'pasif'
    WHEN e.durum = 'tamamlandi'
      OR (e.istenen_miktar IS NOT NULL AND pr.uretilen >= e.istenen_miktar) THEN 'tamamlandi'
    ELSE 'aktif'
  END AS etkin_durum,
  CASE WHEN e.etkin_istasyon = 'montaj' THEN ph.paketlemeye_hazir END AS paketlemeye_hazir,
  sn.son_seans_at,
  (sn.son_seans_at IS NOT NULL) AS hafta_seans_var,
  COALESCE(sn.son_seans_at >= (public.talimat_bugun()::timestamp AT TIME ZONE 'Europe/Istanbul'), false) AS bugun_seans_var,
  pd.urun_adi,
  u.full_name AS personel_adi,
  u.station::text AS personel_istasyon,
  (SELECT pl.plaka_adi FROM public.plakalar pl WHERE pl.plaka_id = e.plaka_id LIMIT 1) AS plaka_adi,
  COALESCE((SELECT ts.miktar FROM public.urun_toplam_stok ts WHERE ts.sku = e.sku), 0) AS toplam_stok,
  e.sayac_baslangic
FROM public.talimat_satir_etkin e
LEFT JOIN public.products pd ON pd.sku = e.sku
LEFT JOIN public.users u ON u.user_id = e.personel_id
CROSS JOIN LATERAL (
  SELECT CASE e.etkin_istasyon
    WHEN 'montaj' THEN COALESCE((
      SELECT sum(ms.qty) FROM public.montaj_sessions ms
      WHERE ms.sku = e.sku AND ms.is_final_step AND ms.durum = 'tamamlandi'
        AND COALESCE(ms.end_time, ms.start_time) >= e.sayac_bas_ts
        AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts), 0)
    WHEN 'paketleme' THEN COALESCE((
      SELECT sum(pe.qty) FROM public.pack_events pe
      WHERE pe.sku = e.sku AND pe.durum = 'tamamlandi'
        AND COALESCE(pe.end_time, pe.tarih) >= e.sayac_bas_ts
        AND COALESCE(pe.end_time, pe.tarih) <  e.hafta_son_ts
        AND (pe.talimat_satir_id = e.satir_id
             OR public.talimat_pack_personel_mi(pe.personel, pe.workers, e.personel_id))), 0)
    ELSE COALESCE((
      SELECT sum(cb.adet) FROM public.cut_batches cb
      WHERE cb.durum = 'tamamlandi'
        AND cb.tarih >= e.sayac_bas_ts AND cb.tarih < e.hafta_son_ts
        AND (cb.talimat_satir_id = e.satir_id
             OR (cb.talimat_satir_id IS NULL AND cb.operator_id = e.personel_id
                 AND ((e.plaka_id IS NOT NULL AND cb.plaka_id = e.plaka_id)
                      OR (e.plaka_id IS NULL AND cb.sku = e.sku))))), 0)
  END AS uretilen
) pr
CROSS JOIN LATERAL (
  SELECT GREATEST(
    COALESCE((
      SELECT sum(ms.qty) FROM public.montaj_sessions ms
      WHERE ms.sku = e.sku AND ms.is_final_step AND ms.durum = 'tamamlandi'
        AND COALESCE(ms.end_time, ms.start_time) >= e.hafta_bas_ts
        AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts), 0)
    - COALESCE((
      SELECT sum(pe.qty) FROM public.pack_events pe
      WHERE pe.sku = e.sku AND pe.durum = 'tamamlandi'
        AND COALESCE(pe.end_time, pe.tarih) >= e.hafta_bas_ts
        AND COALESCE(pe.end_time, pe.tarih) <  e.hafta_son_ts), 0),
    0) AS paketlemeye_hazir
) ph
CROSS JOIN LATERAL (
  SELECT CASE e.etkin_istasyon
    WHEN 'montaj' THEN (
      SELECT max(ms.start_time) FROM public.montaj_sessions ms
      WHERE (ms.talimat_satir_id = e.satir_id
             OR (ms.sku = e.sku
                 AND (ms.operator_id = e.personel_id
                      OR public.talimat_workers_icerir(ms.workers, e.personel_id))))
        AND ms.start_time >= e.sayac_bas_ts AND ms.start_time < e.hafta_son_ts)
    WHEN 'paketleme' THEN (
      SELECT max(COALESCE(pe.start_time, pe.tarih)) FROM public.pack_events pe
      WHERE (pe.talimat_satir_id = e.satir_id
             OR (pe.sku = e.sku
                 AND public.talimat_pack_personel_mi(pe.personel, pe.workers, e.personel_id)))
        AND COALESCE(pe.start_time, pe.tarih) >= e.sayac_bas_ts
        AND COALESCE(pe.start_time, pe.tarih) <  e.hafta_son_ts)
    ELSE (
      SELECT max(cb.tarih) FROM public.cut_batches cb
      WHERE (cb.talimat_satir_id = e.satir_id
             OR (cb.operator_id = e.personel_id
                 AND ((e.plaka_id IS NOT NULL AND cb.plaka_id = e.plaka_id)
                      OR (e.plaka_id IS NULL AND cb.sku = e.sku))))
        AND cb.tarih >= e.sayac_bas_ts AND cb.tarih < e.hafta_son_ts)
  END AS son_seans_at
) sn;

-- ── 3) katkı: sayaçtan itibaren ──
CREATE OR REPLACE VIEW public.talimat_satir_katki AS
SELECT
  e.satir_id,
  ms.operator_id AS personel_id,
  ms.step_id, ms.step_name, ms.seq_no, ms.is_final_step,
  sum(ms.qty)  AS qty,
  count(*)     AS seans_sayisi
FROM public.talimat_satir_etkin e
JOIN public.montaj_sessions ms
  ON ms.sku = e.sku
 AND ms.durum = 'tamamlandi'
 AND COALESCE(ms.end_time, ms.start_time) >= e.sayac_bas_ts
 AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts
WHERE e.etkin_istasyon = 'montaj'
GROUP BY e.satir_id, ms.operator_id, ms.step_id, ms.step_name, ms.seq_no, ms.is_final_step;

ALTER VIEW public.talimat_satir_etkin    SET (security_invoker = true);
ALTER VIEW public.talimat_satir_ilerleme SET (security_invoker = true);
ALTER VIEW public.talimat_satir_katki    SET (security_invoker = true);
GRANT SELECT ON public.talimat_satir_etkin    TO authenticated;
GRANT SELECT ON public.talimat_satir_ilerleme TO authenticated;
GRANT SELECT ON public.talimat_satir_katki    TO authenticated;

-- ── 4) RPC: yeniden aktif et (sayaç sıfırla) ──
CREATE OR REPLACE FUNCTION public.talimat_satir_yeniden_aktif(p_satir UUID, p_istenen NUMERIC)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.talimat_satirlar%ROWTYPE;
  v_plan public.talimat_planlar%ROWTYPE;
  v_bos BOOLEAN;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  IF p_istenen IS NULL OR p_istenen <= 0 THEN
    RAISE EXCEPTION 'Geçerli bir istenen miktar girin';
  END IF;
  SELECT * INTO v_s FROM public.talimat_satirlar WHERE satir_id = p_satir FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Satır bulunamadı'; END IF;
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = v_s.plan_id;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

  v_bos := v_s.sku IS NULL AND v_s.plaka_id IS NULL;

  UPDATE public.talimat_satirlar SET
    sayac_baslangic = now(),
    istenen_miktar = p_istenen,
    durum = CASE WHEN durum = 'tamamlandi' THEN 'aktif' ELSE durum END,
    degisti = degisti OR (v_plan.durum = 'yayinda' AND NOT v_bos)
  WHERE satir_id = p_satir;

  IF v_plan.durum = 'yayinda' AND NOT v_bos THEN
    PERFORM public.talimat_degisen_isaretle(v_s.plan_id, v_s.personel_id);
  END IF;
  RETURN p_satir;
END;
$$;

REVOKE ALL ON FUNCTION public.talimat_satir_yeniden_aktif(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_satir_yeniden_aktif(UUID, NUMERIC) TO authenticated;
