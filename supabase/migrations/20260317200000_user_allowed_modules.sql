-- Kullanıcı bazlı modül erişim yönetimi
-- NULL = rol varsayılanları (geriye uyumlu)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS allowed_modules TEXT[] DEFAULT NULL;
COMMENT ON COLUMN public.users.allowed_modules IS 'Kullanıcı bazlı modül erişimi. NULL = rol varsayılanları.';
