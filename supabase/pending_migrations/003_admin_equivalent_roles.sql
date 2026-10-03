-- =============================================================
-- Yönetici-eşdeğeri roller:
--   'Yönetici', 'E-Ticaret Müdürü', 'Üretim ve Planlama Sorumlusu'
-- Uygulama karşılığı: ADMIN_EQUIVALENT_ROLES (src/lib/constants.ts)
--
-- 1) is_admin() bu üç rolü kabul eder.
-- 2) Diğer tüm yardımcı fonksiyonlar (is_admin_or_engineer, has_*_access,
--    is_admin_or_finance) en son gövdesi + "OR public.is_admin()" ile yeniden
--    yazılır. İmzalar değişmez.
-- 3) 'Yönetici' rolünü inline kontrol eden mevcut RLS politikaları
--    (users tablosuna bakan alt sorgular) yeni rolleri de kapsayacak şekilde
--    ALTER POLICY ile güncellenir.
-- Ön koşul: 002_add_role_uretim_planlama.sql uygulanmış olmalı.
-- =============================================================

-- ── 1. is_admin ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('Yönetici', 'E-Ticaret Müdürü', 'Üretim ve Planlama Sorumlusu')
  );
$$;

-- ── 2. Diğer yardımcılar (+ OR is_admin()) ────────────────────
CREATE OR REPLACE FUNCTION public.is_admin_or_engineer()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
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
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('Yönetici', 'Endüstri Mühendisi', 'Üretim', 'Hat')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_stock_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('Yönetici', 'Endüstri Mühendisi', 'E-Ticaret Müdürü', 'Dış Ticaret Müdürü', 'Muhasebe')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_sevkiyat_access()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
    AND role IN ('Yönetici', 'Endüstri Mühendisi', 'Sevkiyat Sorumlusu', 'E-Ticaret Müdürü', 'Dış Ticaret Müdürü')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_personel_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role IN ('Yönetici', 'Endüstri Mühendisi', 'E-Ticaret Müdürü', 'Dış Ticaret Müdürü', 'Hat')
      AND is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_finance()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.users
    WHERE auth_id = auth.uid()
      AND role IN ('Yönetici', 'Muhasebe', 'E-Ticaret Müdürü')
      AND is_active = true
  );
$$;

-- ── 3. Inline 'Yönetici' kontrolü yapan RLS politikaları ──────
-- Eski migration'larda (001-008) politikalar users tablosuna bakan inline
-- alt sorgularla 'Yönetici' (veya 'Yönetici' içeren rol listeleri) kontrol
-- ediyor. Tüm schema'larda (public, storage) bu politikalar taranır ve
-- 'Yönetici' değeri üç yönetici-eşdeğeri rolle genişletilir.
-- Idempotent: zaten 'Üretim ve Planlama Sorumlusu' içeren politika atlanır.
DO $$
DECLARE
  r RECORD;
  v_qual TEXT;
  v_check TEXT;
  v_sql TEXT;
  v_pat_single CONSTANT TEXT := '= ''Yönetici''::((?:public\.)?\w+)';
  v_pat_any    CONSTANT TEXT := '''Yönetici''::((?:public\.)?\w+)';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, qual, with_check
    FROM pg_policies
    WHERE schemaname IN ('public', 'storage')
      AND (COALESCE(qual, '') LIKE '%Yönetici%' OR COALESCE(with_check, '') LIKE '%Yönetici%')
      AND COALESCE(qual, '') NOT LIKE '%Üretim ve Planlama Sorumlusu%'
      AND COALESCE(with_check, '') NOT LIKE '%Üretim ve Planlama Sorumlusu%'
  LOOP
    v_qual := r.qual;
    v_check := r.with_check;

    IF v_qual IS NOT NULL THEN
      -- (1) role = 'Yönetici'  ->  role = ANY (ARRAY['Yönetici'])
      v_qual := regexp_replace(v_qual, v_pat_single, '= ANY (ARRAY[''Yönetici''::\1])', 'g');
      -- (2) her 'Yönetici' değerini üç rolle genişlet (ARRAY içinde)
      v_qual := regexp_replace(v_qual, v_pat_any,
        '''Yönetici''::\1, ''E-Ticaret Müdürü''::\1, ''Üretim ve Planlama Sorumlusu''::\1', 'g');
    END IF;
    IF v_check IS NOT NULL THEN
      v_check := regexp_replace(v_check, v_pat_single, '= ANY (ARRAY[''Yönetici''::\1])', 'g');
      v_check := regexp_replace(v_check, v_pat_any,
        '''Yönetici''::\1, ''E-Ticaret Müdürü''::\1, ''Üretim ve Planlama Sorumlusu''::\1', 'g');
    END IF;

    v_sql := format('ALTER POLICY %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    IF v_qual IS NOT NULL THEN
      v_sql := v_sql || ' USING (' || v_qual || ')';
    END IF;
    IF v_check IS NOT NULL THEN
      v_sql := v_sql || ' WITH CHECK (' || v_check || ')';
    END IF;

    EXECUTE v_sql;
    RAISE NOTICE 'Politika güncellendi: %.% / %', r.schemaname, r.tablename, r.policyname;
  END LOOP;
END
$$;
