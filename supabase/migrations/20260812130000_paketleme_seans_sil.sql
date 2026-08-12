-- =============================================================
-- Paketleme seansı silme
--
-- SORUN: stock_movements üzerinde DELETE yalnızca is_admin()'e açık.
-- Üretim rolündeki kullanıcı yanlış girdiği seansı silemiyordu; seans
-- silinse bile stok hareketi kalacağı için stok şişik görünürdü.
--
-- NEDEN GENİŞ YETKİ VERİLMEDİ: stock_movements'a DELETE yetkisi açmak
-- üretimdeki herkesin herhangi bir stok hareketini silebilmesi demekti.
-- Bunun yerine bu fonksiyon SADECE belirtilen paketleme seansına bağlı
-- hareketleri siler — etki alanı tek seansla sınırlı.
--
-- AYRICA ATOMİK: hareket silme, bakiye düzeltme ve seans silme tek
-- işlemde. Uygulama katmanında üç ayrı çağrıyla yapılırken ortada hata
-- olursa yarım kalma riski vardı.
-- =============================================================

CREATE OR REPLACE FUNCTION public.paketleme_seansi_sil(p_session_id TEXT)
RETURNS TABLE (silinen_hareket INTEGER, geri_alinan_adet NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_durum TEXT;
  v_sku   TEXT;
  v_geri  NUMERIC := 0;
  v_adet  INTEGER := 0;
BEGIN
  -- SECURITY DEFINER olduğu için yetki kontrolü burada elle yapılıyor
  IF NOT public.has_production_access() THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok';
  END IF;

  SELECT durum, sku INTO v_durum, v_sku
  FROM pack_events WHERE session_id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seans bulunamadı: %', p_session_id;
  END IF;
  IF v_durum <> 'tamamlandi' THEN
    RAISE EXCEPTION 'Sadece tamamlanmış seans bu şekilde silinir (durum: %)', v_durum;
  END IF;

  -- 1) Bu seansın yazdığı stok hareketleri
  SELECT COALESCE(sum(qty),0), count(*) INTO v_geri, v_adet
  FROM stock_movements WHERE source_row_id = p_session_id;

  DELETE FROM stock_movements WHERE source_row_id = p_session_id;

  -- 2) Ürün bakiyesini geri al
  IF v_sku IS NOT NULL AND v_geri <> 0 THEN
    UPDATE products SET stok_aktif = stok_aktif - v_geri WHERE sku = v_sku;
  END IF;

  -- 3) Seansı sil
  DELETE FROM pack_events WHERE session_id = p_session_id;

  RETURN QUERY SELECT v_adet, v_geri;
END;
$$;

REVOKE ALL ON FUNCTION public.paketleme_seansi_sil(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.paketleme_seansi_sil(TEXT) TO authenticated;
