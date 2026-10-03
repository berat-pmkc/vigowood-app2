-- urun_maliyet_cache: canlı DB'de migration dışı oluşturulmuştu (drift). Tanım canlıdan birebir alındı.
CREATE TABLE IF NOT EXISTS public.urun_maliyet_cache (
  sku text NOT NULL PRIMARY KEY,
  malzeme numeric,
  iscilik numeric,
  birim_maliyet numeric,
  eksik boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.urun_maliyet_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS urun_maliyet_cache_select ON public.urun_maliyet_cache;
CREATE POLICY urun_maliyet_cache_select ON public.urun_maliyet_cache
  FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.refresh_urun_maliyet_cache()
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH rate AS (
    SELECT coalesce((value->>'montaj_saat_ucreti')::numeric,174) montaj,
           coalesce((value->>'paketleme_saat_ucreti')::numeric,174) paket
    FROM app_settings WHERE key='maliyet_ayarlari'
  ),
  recete AS (
    SELECT a.sku, b.part_id, sum(b.qty_per) qty
    FROM assembly_steps a JOIN step_bom b ON b.step_id=a.step_id
    JOIN products pr ON pr.sku=a.sku AND pr.aktif_mi=true
    WHERE b.part_id NOT LIKE 'ASM-%'
    GROUP BY a.sku, b.part_id
  ),
  pbest AS (
    SELECT pp.part_id, pl.tipi, pl.renk,
      (SELECT sum(x.default_qty) FROM plaka_parts x WHERE x.plaka_id=pp.plaka_id) tot,
      row_number() OVER (PARTITION BY pp.part_id ORDER BY pp.default_qty DESC) rn
    FROM plaka_parts pp JOIN plakalar pl ON pl.plaka_id=pp.plaka_id
  ),
  p_birim AS (
    SELECT part_id,
      (SELECT birim_fiyat FROM all_parts WHERE part_id = CASE
         WHEN tipi='8mm MDF' AND renk='Ceviz' THEN 'HP0015'
         WHEN tipi='8mm MDF' AND renk='Meşe' THEN 'HP0016'
         WHEN tipi='8mm MDF' AND renk='Cambridge' THEN 'HP0017'
         WHEN tipi='2.7mm MDF' THEN 'HP0018'
         WHEN tipi='5mm MDF' THEN 'HP0019' END) / NULLIF(tot,0) AS birim
    FROM pbest WHERE rn=1
  ),
  malzeme AS (
    SELECT r.sku,
      sum(CASE
        WHEN r.part_id LIKE 'HP%' THEN r.qty * coalesce(ap.birim_fiyat,0)
        WHEN r.part_id ~ '-P\d' AND ap.birim_fiyat IS NOT NULL THEN r.qty * ap.birim_fiyat
        WHEN r.part_id ~ '-P\d' THEN r.qty * coalesce(pb.birim,0)
        ELSE 0 END) AS malzeme_toplam,
      bool_or(
        (r.part_id LIKE 'HP%' AND ap.birim_fiyat IS NULL) OR
        (r.part_id ~ '-P\d' AND ap.birim_fiyat IS NULL AND pb.birim IS NULL)
      ) AS eksik_malzeme
    FROM recete r
    LEFT JOIN all_parts ap ON ap.part_id=r.part_id
    LEFT JOIN p_birim pb ON pb.part_id=r.part_id
    GROUP BY r.sku
  ),
  msess AS (
    SELECT m.sku, m.step_name,
      coalesce(NULLIF(m.net_sure_dk,0), extract(epoch from (m.end_time-m.start_time))/60) dk,
      m.worker_count kisi, m.qty
    FROM montaj_sessions m
    WHERE m.durum='tamamlandi' AND m.end_time IS NOT NULL AND m.qty>0
  ),
  montaj_step AS (
    SELECT sku, step_name, sum(dk*kisi)/sum(qty) dk_adet
    FROM msess WHERE dk BETWEEN 1 AND 1440 AND (dk*kisi/qty)<=30
    GROUP BY sku, step_name
  ),
  montaj_labor AS (SELECT sku, sum(dk_adet) dk_adet_toplam FROM montaj_step GROUP BY sku),
  psess AS (
    SELECT sku, extract(epoch from (end_time-start_time))/60 dk, worker_count kisi, qty
    FROM pack_events WHERE durum='tamamlandi' AND end_time IS NOT NULL AND qty>0
  ),
  pack_labor AS (
    SELECT sku, sum(dk*kisi)/sum(qty) dk_adet FROM psess
    WHERE dk BETWEEN 1 AND 1440 AND (dk*kisi/qty)<=30 GROUP BY sku
  ),
  recipe_steps AS (
    SELECT DISTINCT a.sku, a.step_name FROM assembly_steps a
    JOIN products pr ON pr.sku=a.sku AND pr.aktif_mi=true
    WHERE a.step_name IS NOT NULL AND a.step_name <> 'PAKETLEME'
  ),
  eksik_isc AS (
    SELECT rs.sku, bool_or(ms.dk_adet IS NULL) eksik
    FROM recipe_steps rs LEFT JOIN montaj_step ms ON ms.sku=rs.sku AND ms.step_name=rs.step_name
    GROUP BY rs.sku
  )
  INSERT INTO urun_maliyet_cache (sku, malzeme, iscilik, birim_maliyet, eksik, updated_at)
  SELECT pr.sku,
    round(coalesce(mz.malzeme_toplam,0),2),
    round((coalesce(ml.dk_adet_toplam,0)*rate.montaj/60 + coalesce(pl.dk_adet,0)*rate.paket/60)::numeric,2),
    round((coalesce(mz.malzeme_toplam,0) + coalesce(ml.dk_adet_toplam,0)*rate.montaj/60 + coalesce(pl.dk_adet,0)*rate.paket/60)::numeric,2),
    (coalesce(mz.eksik_malzeme,false) OR coalesce(ei.eksik,false) OR mz.malzeme_toplam IS NULL),
    now()
  FROM products pr CROSS JOIN rate
  LEFT JOIN malzeme mz ON mz.sku=pr.sku
  LEFT JOIN montaj_labor ml ON ml.sku=pr.sku
  LEFT JOIN pack_labor pl ON pl.sku=pr.sku
  LEFT JOIN eksik_isc ei ON ei.sku=pr.sku
  WHERE pr.aktif_mi=true
  ON CONFLICT (sku) DO UPDATE SET
    malzeme=EXCLUDED.malzeme, iscilik=EXCLUDED.iscilik,
    birim_maliyet=EXCLUDED.birim_maliyet, eksik=EXCLUDED.eksik, updated_at=now();
$function$;

GRANT EXECUTE ON FUNCTION public.refresh_urun_maliyet_cache() TO authenticated;
