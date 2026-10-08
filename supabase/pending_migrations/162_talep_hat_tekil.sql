-- =============================================================
-- 162: Aynı talep (iş) bir hatta yalnız BİR kez atanabilir
--  * Hatlar arası kopyalama, hedef hatta aynı talebe bağlı satır varsa o satırı atlar.
--  * Veritabanı kuralı: (plan, hat, talep) tekil. Mevcut çift kayıtlarda en eski satır
--    talebe bağlı kalır, sonrakilerin talep bağı kaldırılır (satırlar silinmez).
-- =============================================================

UPDATE public.talimat_satirlar s
SET talep_id = NULL
WHERE s.talep_id IS NOT NULL AND s.hat_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.talimat_satirlar o
    WHERE o.plan_id = s.plan_id AND o.hat_id = s.hat_id AND o.talep_id = s.talep_id
      AND (o.created_at, o.satir_id) < (s.created_at, s.satir_id));

CREATE UNIQUE INDEX IF NOT EXISTS uq_talimat_satir_hat_talep
  ON public.talimat_satirlar (plan_id, hat_id, talep_id)
  WHERE talep_id IS NOT NULL AND hat_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.talimat_satirlari_hatta_kopyala(p_satir_ids UUID[], p_hedef_hat UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan UUID;
  v_planlar INTEGER;
  v_bulunan INTEGER;
  v_durum TEXT;
  r RECORD;
  v_bos UUID;
  v_id UUID;
  v_talep UUID;
  v_yeni UUID[] := '{}';
  v_atlanan INTEGER := 0;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  IF p_satir_ids IS NULL OR cardinality(p_satir_ids) = 0 THEN RAISE EXCEPTION 'Kopyalanacak satır seçilmedi'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.talimat_hatlar WHERE hat_id = p_hedef_hat AND aktif) THEN
    RAISE EXCEPTION 'Hedef hat bulunamadı veya pasif';
  END IF;

  SELECT count(DISTINCT plan_id), count(*), (array_agg(plan_id))[1]
    INTO v_planlar, v_bulunan, v_plan
  FROM public.talimat_satirlar WHERE satir_id = ANY (p_satir_ids);
  IF v_bulunan <> (SELECT count(DISTINCT x) FROM unnest(p_satir_ids) x) THEN
    RAISE EXCEPTION 'Satır bulunamadı';
  END IF;
  IF v_planlar <> 1 THEN RAISE EXCEPTION 'Satırlar aynı plandan olmalı'; END IF;
  SELECT durum INTO v_durum FROM public.talimat_planlar WHERE plan_id = v_plan;
  IF v_durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

  FOR r IN
    SELECT s.*
    FROM unnest(p_satir_ids) WITH ORDINALITY AS o(id, ord)
    JOIN public.talimat_satirlar s ON s.satir_id = o.id
    WHERE s.sku IS NOT NULL
    ORDER BY o.ord
  LOOP
    v_talep := NULL;
    IF r.talep_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.talepler WHERE talep_id = r.talep_id AND kapanis IS NULL) THEN
      v_talep := r.talep_id;
    END IF;
    -- Aynı talep (iş) bir hatta yalnız bir kez atanabilir: hedef hatta zaten varsa bu satır atlanır
    IF v_talep IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.talimat_satirlar x
         WHERE x.plan_id = v_plan AND x.hat_id = p_hedef_hat AND x.talep_id = v_talep) THEN
      v_atlanan := v_atlanan + 1;
      CONTINUE;
    END IF;

    SELECT satir_id INTO v_bos FROM public.talimat_satirlar
    WHERE plan_id = v_plan AND hat_id = p_hedef_hat AND sku IS NULL AND plaka_id IS NULL
    ORDER BY sira LIMIT 1;

    IF v_bos IS NOT NULL THEN
      v_id := public.talimat_satir_kaydet(jsonb_build_object(
        'satir_id', v_bos, 'sku', r.sku, 'istenen_miktar', r.istenen_miktar,
        'not_text', r.not_text, 'talep_id', v_talep, 'durum', 'aktif'));
    ELSE
      v_id := public.talimat_satir_kaydet(jsonb_build_object(
        'plan_id', v_plan, 'hat_id', p_hedef_hat, 'sku', r.sku, 'istenen_miktar', r.istenen_miktar,
        'not_text', r.not_text, 'talep_id', v_talep));
    END IF;
    v_yeni := array_append(v_yeni, v_id);
  END LOOP;

  IF cardinality(v_yeni) = 0 THEN
    IF v_atlanan > 0 THEN
      RAISE EXCEPTION 'Seçilen işler bu hatta zaten atanmış (aynı talep bir hatta bir kez atanabilir)';
    END IF;
    RAISE EXCEPTION 'Kopyalanacak dolu satır yok';
  END IF;
  RETURN v_yeni;
END;
$$;

GRANT EXECUTE ON FUNCTION public.talimat_satirlari_hatta_kopyala(UUID[], UUID) TO authenticated;
