-- ============================================================
-- Migration: İkas Siparişleri Tablosu
-- İkas API'den çekilen siparişleri Supabase'de saklar
-- ============================================================

CREATE TABLE public.ikas_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ikas_id TEXT NOT NULL,
  order_number TEXT,
  status TEXT,
  total_price NUMERIC(12,2),
  currency TEXT DEFAULT 'TRY',
  city TEXT,
  country TEXT,
  line_items JSONB DEFAULT '[]'::jsonb,
  ikas_created_at TIMESTAMPTZ,
  synced_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,

  CONSTRAINT ikas_orders_ikas_id_unique UNIQUE (ikas_id)
);

-- Indexes
CREATE INDEX idx_ikas_orders_order_number ON public.ikas_orders(order_number);
CREATE INDEX idx_ikas_orders_ikas_created_at ON public.ikas_orders(ikas_created_at DESC);
CREATE INDEX idx_ikas_orders_status ON public.ikas_orders(status);

-- Updated at trigger
CREATE TRIGGER set_ikas_orders_updated_at
  BEFORE UPDATE ON public.ikas_orders
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS: SELECT authenticated, INSERT/UPDATE service_role only (bypasses RLS)
ALTER TABLE public.ikas_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view ikas orders" ON public.ikas_orders
  FOR SELECT USING (auth.uid() IS NOT NULL);
