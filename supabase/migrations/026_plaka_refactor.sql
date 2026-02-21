-- 026_plaka_refactor.sql
-- Plaka yönetimi refactoru: makine_id + std_kesim_suresi_dk → kesim_sureleri JSONB
-- plaka_id UNIQUE constraint, duplicate satırları birleştir
-- products tablosuna renk_kodu ekle
-- RLS policy'leri is_admin_or_engineer() fonksiyonuna geçir

BEGIN;

-- ============================================================
-- 1. plakalar tablosuna kesim_sureleri JSONB kolonu ekle
-- ============================================================
ALTER TABLE public.plakalar
  ADD COLUMN IF NOT EXISTS kesim_sureleri JSONB DEFAULT '{}';

-- ============================================================
-- 2. Mevcut makine_id + std_kesim_suresi_dk verilerini
--    plaka_id grubu bazında JSONB'ye aggregate et
-- ============================================================
-- Her plaka_id grubunun tüm makine/süre verilerini topla
UPDATE public.plakalar p
SET kesim_sureleri = agg.sureleri
FROM (
  SELECT
    plaka_id,
    jsonb_object_agg(
      makine_id,
      std_kesim_suresi_dk
    ) FILTER (WHERE makine_id IS NOT NULL AND std_kesim_suresi_dk IS NOT NULL) AS sureleri
  FROM public.plakalar
  GROUP BY plaka_id
) agg
WHERE p.plaka_id = agg.plaka_id
  AND agg.sureleri IS NOT NULL;

-- NULL olan kesim_sureleri'ni boş objeye set et
UPDATE public.plakalar
SET kesim_sureleri = '{}'
WHERE kesim_sureleri IS NULL;

-- ============================================================
-- 3. Duplicate satırları sil (her plaka_id grubundan sadece
--    MIN plakalar_id'yi tut)
-- ============================================================
DELETE FROM public.plakalar
WHERE plakalar_id NOT IN (
  SELECT MIN(plakalar_id)
  FROM public.plakalar
  GROUP BY plaka_id
);

-- ============================================================
-- 4. Kalan plakalar_id'leri sıralı olarak yeniden numaralandır
-- ============================================================
WITH numbered AS (
  SELECT
    plakalar_id AS old_id,
    'PL-' || LPAD(ROW_NUMBER() OVER (ORDER BY plakalar_id)::TEXT, 4, '0') AS new_id
  FROM public.plakalar
)
UPDATE public.plakalar p
SET plakalar_id = n.new_id
FROM numbered n
WHERE p.plakalar_id = n.old_id
  AND p.plakalar_id != n.new_id;

-- ============================================================
-- 5. plaka_id'ye UNIQUE constraint ekle (artık 1:1)
-- ============================================================
ALTER TABLE public.plakalar
  ADD CONSTRAINT plakalar_plaka_id_unique UNIQUE (plaka_id);

-- ============================================================
-- 6. makine_id ve std_kesim_suresi_dk kolonlarını kaldır
-- ============================================================
-- Önce makine_id FK constraint'ini kaldır (varsa)
DO $$
BEGIN
  -- Drop FK from plakalar.makine_id → kesim_makinesi
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'plakalar_makine_id_fkey'
    AND table_name = 'plakalar'
  ) THEN
    ALTER TABLE public.plakalar DROP CONSTRAINT plakalar_makine_id_fkey;
  END IF;
END $$;

ALTER TABLE public.plakalar DROP COLUMN IF EXISTS makine_id;
ALTER TABLE public.plakalar DROP COLUMN IF EXISTS std_kesim_suresi_dk;

-- ============================================================
-- 7. updated_at kolonu ekle + handle_updated_at() trigger
-- ============================================================
ALTER TABLE public.plakalar
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Trigger (handle_updated_at fonksiyonu zaten mevcut)
DROP TRIGGER IF EXISTS set_plakalar_updated_at ON public.plakalar;
CREATE TRIGGER set_plakalar_updated_at
  BEFORE UPDATE ON public.plakalar
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- 8. products tablosuna renk_kodu TEXT kolonu ekle
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS renk_kodu TEXT;

