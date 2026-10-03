-- =============================================================
-- mola_planlari: RLS aç. Kod yalnızca OKUR (admin/kullanicilar -> getMolaPlanlari);
-- yazma yalnızca Yönetici/Endüstri Mühendisi (is_admin_or_engineer).
-- =============================================================
ALTER TABLE public.mola_planlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mola planlari oku" ON public.mola_planlari;
CREATE POLICY "mola planlari oku" ON public.mola_planlari
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mola planlari yaz" ON public.mola_planlari;
CREATE POLICY "mola planlari yaz" ON public.mola_planlari
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_engineer());

DROP POLICY IF EXISTS "mola planlari duzelt" ON public.mola_planlari;
CREATE POLICY "mola planlari duzelt" ON public.mola_planlari
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_engineer()) WITH CHECK (public.is_admin_or_engineer());

DROP POLICY IF EXISTS "mola planlari sil" ON public.mola_planlari;
CREATE POLICY "mola planlari sil" ON public.mola_planlari
  FOR DELETE TO authenticated
  USING (public.is_admin_or_engineer());
