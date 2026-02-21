-- VigoWood Platform — Katman 21: Personel & Yoklama
-- attendance tablosuna updated_at + RLS genişletme

---------------------------------------------------
-- 1. updated_at kolonu ekle
---------------------------------------------------
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- handle_updated_at trigger (mevcut fonksiyon)
CREATE TRIGGER set_attendance_updated_at
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

---------------------------------------------------
-- 2. has_personel_access() SECURITY DEFINER fonksiyon
-- Yönetici + Endüstri Mühendisi + Hat
---------------------------------------------------
CREATE OR REPLACE FUNCTION public.has_personel_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role IN ('Yönetici', 'Endüstri Mühendisi', 'Hat')
      AND is_active = true
  );
$$;

---------------------------------------------------
-- 3. RLS Policy genişletme
-- Mevcut: authenticated SELECT + Yönetici ALL
-- Eklenen: Hat ve Endüstri Mühendisi INSERT + UPDATE
---------------------------------------------------

-- INSERT policy: has_personel_access (Yönetici + Endüstri Mühendisi + Hat)
CREATE POLICY "Personel access can insert attendance"
  ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (has_personel_access());

-- UPDATE policy: has_personel_access
CREATE POLICY "Personel access can update attendance"
  ON public.attendance FOR UPDATE TO authenticated
  USING (has_personel_access())
  WITH CHECK (has_personel_access());

-- DELETE policy: sadece Yönetici (is_admin() zaten mevcut Yönetici ALL policy'de)
-- Mevcut "Yönetici can manage attendance" policy zaten DELETE'i kapsıyor
