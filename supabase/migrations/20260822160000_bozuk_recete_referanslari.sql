-- =============================================================
-- Reçetede parça KODU yerine ADI yazılmış satırların düzeltilmesi
--
-- SORUN: step_bom.part_id alanına bazı satırlarda kod yerine parçanın
-- adı girilmiş. all_parts'ta bu değerle eşleşen kayıt olmadığı için
-- bu malzemeler üretim yapıldıkça STOKTAN HİÇ DÜŞMÜYORDU.
--
-- Sessiz bir hata: reçete ekranında satır görünüyor, seans kapanıyor,
-- ama stok hareketi oluşmuyor. LS051 ailesinin kumaşı ve süngeri
-- aylardır eksilmemiş görünüyor olabilir.
--
-- DÜZELTİLENLER (ad birebir eşleşiyor, miktarlar değişmiyor):
--   'LS051 Dikilmiş Kumas'  -> HP0008   (LS051 / DÖŞEME HAZIRLIK)
--   'Sünger 27*37*2.5'      -> HP0006   (LS053, LS054, LS055, LS056, LS057)
--
-- DÜZELTİLMEYEN: BT201 / Paketleme adımındaki HP0058 x4. Bu kod
-- all_parts'ta yok ve neye karşılık geldiği veriden çıkarılamıyor
-- (numara sırasında 'Tablo Dış Kutu Small' ile sünger arasında).
-- Doğru parça belirlenmeden bağlanması yanlış stok düşürür.
--
-- Not: geçmişteki eksik düşümler bu migration ile telafi EDİLMİYOR;
-- yalnızca bundan sonraki üretimler doğru düşecek. Geriye dönük
-- düzeltme sayımla yapılmalı.
-- =============================================================

DO $$
DECLARE
  v_kumas INTEGER;
  v_sunger INTEGER;
BEGIN
  -- Hedef parçalar gerçekten var mı? Yoksa hiçbir şeye dokunma.
  IF NOT EXISTS (SELECT 1 FROM all_parts WHERE part_id='HP0008')
     OR NOT EXISTS (SELECT 1 FROM all_parts WHERE part_id='HP0006') THEN
    RAISE NOTICE 'HP0008/HP0006 bulunamadı — migration atlandı';
    RETURN;
  END IF;

  UPDATE step_bom SET part_id='HP0008' WHERE part_id='LS051 Dikilmiş Kumas';
  GET DIAGNOSTICS v_kumas = ROW_COUNT;

  UPDATE step_bom SET part_id='HP0006' WHERE part_id='Sünger 27*37*2.5';
  GET DIAGNOSTICS v_sunger = ROW_COUNT;

  RAISE NOTICE 'Kumaş satırı: %, sünger satırı: %', v_kumas, v_sunger;
END $$;
