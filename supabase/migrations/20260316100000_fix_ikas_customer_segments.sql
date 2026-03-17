-- ============================================================
-- Migration: İkas Customer Segment Constraint Düzeltme
-- DB segment isimleri frontend ile uyumlu hale getiriliyor
-- Eski: vip, loyal, regular, new, dormant
-- Yeni: vip, sadik, aktif, yeni, kayip, potansiyel
-- ============================================================

-- 1. Mevcut verileri güncelle (eğer varsa)
UPDATE public.ikas_customers SET customer_segment = 'sadik' WHERE customer_segment = 'loyal';
UPDATE public.ikas_customers SET customer_segment = 'aktif' WHERE customer_segment = 'regular';
UPDATE public.ikas_customers SET customer_segment = 'yeni' WHERE customer_segment = 'new';
UPDATE public.ikas_customers SET customer_segment = 'kayip' WHERE customer_segment = 'dormant';

-- 2. Eski constraint kaldır, yeni ekle
ALTER TABLE public.ikas_customers DROP CONSTRAINT IF EXISTS ikas_customers_customer_segment_check;
ALTER TABLE public.ikas_customers ADD CONSTRAINT ikas_customers_customer_segment_check
  CHECK (customer_segment IN ('vip','sadik','aktif','yeni','kayip','potansiyel'));

-- 3. Default güncelle
ALTER TABLE public.ikas_customers ALTER COLUMN customer_segment SET DEFAULT 'yeni';

-- 4. Segment hesaplama fonksiyonunu güncelle (frontend mantığıyla uyumlu)
CREATE OR REPLACE FUNCTION public.calculate_customer_segment(
  p_order_count INTEGER,
  p_total_spent NUMERIC,
  p_last_order_date TIMESTAMPTZ
) RETURNS TEXT AS $$
BEGIN
  -- Potansiyel: hiç siparişi yok
  IF p_order_count IS NULL OR p_order_count = 0 THEN RETURN 'potansiyel'; END IF;

  -- Kayıp: son sipariş 12 aydan eski
  IF p_last_order_date IS NULL OR p_last_order_date < NOW() - INTERVAL '12 months' THEN
    RETURN 'kayip';
  END IF;

  -- VIP: (10+ sipariş VEYA 20.000₺+ harcama) VE son 6 ayda aktif
  IF (p_order_count >= 10 OR COALESCE(p_total_spent, 0) >= 20000)
     AND p_last_order_date >= NOW() - INTERVAL '6 months' THEN
    RETURN 'vip';
  END IF;

  -- Yeni: ilk sipariş son 3 ay (first_order_date yok burada, order_count=1 ve son sipariş yakınsa)
  -- Not: Bu fonksiyon first_order_date almıyor, basit yaklaşım
  IF p_order_count <= 2 AND p_last_order_date >= NOW() - INTERVAL '3 months' THEN
    RETURN 'yeni';
  END IF;

  -- Sadık: 3+ sipariş VE son 12 ayda aktif
  IF p_order_count >= 3 THEN RETURN 'sadik'; END IF;

  -- Aktif: 1+ sipariş VE son 6 ayda aktif
  IF p_last_order_date >= NOW() - INTERVAL '6 months' THEN RETURN 'aktif'; END IF;

  -- Fallback: 6-12 ay arası sessiz
  RETURN 'kayip';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. RLS policy'leri güncelle — sync için service_role INSERT/UPDATE ekle
-- Mevcut admin policy'ler kalıyor, service_role ek policy
DO $$
BEGIN
  -- Service role zaten RLS bypass eder, ek policy gerekmez
  -- Ama is_admin_or_finance() olan kullanıcılara da okuma izni verelim
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ikas_customers'
    AND policyname = 'Finance users can view ikas customers'
  ) THEN
    CREATE POLICY "Finance users can view ikas customers" ON public.ikas_customers
      FOR SELECT USING (is_admin_or_finance());
  END IF;
END $$;
