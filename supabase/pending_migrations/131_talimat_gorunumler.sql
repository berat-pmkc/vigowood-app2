-- =============================================================
-- 131: İş talimatı / talep görünümleri (ilerleme, durum, özetler)
-- Tüm görünümler security_invoker: altındaki tabloların RLS'i geçerli.
-- Hafta sınırları Europe/Istanbul: [Pzt 00:00, sonraki Pzt 00:00).
-- =============================================================

-- JSON "workers" dizisi ([{id,name},...]) içinde personel var mı
CREATE OR REPLACE FUNCTION public.talimat_workers_icerir(p_workers JSONB, p_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_workers IS NOT NULL
     AND jsonb_typeof(p_workers) = 'array'
     AND p_workers @> jsonb_build_array(jsonb_build_object('id', p_id));
$$;

-- pack_events.personel ("VW001,VW002") veya workers JSON'unda personel var mı
CREATE OR REPLACE FUNCTION public.talimat_pack_personel_mi(p_personel TEXT, p_workers JSONB, p_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_personel IS NOT NULL
          AND p_id = ANY (string_to_array(replace(p_personel, ' ', ''), ',')))
      OR public.talimat_workers_icerir(p_workers, p_id);
$$;

GRANT EXECUTE ON FUNCTION public.talimat_workers_icerir(JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.talimat_pack_personel_mi(TEXT, JSONB, TEXT) TO authenticated;

-- ── 1) Satır + plan + etkin pasif/istasyon (hafif; ilerleme hesabı yok) ─────
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
  ) AS etkin_pasif
FROM public.talimat_satirlar s
JOIN public.talimat_planlar p ON p.plan_id = s.plan_id;

-- ── 2) İlerleme görünümü ─────────────────────────────────────
-- uretilen:
--   montaj    -> sku'nun BİTİŞ adımı (is_final_step) montaj seansları qty toplamı (haftada, TÜM personel)
--   paketleme -> sku'nun bu personelin katıldığı tamamlanmış paketleme seansları qty (haftada)
--   kesim     -> talimat_satir_id ile bağlı kesimler + (bağsız) bu personelin aynı plaka/sku kesimleri (adet)
-- paketlemeye_hazir: haftalık bitiş-adımı montaj qty - haftalık paketleme qty (tüm personel, >=0; yaklaşık)
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
  COALESCE((SELECT ts.miktar FROM public.urun_toplam_stok ts WHERE ts.sku = e.sku), 0) AS toplam_stok
FROM public.talimat_satir_etkin e
LEFT JOIN public.products pd ON pd.sku = e.sku
LEFT JOIN public.users u ON u.user_id = e.personel_id
CROSS JOIN LATERAL (
  SELECT CASE e.etkin_istasyon
    WHEN 'montaj' THEN COALESCE((
      SELECT sum(ms.qty) FROM public.montaj_sessions ms
      WHERE ms.sku = e.sku AND ms.is_final_step AND ms.durum = 'tamamlandi'
        AND COALESCE(ms.end_time, ms.start_time) >= e.hafta_bas_ts
        AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts), 0)
    WHEN 'paketleme' THEN COALESCE((
      SELECT sum(pe.qty) FROM public.pack_events pe
      WHERE pe.sku = e.sku AND pe.durum = 'tamamlandi'
        AND COALESCE(pe.end_time, pe.tarih) >= e.hafta_bas_ts
        AND COALESCE(pe.end_time, pe.tarih) <  e.hafta_son_ts
        AND (pe.talimat_satir_id = e.satir_id
             OR public.talimat_pack_personel_mi(pe.personel, pe.workers, e.personel_id))), 0)
    ELSE COALESCE((
      SELECT sum(cb.adet) FROM public.cut_batches cb
      WHERE cb.durum = 'tamamlandi'
        AND cb.tarih >= e.hafta_bas_ts AND cb.tarih < e.hafta_son_ts
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
        AND ms.start_time >= e.hafta_bas_ts AND ms.start_time < e.hafta_son_ts)
    WHEN 'paketleme' THEN (
      SELECT max(COALESCE(pe.start_time, pe.tarih)) FROM public.pack_events pe
      WHERE (pe.talimat_satir_id = e.satir_id
             OR (pe.sku = e.sku
                 AND public.talimat_pack_personel_mi(pe.personel, pe.workers, e.personel_id)))
        AND COALESCE(pe.start_time, pe.tarih) >= e.hafta_bas_ts
        AND COALESCE(pe.start_time, pe.tarih) <  e.hafta_son_ts)
    ELSE (
      SELECT max(cb.tarih) FROM public.cut_batches cb
      WHERE (cb.talimat_satir_id = e.satir_id
             OR (cb.operator_id = e.personel_id
                 AND ((e.plaka_id IS NOT NULL AND cb.plaka_id = e.plaka_id)
                      OR (e.plaka_id IS NULL AND cb.sku = e.sku))))
        AND cb.tarih >= e.hafta_bas_ts AND cb.tarih < e.hafta_son_ts)
  END AS son_seans_at
) sn;

-- ── 3) Montaj satırı katkı dağılımı (personel x adım) ────────
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
 AND COALESCE(ms.end_time, ms.start_time) >= e.hafta_bas_ts
 AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts
