-- ============================================================
-- Migration: Hazır Eleman Tür Kategorisi + MDF Eşleme Düzeltmesi
-- ============================================================
-- 1. all_parts'a "tur" kolonu ekle (kategori filtresi için)
-- 2. Mevcut HAZIR parçaları isimlerine göre kategorize et
-- 3. Eksik mdf_tipi/mdf_renk eşlemelerini tamamla

-- 1. Tür kolonu ekle
ALTER TABLE public.all_parts ADD COLUMN IF NOT EXISTS tur TEXT;

-- Index oluştur (filtreleme için)
CREATE INDEX IF NOT EXISTS idx_all_parts_tur ON public.all_parts (tur) WHERE tur IS NOT NULL;

-- 2. HAZIR parçaları kategorize et

-- MDF: İsminde MDF veya Arkalık geçenler
UPDATE public.all_parts SET tur = 'MDF'
WHERE part_type = 'HAZIR' AND tur IS NULL
  AND (LOWER(part_adi) LIKE '%mdf%' OR LOWER(part_adi) LIKE '%arkalık%' OR LOWER(part_adi) LIKE '%arkalik%');

-- Vida: Vida, silindir çektirme (somun/vida)
UPDATE public.all_parts SET tur = 'Vida'
WHERE part_type = 'HAZIR' AND tur IS NULL
  AND (LOWER(part_adi) LIKE '%vida%' OR LOWER(part_adi) LIKE '%silindir çektirme%'
    OR LOWER(part_adi) LIKE '%silindır%' OR LOWER(part_adi) LIKE '%silind%çektirme%');

-- Menteşe
UPDATE public.all_parts SET tur = 'Menteşe'
WHERE part_type = 'HAZIR' AND tur IS NULL
  AND (LOWER(part_adi) LIKE '%menteşe%' OR LOWER(part_adi) LIKE '%mentese%');

-- Mıknatıs
UPDATE public.all_parts SET tur = 'Mıknatıs'
WHERE part_type = 'HAZIR' AND tur IS NULL
  AND (LOWER(part_adi) LIKE '%mıknatıs%' OR LOWER(part_adi) LIKE '%miknatıs%' OR LOWER(part_adi) LIKE '%miknat%');

-- Kumaş: Dikilmiş Kumas/Kumaş
UPDATE public.all_parts SET tur = 'Kumaş'
WHERE part_type = 'HAZIR' AND tur IS NULL
  AND (LOWER(part_adi) LIKE '%kumas%' OR LOWER(part_adi) LIKE '%kumaş%' OR LOWER(part_adi) LIKE '%dikilmiş%');

-- Sünger
UPDATE public.all_parts SET tur = 'Sünger'
WHERE part_type = 'HAZIR' AND tur IS NULL
  AND (LOWER(part_adi) LIKE '%sünger%' OR LOWER(part_adi) LIKE '%sunger%' OR LOWER(part_adi) LIKE '%şilte%');

-- Diğer: Kalan HAZIR parçalar
UPDATE public.all_parts SET tur = 'Aksesuar'
WHERE part_type = 'HAZIR' AND tur IS NULL;

-- KUTU ve KARTON tipleri de tur ataması
UPDATE public.all_parts SET tur = 'Kutu' WHERE part_type = 'KUTU' AND tur IS NULL;
UPDATE public.all_parts SET tur = 'Karton' WHERE part_type = 'KARTON' AND tur IS NULL;

-- 3. MDF Eşleme: mdf_tipi ve mdf_renk eksik olanları tamamla
-- Plaka tipi+renk ile HAZIR parçaları eşleştir
UPDATE public.all_parts SET mdf_tipi = '5mm MDF', mdf_renk = 'Ham'
WHERE part_id = 'HP0019' AND mdf_tipi IS NULL; -- 5mm Ham MDF

UPDATE public.all_parts SET mdf_tipi = '8mm MDF', mdf_renk = 'Cambridge'
WHERE part_id = 'HP0017' AND mdf_tipi IS NULL; -- 8mm Cambridge MDF

UPDATE public.all_parts SET mdf_tipi = '8mm MDF', mdf_renk = 'Ceviz'
WHERE part_id = 'HP0015' AND mdf_tipi IS NULL; -- 8mm Ceviz MDF

UPDATE public.all_parts SET mdf_tipi = '8mm MDF', mdf_renk = 'Meşe'
WHERE part_id = 'HP0016' AND mdf_tipi IS NULL; -- 8mm Meşe MDF

UPDATE public.all_parts SET mdf_tipi = '2.7mm MDF', mdf_renk = 'Siyah'
WHERE part_id = 'HP0018' AND mdf_tipi IS NULL; -- 2.7mm Arkalık