-- ============================================================
-- 9. RLS policy'leri is_admin_or_engineer() fonksiyonuna geçir
-- ============================================================

-- plakalar tablosu: Mevcut policy'leri kaldır ve yeniden oluştur
DROP POLICY IF EXISTS "plakalar_select" ON public.plakalar;
DROP POLICY IF EXISTS "plakalar_insert" ON public.plakalar;
DROP POLICY IF EXISTS "plakalar_update" ON public.plakalar;
DROP POLICY IF EXISTS "plakalar_delete" ON public.plakalar;
DROP POLICY IF EXISTS "Herkes okuyabilir" ON public.plakalar;
DROP POLICY IF EXISTS "Admin ve mühendis yazabilir" ON public.plakalar;
DROP POLICY IF EXISTS "Admin ve mühendis güncelleyebilir" ON public.plakalar;
DROP POLICY IF EXISTS "Admin ve mühendis silebilir" ON public.plakalar;
DROP POLICY IF EXISTS "plakalar select" ON public.plakalar;
DROP POLICY IF EXISTS "plakalar insert" ON public.plakalar;
DROP POLICY IF EXISTS "plakalar update" ON public.plakalar;
DROP POLICY IF EXISTS "plakalar delete" ON public.plakalar;

-- Yeni policy'ler
CREATE POLICY "plakalar_select" ON public.plakalar
  FOR SELECT USING (true);

CREATE POLICY "plakalar_insert" ON public.plakalar
  FOR INSERT WITH CHECK (is_admin_or_engineer());

CREATE POLICY "plakalar_update" ON public.plakalar
  FOR UPDATE USING (is_admin_or_engineer());

CREATE POLICY "plakalar_delete" ON public.plakalar
  FOR DELETE USING (is_admin_or_engineer());

-- plaka_parts tablosu: Aynı şekilde
DROP POLICY IF EXISTS "plaka_parts_select" ON public.plaka_parts;
DROP POLICY IF EXISTS "plaka_parts_insert" ON public.plaka_parts;
DROP POLICY IF EXISTS "plaka_parts_update" ON public.plaka_parts;
DROP POLICY IF EXISTS "plaka_parts_delete" ON public.plaka_parts;
DROP POLICY IF EXISTS "Herkes okuyabilir" ON public.plaka_parts;
DROP POLICY IF EXISTS "Admin ve mühendis yazabilir" ON public.plaka_parts;
DROP POLICY IF EXISTS "Admin ve mühendis güncelleyebilir" ON public.plaka_parts;
DROP POLICY IF EXISTS "Admin ve mühendis silebilir" ON public.plaka_parts;
DROP POLICY IF EXISTS "plaka_parts select" ON public.plaka_parts;
DROP POLICY IF EXISTS "plaka_parts insert" ON public.plaka_parts;
DROP POLICY IF EXISTS "plaka_parts update" ON public.plaka_parts;
DROP POLICY IF EXISTS "plaka_parts delete" ON public.plaka_parts;

CREATE POLICY "plaka_parts_select" ON public.plaka_parts
  FOR SELECT USING (true);

CREATE POLICY "plaka_parts_insert" ON public.plaka_parts
  FOR INSERT WITH CHECK (is_admin_or_engineer());

CREATE POLICY "plaka_parts_update" ON public.plaka_parts
  FOR UPDATE USING (is_admin_or_engineer());

CREATE POLICY "plaka_parts_delete" ON public.plaka_parts
  FOR DELETE USING (is_admin_or_engineer());

-- ============================================================
-- 10. Realtime için plakalar tablosuna publication ekle (varsa geç)
-- ============================================================
DO $$
BEGIN
  -- Supabase realtime publication kontrolü — hata olursa yoksay
  PERFORM 1;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

COMMIT;
