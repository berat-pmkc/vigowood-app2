-- Migration: Add Müdür roles to personel access
-- E-Ticaret Müdürü and Dış Ticaret Müdürü can now take attendance

CREATE OR REPLACE FUNCTION public.has_personel_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role IN ('Yönetici', 'Endüstri Mühendisi', 'E-Ticaret Müdürü', 'Dış Ticaret Müdürü', 'Hat')
      AND is_active = true
  );
$$;