WHERE e.etkin_istasyon = 'montaj'
GROUP BY e.satir_id, ms.operator_id, ms.step_id, ms.step_name, ms.seq_no, ms.is_final_step;

-- ── 4) Plan özeti (güncellik + sayılar) ──────────────────────
CREATE OR REPLACE VIEW public.talimat_plan_ozet AS
SELECT
  p.plan_id, p.hafta_baslangic, p.durum, p.yayinlandi_at, p.pasif_at,
  p.pazartesi_bildirim_at, p.degisen_personeller, p.kaynak_plan_id, p.olusturan,
  p.created_at, p.updated_at,
  g.bitis AS guncel_bitis,
  COALESCE(g.bitis >= public.talimat_bugun(), false) AS guncel_mi,
  (SELECT count(*) FROM public.talimat_satirlar s WHERE s.plan_id = p.plan_id) AS satir_sayisi,
  (SELECT count(*) FROM public.talimat_satirlar s WHERE s.plan_id = p.plan_id AND s.degisti) AS degisen_satir_sayisi,
  (SELECT count(DISTINCT s.personel_id) FROM public.talimat_satirlar s WHERE s.plan_id = p.plan_id) AS personel_sayisi
FROM public.talimat_planlar p
LEFT JOIN LATERAL (
  SELECT bitis FROM public.talimat_guncellik gg
  WHERE gg.plan_id = p.plan_id ORDER BY gg.created_at DESC, gg.id DESC LIMIT 1
) g ON true;

-- ── 5) Yayın özeti (onay sayıları: "4 personel görmedi") ─────
CREATE OR REPLACE VIEW public.talimat_yayin_ozet AS
SELECT
  y.yayin_id, y.plan_id, y.yayinlayan, y.bildirim_gonder, y.sesli, y.hedef,
  y.gonderim_zamani, y.durum, y.ilk_gonderim_at, y.durdurma_at, y.durduran,
  y.rapor_gonderildi_at, y.otomatik, y.satir_sayisi, y.personel_sayisi, y.snapshot, y.created_at,
  COALESCE(h.hedef_sayisi, 0)       AS hedef_sayisi,
  COALESCE(h.onay_sayisi, 0)        AS onay_sayisi,
  COALESCE(h.hedef_sayisi, 0) - COALESCE(h.onay_sayisi, 0) AS onaylamayan_sayisi,
  COALESCE(h.onaylamayanlar, '{}')  AS onaylamayanlar
FROM public.talimat_yayinlar y
LEFT JOIN LATERAL (
  SELECT count(*) AS hedef_sayisi,
         count(o.personel_id) AS onay_sayisi,
         array_agg(hh.personel_id ORDER BY hh.personel_id) FILTER (WHERE o.personel_id IS NULL) AS onaylamayanlar
  FROM public.talimat_yayin_hedefler hh
  LEFT JOIN public.talimat_onaylar o
    ON o.yayin_id = hh.yayin_id AND o.personel_id = hh.personel_id
  WHERE hh.yayin_id = y.yayin_id
) h ON true;

