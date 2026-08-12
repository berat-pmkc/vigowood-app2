-- =============================================================
-- Sevkiyat silme
--
-- Ekranda yalnızca "iptal et" vardı; iptal kaydı bırakır, listede
-- durmaya devam eder. Yanlışlıkla açılmış bir sevkiyatı tamamen
-- kaldırmanın yolu yoktu.
--
-- sevkiyat üzerinde DELETE yetkisi yalnızca is_admin()'e açık; sevkiyat
-- sorumlusu ve endüstri mühendisi silemiyordu. Diğer modüllerdeki gibi
-- tabloya geniş yetki açmak yerine, yetkiyi içinde kontrol eden bir
-- fonksiyon kullanılıyor.
--
-- Bağlı kayıtlar veritabanı seviyesinde zaten hallediliyor:
--   sevkiyat_items      → CASCADE (kalemler de silinir)
--   sevkiyat_maliyetler → CASCADE
--   yukleme_planlari    → SET NULL (plan durur, sevkiyat bağı kopar)
-- =============================================================

CREATE OR REPLACE FUNCTION public.sevkiyat_sil(p_sevkiyat_id TEXT)
RETURNS TABLE (silinen_kalem INTEGER, kopan_plan INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_kalem INTEGER := 0;
  v_plan  INTEGER := 0;
BEGIN
  IF NOT public.has_sevkiyat_access() THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok';
  END IF;

  PERFORM 1 FROM sevkiyat WHERE sevkiyat_id = p_sevkiyat_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sevkiyat bulunamadı: %', p_sevkiyat_id;
  END IF;

  SELECT count(*) INTO v_kalem FROM sevkiyat_items WHERE sevkiyat_id = p_sevkiyat_id;
  SELECT count(*) INTO v_plan  FROM yukleme_planlari WHERE sevkiyat_id = p_sevkiyat_id;

  DELETE FROM sevkiyat WHERE sevkiyat_id = p_sevkiyat_id;

  RETURN QUERY SELECT v_kalem, v_plan;
END;
$$;

REVOKE ALL ON FUNCTION public.sevkiyat_sil(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sevkiyat_sil(TEXT) TO authenticated;
