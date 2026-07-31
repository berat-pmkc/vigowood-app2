-- =============================================================
-- Özet tabloları: daily_summary, weekly_sku_summary, monthly_sku_summary
--
-- EKSİK MIGRATION TELAFİSİ
-- Bu üç tablo kaynak projede migration ile değil elle oluşturulmuş.
-- Sonuçta 20260301110000_summary_multi_channel.sql bunlara ALTER TABLE
-- atıyor ama tablolar hiçbir migration'da CREATE edilmiyor — temiz bir
-- veritabanına push yapıldığında zincir burada kırılıyor.
--
-- Kolonlar src/lib/supabase/types.ts'den (kaynak DB'den generate edilmiş)
-- birebir çıkarıldı. Sıradaki migration channel/master_sku kolonlarını
-- ekleyip constraint'leri değiştireceği için burada onlar YOK — tablolar
-- multi-channel öncesi haliyle oluşturuluyor.
-- =============================================================

-- 1. daily_summary — kanal bazlı günlük satış özeti
CREATE TABLE IF NOT EXISTS public.daily_summary (
  date                  DATE PRIMARY KEY,
  total_orders          INTEGER NOT NULL DEFAULT 0,
  total_revenue         NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_basket            NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_count          INTEGER NOT NULL DEFAULT 0,
  total_refunds         NUMERIC(14,2) NOT NULL DEFAULT 0,
  status_distribution   JSONB,
  top_cities            JSONB,
  top_products          JSONB,
  top_refunded_products JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. weekly_sku_summary — SKU bazlı haftalık özet
CREATE TABLE IF NOT EXISTS public.weekly_sku_summary (
  week_start     DATE NOT NULL,
  sku            TEXT NOT NULL,
  product_name   TEXT NOT NULL DEFAULT '',
  quantity_sold  INTEGER NOT NULL DEFAULT 0,
  revenue        NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_price      NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (week_start, sku)
);

-- 3. monthly_sku_summary — SKU bazlı aylık özet
CREATE TABLE IF NOT EXISTS public.monthly_sku_summary (
  month_start    DATE NOT NULL,
  sku            TEXT NOT NULL,
  product_name   TEXT NOT NULL DEFAULT '',
  quantity_sold  INTEGER NOT NULL DEFAULT 0,
  revenue        NUMERIC(14,2) NOT NULL DEFAULT 0,
  avg_price      NUMERIC(14,2) NOT NULL DEFAULT 0,
  refund_count   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (month_start, sku)
);

-- =============================================================
-- updated_at trigger'ları
-- =============================================================
DROP TRIGGER IF EXISTS set_daily_summary_updated_at ON public.daily_summary;
CREATE TRIGGER set_daily_summary_updated_at
  BEFORE UPDATE ON public.daily_summary
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_weekly_sku_summary_updated_at ON public.weekly_sku_summary;
CREATE TRIGGER set_weekly_sku_summary_updated_at
  BEFORE UPDATE ON public.weekly_sku_summary
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_monthly_sku_summary_updated_at ON public.monthly_sku_summary;
CREATE TRIGGER set_monthly_sku_summary_updated_at
  BEFORE UPDATE ON public.monthly_sku_summary
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- =============================================================
-- RLS — okuma authenticated, yazma service_role (sync job'ları)
-- =============================================================
ALTER TABLE public.daily_summary        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_sku_summary   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_sku_summary  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read daily_summary" ON public.daily_summary;
CREATE POLICY "Authenticated read daily_summary"
  ON public.daily_summary FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read weekly_sku_summary" ON public.weekly_sku_summary;
CREATE POLICY "Authenticated read weekly_sku_summary"
  ON public.weekly_sku_summary FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated read monthly_sku_summary" ON public.monthly_sku_summary;
CREATE POLICY "Authenticated read monthly_sku_summary"
  ON public.monthly_sku_summary FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage daily_summary" ON public.daily_summary;
CREATE POLICY "Admin manage daily_summary"
  ON public.daily_summary FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage weekly_sku_summary" ON public.weekly_sku_summary;
CREATE POLICY "Admin manage weekly_sku_summary"
  ON public.weekly_sku_summary FOR ALL TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Admin manage monthly_sku_summary" ON public.monthly_sku_summary;
CREATE POLICY "Admin manage monthly_sku_summary"
  ON public.monthly_sku_summary FOR ALL TO authenticated USING (public.is_admin());
