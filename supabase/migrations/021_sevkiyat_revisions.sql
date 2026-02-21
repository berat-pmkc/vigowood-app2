-- 021: Sevkiyat Katman 18F — Revizyon
-- #9: Dorse plaka, #10: Taşıyıcı firma, #4: İptal durumu, #3: Maliyet kısıtlama, #6: Fiyat sevkiyat erişimi

-- #9: Dorse plaka (tır çift plaka)
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS dorse_plaka TEXT;

-- #10: Taşıyıcı firma (metin)
ALTER TABLE public.sevkiyat ADD COLUMN IF NOT EXISTS tasiyici_firma TEXT;

-- #4: İptal durumu için CHECK constraint güncelle
ALTER TABLE public.sevkiyat DROP CONSTRAINT IF EXISTS sevkiyat_durum_check;
ALTER TABLE public.sevkiyat ADD CONSTRAINT sevkiyat_durum_check
  CHECK (durum IN ('bekliyor','hazirlaniyor','yolda','teslim_edildi','iptal_edildi'));

-- #3: Maliyetler sayfasını sadece admin/mühendis görsün (SELECT kısıtla)
DROP POLICY IF EXISTS "maliyetler_select" ON public.sevkiyat_maliyetler;
CREATE POLICY "maliyetler_select_restricted" ON public.sevkiyat_maliyetler
  FOR SELECT TO authenticated USING (is_admin_or_engineer());

-- #6: Fiyatlar tablosuna sevkiyat yetkili de yazabilsin
CREATE POLICY "sevkiyat_insert_fiyatlar" ON public.sevkiyat_fiyatlar
  FOR INSERT TO authenticated WITH CHECK (has_sevkiyat_access());
CREATE POLICY "sevkiyat_update_fiyatlar" ON public.sevkiyat_fiyatlar
  FOR UPDATE TO authenticated USING (has_sevkiyat_access());
CREATE POLICY "sevkiyat_delete_fiyatlar" ON public.sevkiyat_fiyatlar
  FOR DELETE TO authenticated USING (has_sevkiyat_access());
