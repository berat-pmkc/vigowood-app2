-- =============================================================
-- Montaj seansı silme
--
-- Paketlemedekiyle aynı sorun: yari_mamul_stok ve all_parts üzerinde
-- silme/güncelleme yetkisi dar. Üretim rolü yanlış girdiği montaj
-- seansını silemiyordu.
--
-- Montaj kapanışta iki şey yapıyor:
--   1. YARIMAMUL parçalar için yari_mamul_stok'a OUT hareketi yazıyor
--   2. HAZIR/KUTU/KARTON parçalar için all_parts.hazir_eleman_aktif_stok'u
--      reçetedeki miktar kadar düşürüyor
-- Silerken ikisi de geri alınmalı, yoksa o parçalar sonsuza kadar
-- eksik görünür.
--
-- YARIMAMUL tarafında bakiye kolonu ayrıca düşürülmüyor (kapanış da
-- düşürmüyor), yalnızca defter kaydı siliniyor — kapanışın simetriği.
-- =============================================================

CREATE OR REPLACE FUNCTION public.montaj_seansi_sil(p_session_id TEXT)
RETURNS TABLE (silinen_hareket INTEGER, geri_alinan_parca INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_durum TEXT;
  v_step  TEXT;
  v_qty   NUMERIC;
  v_hareket INTEGER := 0;
  v_parca   INTEGER := 0;
BEGIN
  IF NOT public.has_production_access() THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok';
  END IF;

  SELECT durum, step_id, COALESCE(qty,0)
    INTO v_durum, v_step, v_qty
  FROM montaj_sessions WHERE session_id = p_session_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Seans bulunamadı: %', p_session_id;
  END IF;
  IF v_durum <> 'tamamlandi' THEN
    RAISE EXCEPTION 'Sadece tamamlanmış seans bu şekilde silinir (durum: %)', v_durum;
  END IF;

  -- 1) Hazır eleman / kutu / karton bakiyelerini geri ekle.
  -- ASM- ile başlayanlar önceki adımın çıktısı, gerçek parça değil.
  WITH ihtiyac AS (
    SELECT b.part_id, sum(b.qty_per) * v_qty AS toplam
    FROM step_bom b
    JOIN all_parts p ON p.part_id = b.part_id
    WHERE b.step_id = v_step
      AND b.part_id NOT LIKE 'ASM-%'
      AND p.part_type::text <> 'YARIMAMUL'
    GROUP BY b.part_id
  ), guncel AS (
    UPDATE all_parts a
    SET hazir_eleman_aktif_stok = COALESCE(a.hazir_eleman_aktif_stok,0) + i.toplam
    FROM ihtiyac i
    WHERE a.part_id = i.part_id
    RETURNING 1
  )
  SELECT count(*)::int INTO v_parca FROM guncel;

  -- 2) Yarı mamül defter kayıtlarını sil
  WITH silinen AS (
    DELETE FROM yari_mamul_stok WHERE source_id = p_session_id RETURNING 1
  )
  SELECT count(*)::int INTO v_hareket FROM silinen;

  -- 3) Seansı sil
  DELETE FROM montaj_sessions WHERE session_id = p_session_id;

  RETURN QUERY SELECT v_hareket, v_parca;
END;
$$;

REVOKE ALL ON FUNCTION public.montaj_seansi_sil(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.montaj_seansi_sil(TEXT) TO authenticated;
