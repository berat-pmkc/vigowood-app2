-- Migration: Karton Plaka Ayrımı
-- plakalar tablosuna plaka_kategori (MDF/KARTON) kolon ekle
-- kutu_uretim tablosuna plaka_id ve sku ekle

-- 1A: plakalar tablosuna plaka_kategori ekle
ALTER TABLE public.plakalar
  ADD COLUMN IF NOT EXISTS plaka_kategori TEXT NOT NULL DEFAULT 'MDF';

-- KUTU süresi olan ama MDF makinesi olmayan plakalar → KARTON
UPDATE public.plakalar
SET plaka_kategori = 'KARTON'
WHERE (kesim_sureleri->>'KUTU') IS NOT NULL
  AND (kesim_sureleri->>'KUTU') != 'null'
  AND ((kesim_sureleri->>'MAK-1') IS NULL OR (kesim_sureleri->>'MAK-1') = 'null')
  AND ((kesim_sureleri->>'MAK-2') IS NULL OR (kesim_sureleri->>'MAK-2') = 'null')
  AND ((kesim_sureleri->>'MAK-3') IS NULL OR (kesim_sureleri->>'MAK-3') = 'null');

CREATE INDEX IF NOT EXISTS idx_plakalar_kategori ON public.plakalar(plaka_kategori);

ALTER TABLE public.plakalar
  ADD CONSTRAINT plakalar_kategori_check CHECK (plaka_kategori IN ('MDF', 'KARTON'));

-- 1B: kutu_uretim tablosuna plaka_id ve sku ekle
ALTER TABLE public.kutu_uretim
  ADD COLUMN IF NOT EXISTS plaka_id TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT;

CREATE INDEX IF NOT EXISTS idx_kutu_uretim_plaka_id ON public.kutu_uretim(plaka_id);
CREATE INDEX IF NOT EXISTS idx_kutu_uretim_sku ON public.kutu_uretim(sku);
