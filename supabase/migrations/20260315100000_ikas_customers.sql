-- ============================================================
-- Migration: İkas Müşteriler Tablosu
-- İkas API'den senkronize edilen müşteri verileri
-- ============================================================

-- Segment hesaplama fonksiyonu
CREATE OR REPLACE FUNCTION public.calculate_customer_segment(
  p_order_count INTEGER,
  p_total_spent NUMERIC,
  p_last_order_date TIMESTAMPTZ
) RETURNS TEXT AS $$
BEGIN
  IF p_order_count = 0 OR p_order_count IS NULL THEN RETURN 'new'; END IF;
  IF p_order_count >= 5 AND p_total_spent >= 10000 THEN RETURN 'vip'; END IF;
  IF p_order_count >= 3 OR p_total_spent >= 5000 THEN RETURN 'loyal'; END IF;
  IF p_last_order_date >= NOW() - INTERVAL '90 days' THEN RETURN 'regular'; END IF;
  RETURN 'dormant';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Ana tablo
CREATE TABLE public.ikas_customers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ikas_customer_id TEXT NOT NULL,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  city TEXT,
  country TEXT DEFAULT 'TR',
  order_count INTEGER DEFAULT 0,
  total_spent NUMERIC(12,2) DEFAULT 0,
  first_order_date TIMESTAMPTZ,
  last_order_date TIMESTAMPTZ,
  customer_segment TEXT DEFAULT 'new'
    CHECK (customer_segment IN ('vip','loyal','regular','new','dormant')),
  ikas_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT ikas_customers_ikas_customer_id_unique UNIQUE (ikas_customer_id)
);

-- Indexes
CREATE UNIQUE INDEX idx_ikas_customers_email ON public.ikas_customers(email) WHERE email IS NOT NULL;
CREATE INDEX idx_ikas_customers_segment ON public.ikas_customers(customer_segment);

-- Updated at trigger
CREATE TRIGGER set_ikas_customers_updated_at
  BEFORE UPDATE ON public.ikas_customers
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE public.ikas_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ikas customers" ON public.ikas_customers
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can insert ikas customers" ON public.ikas_customers
  FOR INSERT WITH CHECK (is_admin());

CREATE POLICY "Admins can update ikas customers" ON public.ikas_customers
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete ikas customers" ON public.ikas_customers
  FOR DELETE USING (is_admin());
