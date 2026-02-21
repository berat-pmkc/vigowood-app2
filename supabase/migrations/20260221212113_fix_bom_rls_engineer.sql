-- Fix BOM RLS policies: allow Endüstri Mühendisi to manage assembly_steps and step_bom
-- Previously only is_admin() (Yönetici) could write, but requireAdmin() in code also allows Endüstri Mühendisi
-- This caused silent failures for Endüstri Mühendisi users

-- 1. Fix assembly_steps write policy
DROP POLICY IF EXISTS "Yönetici can manage assembly_steps" ON public.assembly_steps;

CREATE POLICY "Admin can manage assembly_steps"
  ON public.assembly_steps
  FOR ALL
  TO authenticated
  USING (is_admin_or_engineer())
  WITH CHECK (is_admin_or_engineer());

-- 2. Fix step_bom write policy
DROP POLICY IF EXISTS "Yönetici can manage step_bom" ON public.step_bom;

CREATE POLICY "Admin can manage step_bom"
  ON public.step_bom
  FOR ALL
  TO authenticated
  USING (is_admin_or_engineer())
  WITH CHECK (is_admin_or_engineer());
