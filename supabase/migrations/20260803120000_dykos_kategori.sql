-- product_category enum'una DYKOS kategorisi eklenir.
--
-- DYKOS (Dönebilir Yükseklik Ayarlanabilir Kitap Okuma Standı) yeni bir
-- ürün ailesi: DYKOS01A / DYKOS01M / DYKOS01E.
-- Kaynak projede kategori enum'a hiç eklenmemiş, ürünler de yüklenmemişti.
ALTER TYPE public.product_category ADD VALUE IF NOT EXISTS 'DYKOS';
