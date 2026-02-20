-- VigoWood Platform — Fix RLS infinite recursion
-- Problem: "Yönetici can manage" policies query public.users inside USING clause
-- When evaluating RLS on public.users itself, this creates infinite recursion.
-- Solution: SECURITY DEFINER functions bypass RLS, breaking the recursion.

-- ============================================================
-- 1. Helper functions (SECURITY DEFINER = bypasses RLS)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role = 'Yönetici'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_engineer()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('Yönetici', 'Endüstri Mühendisi')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_production_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('Yönetici', 'Endüstri Mühendisi', 'Üretim', 'Hat')
  );
$$;

-- ============================================================
-- 2. Fix users table policies (CRITICAL - this was causing recursion)
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage users" ON public.users;

CREATE POLICY "Yönetici can manage users"
  ON public.users
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 3. Fix products table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage products" ON public.products;

CREATE POLICY "Yönetici can manage products"
  ON public.products
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 4. Fix all_parts table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage parts" ON public.all_parts;

CREATE POLICY "Yönetici can manage parts"
  ON public.all_parts
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 5. Fix kesim_makinesi table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage machines" ON public.kesim_makinesi;

CREATE POLICY "Yönetici can manage machines"
  ON public.kesim_makinesi
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 6. Fix plakalar table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage plakalar" ON public.plakalar;

CREATE POLICY "Yönetici can manage plakalar"
  ON public.plakalar
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 7. Fix plaka_parts table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage plaka_parts" ON public.plaka_parts;

CREATE POLICY "Yönetici can manage plaka_parts"
  ON public.plaka_parts
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 8. Fix assembly_steps table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage assembly_steps" ON public.assembly_steps;

CREATE POLICY "Yönetici can manage assembly_steps"
  ON public.assembly_steps
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 9. Fix step_bom table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage step_bom" ON public.step_bom;

CREATE POLICY "Yönetici can manage step_bom"
  ON public.step_bom
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 10. Fix cut_batches table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage cut_batches" ON public.cut_batches;

CREATE POLICY "Yönetici can manage cut_batches"
  ON public.cut_batches
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 11. Fix cut_lines table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage cut_lines" ON public.cut_lines;

CREATE POLICY "Yönetici can manage cut_lines"
  ON public.cut_lines
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 12. Fix clean table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage clean" ON public.clean;

CREATE POLICY "Yönetici can manage clean"
  ON public.clean
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 13. Fix pack_events table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage pack_events" ON public.pack_events;

CREATE POLICY "Yönetici can manage pack_events"
  ON public.pack_events
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 14. Fix stock_movements table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage stock_movements" ON public.stock_movements;

CREATE POLICY "Yönetici can manage stock_movements"
  ON public.stock_movements
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 15. Fix yari_mamul_stok table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage yari_mamul_stok" ON public.yari_mamul_stok;

CREATE POLICY "Yönetici can manage yari_mamul_stok"
  ON public.yari_mamul_stok
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 16. Fix hazir_eleman_akis table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage hazir_eleman_akis" ON public.hazir_eleman_akis;

CREATE POLICY "Yönetici can manage hazir_eleman_akis"
  ON public.hazir_eleman_akis
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 17. Fix iade_giris table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage iade_giris" ON public.iade_giris;

CREATE POLICY "Yönetici can manage iade_giris"
  ON public.iade_giris
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 18. Fix attendance table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage attendance" ON public.attendance;

CREATE POLICY "Yönetici can manage attendance"
  ON public.attendance
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 19. Fix notifications table policies
-- ============================================================

DROP POLICY IF EXISTS "Yönetici can manage notifications" ON public.notifications;

CREATE POLICY "Yönetici can manage notifications"
  ON public.notifications
  FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================================
-- 20. Fix production access policies (from 006_kesim_status.sql and 008_temizlik_status.sql)
-- ============================================================

DROP POLICY IF EXISTS "Production roles can insert cut_batches" ON public.cut_batches;
DROP POLICY IF EXISTS "Production roles can update cut_batches" ON public.cut_batches;

CREATE POLICY "Production roles can insert cut_batches"
  ON public.cut_batches
  FOR INSERT
  TO authenticated
  WITH CHECK (has_production_access());

CREATE POLICY "Production roles can update cut_batches"
  ON public.cut_batches
  FOR UPDATE
  TO authenticated
  USING (has_production_access());

DROP POLICY IF EXISTS "Production roles can insert cut_lines" ON public.cut_lines;
DROP POLICY IF EXISTS "Production roles can update cut_lines" ON public.cut_lines;

CREATE POLICY "Production roles can insert cut_lines"
  ON public.cut_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (has_production_access());

CREATE POLICY "Production roles can update cut_lines"
  ON public.cut_lines
  FOR UPDATE
  TO authenticated
  USING (has_production_access());

DROP POLICY IF EXISTS "Production roles can insert yari_mamul_stok" ON public.yari_mamul_stok;

CREATE POLICY "Production roles can insert yari_mamul_stok"
  ON public.yari_mamul_stok
  FOR INSERT
  TO authenticated
  WITH CHECK (has_production_access());

DROP POLICY IF EXISTS "Production roles can insert/update clean" ON public.clean;
DROP POLICY IF EXISTS "Production roles can update clean" ON public.clean;

CREATE POLICY "Production roles can insert clean"
  ON public.clean
  FOR INSERT
  TO authenticated
  WITH CHECK (has_production_access());

CREATE POLICY "Production roles can update clean"
  ON public.clean
  FOR UPDATE
  TO authenticated
  USING (has_production_access());
