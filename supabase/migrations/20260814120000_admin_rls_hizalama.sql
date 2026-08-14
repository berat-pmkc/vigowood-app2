-- =============================================================
-- Admin ana veri tablolarında RLS hizalaması
--
-- SORUN: Uygulama katmanında ADMIN_ROLES = Yönetici + Endüstri Mühendisi
-- ve admin ekranlarındaki requireAdmin() ikisini de kabul ediyor. Ancak
-- veritabanındaki politikalar is_admin() kullanıyordu; o fonksiyon
-- yalnızca Yönetici'yi kabul ediyor.
--
-- Sonuç: Endüstri Mühendisi admin ekranlarını açabiliyor, formu
-- doldurabiliyor, kaydete basınca "new row violates row-level security
-- policy" alıyordu. Yani yetki ekranla veritabanı arasında çelişiyordu.
--
-- ÇÖZÜM: Bu beş tabloda is_admin_or_engineer()'a geçiliyor — assembly_steps
-- ve step_bom'da zaten öyle. Yetki genişletilmiş olmuyor; ekranın halihazırda
-- verdiği yetkinin veritabanında karşılığı oluşturuluyor.
--
-- Kapsam dışı bırakılanlar: users (şifre/rol yönetimi yalnız Yönetici'de
-- kalmalı) ve muhasebe tabloları (is_admin_or_finance kendi kuralına sahip).
-- =============================================================

-- ── products ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Yönetici can manage products" ON public.products;
CREATE POLICY "Admin ve mühendis products yönetir" ON public.products
  FOR ALL TO authenticated
  USING (public.is_admin_or_engineer())
  WITH CHECK (public.is_admin_or_engineer());

-- ── all_parts ────────────────────────────────────────────────
DROP POLICY IF EXISTS "Yönetici can manage parts" ON public.all_parts;
CREATE POLICY "Admin ve mühendis parca yönetir" ON public.all_parts
  FOR ALL TO authenticated
  USING (public.is_admin_or_engineer())
  WITH CHECK (public.is_admin_or_engineer());

-- ── plakalar ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Yönetici can manage plakalar" ON public.plakalar;
CREATE POLICY "Admin ve mühendis plaka yönetir" ON public.plakalar
  FOR ALL TO authenticated
  USING (public.is_admin_or_engineer())
  WITH CHECK (public.is_admin_or_engineer());

-- ── plaka_parts ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Yönetici can manage plaka_parts" ON public.plaka_parts;
CREATE POLICY "Admin ve mühendis plaka_parts yönetir" ON public.plaka_parts
  FOR ALL TO authenticated
  USING (public.is_admin_or_engineer())
  WITH CHECK (public.is_admin_or_engineer());

-- ── kesim_makinesi ───────────────────────────────────────────
DROP POLICY IF EXISTS "Admin can manage machines" ON public.kesim_makinesi;
CREATE POLICY "Admin ve mühendis makine yönetir" ON public.kesim_makinesi
  FOR ALL TO authenticated
  USING (public.is_admin_or_engineer())
  WITH CHECK (public.is_admin_or_engineer());
