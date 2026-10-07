-- 150: Talepler "Kaldır" akışı + istasyonun personelden otomatik belirlenmesi
--  * talepler.kaldirildi_at / kaldiran: kapalı (tamamlandı/tamamlanmadı/stokta mevcut/geri çekildi) talep,
--    kullanıcı "Kaldır" diyene dek aktif listede soluk (pasif) kalır; kaldırılanlar geçmiş sekmelerine gider.
--  * talep_kaldir / talep_kaldir_toplu RPC (açan veya planlayıcı; yalnız kapalı talepler)
--  * talep_durum görünümüne kaldirildi_at (en sona eklendi)
--  * Yeniden açılan talepte kaldirildi_at temizlenir (trigger)
--  * talimat_satirlar INSERT: istasyon boşsa ve plaka yoksa users.station'dan türetilir
--    (Kesim/Montaj/Paketleme [+ " Hattı"] -> kesim/montaj/paketleme; diğerleri -> NULL)

ALTER TABLE public.talepler
  ADD COLUMN IF NOT EXISTS kaldirildi_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kaldiran      TEXT;

CREATE INDEX IF NOT EXISTS idx_talepler_kaldirildi ON public.talepler (kaldirildi_at) WHERE kaldirildi_at IS NULL;

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
  END AS depo_stok,
  t.kaldirildi_at
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

ALTER VIEW public.talep_durum SET (security_invoker = true);
GRANT SELECT ON public.talep_durum TO authenticated;

-- ── Yeniden açılan talep tekrar aktif listeye döner ──
CREATE OR REPLACE FUNCTION public.talepler_kaldir_temizle()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kapanis IS NULL THEN
    NEW.kaldirildi_at := NULL;
    NEW.kaldiran := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talepler_kaldir_temizle ON public.talepler;
CREATE TRIGGER trg_talepler_kaldir_temizle
  BEFORE UPDATE ON public.talepler
  FOR EACH ROW EXECUTE FUNCTION public.talepler_kaldir_temizle();

-- ── Kaldır (tek / toplu) ──
-- Yetki: talebi açan (ofis) veya planlayıcı. Yalnız kapalı ve henüz kaldırılmamış talepler.
CREATE OR REPLACE FUNCTION public.talep_kaldir_toplu(p_talepler UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := public.talimat_kullanici_id();
  v_n   INTEGER;
BEGIN
  IF p_talepler IS NULL OR cardinality(p_talepler) = 0 THEN RETURN 0; END IF;
  IF NOT (public.is_office_user() OR public.is_admin_or_engineer()) THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok' USING ERRCODE = '42501';
  END IF;

  UPDATE public.talepler t
  SET kaldirildi_at = now(), kaldiran = v_uid
  WHERE t.talep_id = ANY (p_talepler)
    AND t.kapanis IS NOT NULL
    AND t.kaldirildi_at IS NULL
    AND (t.olusturan = v_uid OR public.is_admin_or_engineer());
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.talep_kaldir(p_talep UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t   public.talepler%ROWTYPE;
  v_uid TEXT := public.talimat_kullanici_id();
BEGIN
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  IF NOT ((v_t.olusturan = v_uid AND public.is_office_user()) OR public.is_admin_or_engineer()) THEN
    RAISE EXCEPTION 'Bu talebi kaldırma yetkiniz yok' USING ERRCODE = '42501';
  END IF;
  IF v_t.kapanis IS NULL THEN RAISE EXCEPTION 'Yalnızca kapalı talepler kaldırılabilir'; END IF;
  IF v_t.kaldirildi_at IS NOT NULL THEN RETURN; END IF;
  UPDATE public.talepler SET kaldirildi_at = now(), kaldiran = v_uid WHERE talep_id = p_talep;
END;
$$;

DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY['talep_kaldir(uuid)', 'talep_kaldir_toplu(uuid[])'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
END $$;

-- ── İstasyon: users.station -> talimat istasyonu ──
CREATE OR REPLACE FUNCTION public.talimat_istasyon_esle(p_station TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_station IN ('Kesim', 'Kesim Hattı') THEN 'kesim'
    WHEN p_station IN ('Montaj', 'Montaj Hattı') THEN 'montaj'
    WHEN p_station IN ('Paketleme', 'Paketleme Hattı') THEN 'paketleme'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_satir_istasyon_varsayilan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.istasyon IS NULL AND NEW.plaka_id IS NULL THEN
    SELECT public.talimat_istasyon_esle(u.station::text) INTO NEW.istasyon
    FROM public.users u WHERE u.user_id = NEW.personel_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talimat_satir_istasyon ON public.talimat_satirlar;
CREATE TRIGGER trg_talimat_satir_istasyon
  BEFORE INSERT ON public.talimat_satirlar
  FOR EACH ROW EXECUTE FUNCTION public.talimat_satir_istasyon_varsayilan();

REVOKE ALL ON FUNCTION public.talimat_satir_istasyon_varsayilan() FROM PUBLIC, anon, authenticated;