-- ── 6) Talep durumu (türetilmiş) ─────────────────────────────
-- durum: kapanis varsa o; bağlı satır yok -> acik; tüm bağlı satırlar pasif -> pasif;
-- uretilen >= istenen -> hazir; seans başladı -> hazirlaniyor; aksi halde is_emri_verildi.
-- uretilen (talep düzeyi): talep açıldığından beri; bağlı satırların istasyonlarına göre
--   montaj bitiş-adımı qty / paketleme qty / bağlı kesim adedi içinden EN BÜYÜĞÜ (çift sayımı önler).
CREATE OR REPLACE VIEW public.talep_durum AS
WITH bagli AS (
  SELECT e.talep_id,
         count(*)                                  AS satir_sayisi,
         count(*) FILTER (WHERE e.etkin_pasif)     AS pasif_sayisi,
         array_agg(DISTINCT e.personel_id)         AS personeller,
         array_agg(DISTINCT e.etkin_istasyon)      AS istasyonlar,
         array_agg(e.satir_id)                     AS satir_ids
  FROM public.talimat_satir_etkin e
  WHERE e.talep_id IS NOT NULL
  GROUP BY e.talep_id
)
SELECT
  t.talep_id, t.talep_no, t.sku, pd.urun_adi, t.hedef_depo_id, d.ad AS depo_adi,
  t.istenen_miktar, t.termin_tarihi, t.aciklama,
  t.olusturan, u.full_name AS olusturan_adi,
  t.created_at, t.updated_at,
  t.kapanis, t.kapanis_neden, t.kapanis_at, t.kapatan,
  CASE
    WHEN t.kapanis IS NOT NULL THEN t.kapanis
    WHEN b.talep_id IS NULL THEN 'acik'
    WHEN b.pasif_sayisi = b.satir_sayisi THEN 'pasif'
    WHEN t.istenen_miktar IS NOT NULL AND pr.uretilen >= t.istenen_miktar THEN 'hazir'
    WHEN pr.seans_basladi THEN 'hazirlaniyor'
    ELSE 'is_emri_verildi'
  END AS durum,
  COALESCE(b.satir_sayisi, 0) AS bagli_satir_sayisi,
  COALESCE(b.personeller, '{}') AS atanan_personeller,
  COALESCE(pr.uretilen, 0) AS uretilen,
  CASE WHEN t.istenen_miktar IS NOT NULL THEN GREATEST(t.istenen_miktar - COALESCE(pr.uretilen, 0), 0) END AS kalan,
  (t.created_at + interval '10 minutes') AS serbest_duzenleme_bitis,
  (now() <= t.created_at + interval '10 minutes') AS serbest_mi,
  COALESCE((SELECT ts.miktar FROM public.urun_toplam_stok ts WHERE ts.sku = t.sku), 0) AS toplam_stok,
  CASE WHEN t.hedef_depo_id IS NOT NULL THEN
    COALESCE((SELECT sum(ds.miktar) FROM public.urun_depo_stok ds
              WHERE ds.sku = t.sku AND ds.depo_id = t.hedef_depo_id), 0)
  END AS depo_stok
FROM public.talepler t
LEFT JOIN public.products pd ON pd.sku = t.sku
LEFT JOIN public.depolar d ON d.depo_id = t.hedef_depo_id
LEFT JOIN public.users u ON u.user_id = t.olusturan
LEFT JOIN bagli b ON b.talep_id = t.talep_id
LEFT JOIN LATERAL (
  SELECT
    GREATEST(
      CASE WHEN 'montaj' = ANY (b.istasyonlar) THEN COALESCE((
        SELECT sum(ms.qty) FROM public.montaj_sessions ms
        WHERE ms.sku = t.sku AND ms.is_final_step AND ms.durum = 'tamamlandi'
          AND COALESCE(ms.end_time, ms.start_time) >= t.created_at), 0) ELSE 0 END,
      CASE WHEN 'paketleme' = ANY (b.istasyonlar) THEN COALESCE((
        SELECT sum(pe.qty) FROM public.pack_events pe
        WHERE pe.sku = t.sku AND pe.durum = 'tamamlandi'
          AND COALESCE(pe.end_time, pe.tarih) >= t.created_at), 0) ELSE 0 END,
      CASE WHEN 'kesim' = ANY (b.istasyonlar) THEN COALESCE((
        SELECT sum(cb.adet) FROM public.cut_batches cb
        WHERE cb.durum = 'tamamlandi' AND cb.talimat_satir_id = ANY (b.satir_ids)), 0) ELSE 0 END
    ) AS uretilen,
    (
      ('montaj' = ANY (b.istasyonlar) AND EXISTS (
         SELECT 1 FROM public.montaj_sessions ms
         WHERE ms.sku = t.sku AND ms.start_time >= t.created_at))
      OR ('paketleme' = ANY (b.istasyonlar) AND EXISTS (
         SELECT 1 FROM public.pack_events pe
         WHERE pe.sku = t.sku AND COALESCE(pe.start_time, pe.tarih) >= t.created_at))
      OR ('kesim' = ANY (b.istasyonlar) AND EXISTS (
         SELECT 1 FROM public.cut_batches cb WHERE cb.talimat_satir_id = ANY (b.satir_ids)))
    ) AS seans_basladi
) pr ON true;

-- ── Görünüm ayarları ─────────────────────────────────────────
ALTER VIEW public.talimat_satir_etkin    SET (security_invoker = true);
ALTER VIEW public.talimat_satir_ilerleme SET (security_invoker = true);
ALTER VIEW public.talimat_satir_katki    SET (security_invoker = true);
ALTER VIEW public.talimat_plan_ozet      SET (security_invoker = true);
ALTER VIEW public.talimat_yayin_ozet     SET (security_invoker = true);
ALTER VIEW public.talep_durum            SET (security_invoker = true);

GRANT SELECT ON public.talimat_satir_etkin    TO authenticated;
GRANT SELECT ON public.talimat_satir_ilerleme TO authenticated;
GRANT SELECT ON public.talimat_satir_katki    TO authenticated;
GRANT SELECT ON public.talimat_plan_ozet      TO authenticated;
GRANT SELECT ON public.talimat_yayin_ozet     TO authenticated;
GRANT SELECT ON public.talep_durum            TO authenticated;
