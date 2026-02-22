-- Migration: Rename makine IDs (BÜYÜK→MAK-2, KÜÇÜK→MAK-1) and add MAK-3
-- KUTU stays unchanged (different department: Kutu-Koli)

-- ============================================================
-- Step 1: Insert new machine records FIRST (FK dependency)
-- ============================================================
INSERT INTO public.kesim_makinesi (makine_id, tipi, bolum, aktif, aciklama)
VALUES
  ('MAK-1', '300W Lazer', 'Kesim', true, '300W Lazer 2023'),
  ('MAK-2', '600W Lazer', 'Kesim', true, '600W Lazer 2024'),
  ('MAK-3', '600W Yeni Lazer', 'Kesim', true, '600W Lazer 2026')
ON CONFLICT (makine_id) DO UPDATE SET
  tipi = EXCLUDED.tipi,
  bolum = EXCLUDED.bolum,
  aktif = EXCLUDED.aktif,
  aciklama = EXCLUDED.aciklama;

-- ============================================================
-- Step 2: Update cut_batches.makine_id (now FK targets exist)
-- ============================================================
UPDATE public.cut_batches SET makine_id = 'MAK-1' WHERE makine_id = 'KÜÇÜK';
UPDATE public.cut_batches SET makine_id = 'MAK-2' WHERE makine_id = 'BÜYÜK';

-- ============================================================
-- Step 3: Update plakalar.kesim_sureleri JSONB keys
-- BÜYÜK→MAK-2, KÜÇÜK→MAK-1
-- ============================================================
UPDATE public.plakalar
SET kesim_sureleri = (
  CASE
    WHEN kesim_sureleri ? 'BÜYÜK' AND kesim_sureleri ? 'KÜÇÜK' THEN
      (kesim_sureleri - 'BÜYÜK' - 'KÜÇÜK')
        || jsonb_build_object('MAK-2', kesim_sureleri->'BÜYÜK')
        || jsonb_build_object('MAK-1', kesim_sureleri->'KÜÇÜK')
    WHEN kesim_sureleri ? 'BÜYÜK' THEN
      (kesim_sureleri - 'BÜYÜK')
        || jsonb_build_object('MAK-2', kesim_sureleri->'BÜYÜK')
    WHEN kesim_sureleri ? 'KÜÇÜK' THEN
      (kesim_sureleri - 'KÜÇÜK')
        || jsonb_build_object('MAK-1', kesim_sureleri->'KÜÇÜK')
    ELSE kesim_sureleri
  END
)
WHERE kesim_sureleri ? 'BÜYÜK' OR kesim_sureleri ? 'KÜÇÜK';

-- ============================================================
-- Step 4: Delete old machine records (no more FK references)
-- ============================================================
DELETE FROM public.kesim_makinesi WHERE makine_id IN ('BÜYÜK', 'KÜÇÜK');
