-- Yeni rol: Üretim ve Planlama Sorumlusu (tam yönetici yetkisi, bkz. 003).
-- NOT: ALTER TYPE ... ADD VALUE yeni değer aynı transaction içinde
-- kullanılamaz; bu yüzden tek başına bir migration dosyasıdır.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'Üretim ve Planlama Sorumlusu';
