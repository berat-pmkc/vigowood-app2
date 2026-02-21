-- VigoWood Platform — Makineler: bolum + updated_at + aktif + RLS düzeltme

-- 1. Yeni kolonlar
ALTER TABLE public.kesim_makinesi
  ADD COLUMN IF NOT EXISTS bolum TEXT NOT NULL DEFAULT 'Kesim',
  ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. updated_at trigger
CREATE TRIGGER set_kesim_makinesi_updated_at
  BEFORE UPDATE ON public.kesim_makinesi
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- 3. Mevcut verileri güncelle
UPDATE public.kesim_makinesi SET bolum = 'Kesim' WHERE makine_id IN ('BÜYÜK', 'KÜÇÜK');
UPDATE public.kesim_makinesi SET bolum = 'Kutu-Koli' WHERE makine_id = 'KUTU';

-- 4. RLS düzeltme — inline subquery → is_admin() fonksiyonu
DROP POLICY IF EXISTS "Yönetici can manage machines" ON public.kesim_makinesi;

CREATE POLICY "Admin can manage machines"
  ON public.kesim_makinesi FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());
