-- 166: Tamamlanan satır "Tekrar aktif et" -> hattın aktifleri arasında sıraya yerleşir.
-- Tamamlanma üretimden türetilir (DB olayı değil); satırın sira'sı aktiflerin arasında kalmış olabilir.
-- Yeniden aktif edilince: varsayılan = aktiflerin sonu (pasiflerin üstü); istenirse görünen konum N.
-- Hat satırında ardışık-SKU kısıtı (165) COMMIT'te denetlenir; ihlalde ARDISIK_SKU hatası döner.

-- İmza aynı: sayaç sıfırla + istenen yaz + aktiflerin sonuna yerleştir
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

  IF v_s.hat_id IS NOT NULL AND v_s.durum <> 'pasif' THEN
    PERFORM public.talimat_hat_yeniden_sirala(v_s.plan_id, v_s.hat_id, '{}', ARRAY[p_satir]);
  END IF;

  IF v_plan.durum = 'yayinda' AND NOT v_bos THEN
    PERFORM public.talimat_degisen_isaretle(v_s.plan_id, v_s.personel_id);
  END IF;
  RETURN p_satir;
END;
$$;

REVOKE ALL ON FUNCTION public.talimat_satir_yeniden_aktif(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_satir_yeniden_aktif(UUID, NUMERIC) TO authenticated;

-- Konumlu sürüm: p_sira = hattın aktif (pasif/tamamlanmamış olmayan) satırları arasındaki görünen konum; NULL = sona
CREATE OR REPLACE FUNCTION public.talimat_satir_yeniden_aktif_sirali(p_satir UUID, p_istenen NUMERIC, p_sira INTEGER DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan UUID;
BEGIN
  PERFORM public.talimat_satir_yeniden_aktif(p_satir, p_istenen);
  IF p_sira IS NOT NULL THEN
    SELECT plan_id INTO v_plan FROM public.talimat_satirlar WHERE satir_id = p_satir;
    PERFORM public.talimat_satir_gorunen_sira_ic(v_plan, p_satir, p_sira);
  END IF;
  RETURN p_satir;
END;
$$;

REVOKE ALL ON FUNCTION public.talimat_satir_yeniden_aktif_sirali(UUID, NUMERIC, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_satir_yeniden_aktif_sirali(UUID, NUMERIC, INTEGER) TO authenticated;
