-- VigoWood Platform — Migration 029: Users Password + Last Sign In view
-- Kullanıcılara password_plain alanı ekle, şifre pattern: İsim2026.

-- 1. password_plain kolonu ekle
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_plain TEXT;

-- 2. Tüm kullanıcılar için şifre oluştur: İlk isim + 2026.
UPDATE public.users
SET password_plain = split_part(full_name, ' ', 1) || '2026.';

-- 3. last_sign_in_at bilgisini auth.users'dan çekmek için SECURITY DEFINER fonksiyon
CREATE OR REPLACE FUNCTION public.get_user_last_sign_in(p_auth_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT last_sign_in_at FROM auth.users WHERE id = p_auth_id;
$$;

-- 4. Toplu olarak tüm kullanıcıların last_sign_in bilgisini çekmek için fonksiyon
CREATE OR REPLACE FUNCTION public.get_all_users_last_sign_in()
RETURNS TABLE(auth_id UUID, last_sign_in_at TIMESTAMPTZ)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, last_sign_in_at FROM auth.users;
$$;
