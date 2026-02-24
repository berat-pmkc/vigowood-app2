-- ================================================================
-- Trendyol Sync Tables
-- Cron ile API'den çekilen veriler burada tutulur.
-- Sayfalar doğrudan API yerine bu tablolardan okur.
-- ================================================================

-- ─── Helper Function ──────────────────────────────────────
CREATE OR REPLACE FUNCTION has_marketplace_access()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE auth_id = auth.uid()
      AND role IN ('Yönetici', 'E-Ticaret Müdürü', 'Dış Ticaret Müdürü', 'Pazaryeri Sorumlusu')
  );
$$;

-- ─── 1. trendyol_orders ──────────────────────────────────
CREATE TABLE IF NOT EXISTS trendyol_orders (
  id              BIGINT PRIMARY KEY,  -- shipmentPackageId
  order_number    TEXT NOT NULL,
  customer_id     BIGINT,
  customer_first_name TEXT,
  customer_last_name  TEXT,
  customer_email  TEXT,
  gross_amount    NUMERIC(12,2) DEFAULT 0,
  total_discount  NUMERIC(12,2) DEFAULT 0,
  total_price     NUMERIC(12,2) DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'Created',
  shipment_address JSONB,
  invoice_address  JSONB,
  cargo_tracking_number BIGINT,
  cargo_tracking_link   TEXT,
  cargo_provider_name   TEXT,
  cargo_sender_number   TEXT,
  delivery_type   TEXT,
  order_date      BIGINT NOT NULL,         -- Trendyol timestamp (ms)
  last_modified_date BIGINT,
  package_histories JSONB,
  raw_data        JSONB,                    -- Full API response for fields we don't map
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trendyol_orders_status ON trendyol_orders(status);
CREATE INDEX IF NOT EXISTS idx_trendyol_orders_order_number ON trendyol_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_trendyol_orders_order_date ON trendyol_orders(order_date DESC);
CREATE INDEX IF NOT EXISTS idx_trendyol_orders_last_modified ON trendyol_orders(last_modified_date DESC);

ALTER TABLE trendyol_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_orders" ON trendyol_orders
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "admin_all_orders" ON trendyol_orders
  FOR ALL USING (is_admin());

CREATE TRIGGER set_trendyol_orders_updated_at
  BEFORE UPDATE ON trendyol_orders
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─── 2. trendyol_order_lines ─────────────────────────────
CREATE TABLE IF NOT EXISTS trendyol_order_lines (
  id              BIGINT PRIMARY KEY,
  order_id        BIGINT NOT NULL REFERENCES trendyol_orders(id) ON DELETE CASCADE,
  line_id         BIGINT,
  quantity        INTEGER DEFAULT 1,
  merchant_sku    TEXT,
  sku             TEXT,
  stock_code      TEXT,
  product_name    TEXT NOT NULL,
  barcode         TEXT,
  amount          NUMERIC(12,2) DEFAULT 0,
  discount        NUMERIC(12,2) DEFAULT 0,
  currency_code   TEXT DEFAULT 'TRY',
  vat_base_amount NUMERIC(12,2) DEFAULT 0,
  vat_rate        NUMERIC(5,2),
  price           NUMERIC(12,2) DEFAULT 0,
  status_name     TEXT,
  commission      NUMERIC(5,2),
  product_size    TEXT,
  product_color   TEXT,
  image_url       TEXT
);

CREATE INDEX IF NOT EXISTS idx_trendyol_order_lines_order_id ON trendyol_order_lines(order_id);
CREATE INDEX IF NOT EXISTS idx_trendyol_order_lines_barcode ON trendyol_order_lines(barcode);

ALTER TABLE trendyol_order_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_order_lines" ON trendyol_order_lines
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "admin_all_order_lines" ON trendyol_order_lines
  FOR ALL USING (is_admin());

-- ─── 3. trendyol_products ────────────────────────────────
CREATE TABLE IF NOT EXISTS trendyol_products (
  id              TEXT PRIMARY KEY,
  barcode         TEXT NOT NULL,
  title           TEXT NOT NULL,
  description     TEXT,
  product_main_id TEXT,
  brand           TEXT,
  brand_id        INTEGER,
  category_name   TEXT,
  category_id     INTEGER,
  quantity        INTEGER DEFAULT 0,
  stock_code      TEXT,
  dimensional_weight NUMERIC(10,2),
  list_price      NUMERIC(12,2) DEFAULT 0,
  sale_price      NUMERIC(12,2) DEFAULT 0,
  vat_rate        NUMERIC(5,2),
  images          JSONB,
  attributes      JSONB,
  approved        BOOLEAN DEFAULT false,
  archived        BOOLEAN DEFAULT false,
  on_sale         BOOLEAN DEFAULT false,
  locked          BOOLEAN DEFAULT false,
  rejected        BOOLEAN DEFAULT false,
  blacklisted     BOOLEAN DEFAULT false,
  create_date_time BIGINT,
  last_update_date BIGINT,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trendyol_products_barcode ON trendyol_products(barcode);
CREATE INDEX IF NOT EXISTS idx_trendyol_products_stock_code ON trendyol_products(stock_code);
CREATE INDEX IF NOT EXISTS idx_trendyol_products_on_sale ON trendyol_products(on_sale);
CREATE INDEX IF NOT EXISTS idx_trendyol_products_approved ON trendyol_products(approved);

ALTER TABLE trendyol_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_products" ON trendyol_products
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "admin_all_products" ON trendyol_products
  FOR ALL USING (is_admin());

CREATE TRIGGER set_trendyol_products_updated_at
  BEFORE UPDATE ON trendyol_products
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─── 4. trendyol_questions ───────────────────────────────
CREATE TABLE IF NOT EXISTS trendyol_questions (
  id              BIGINT PRIMARY KEY,
  text            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'WAITING_FOR_ANSWER',
  creation_date   BIGINT NOT NULL,
  customer_id     BIGINT,
  user_name       TEXT,
  product_name    TEXT,
  product_main_id TEXT,
  image_url       TEXT,
  public          BOOLEAN DEFAULT true,
  answer_text     TEXT,
  answer_date     BIGINT,
  rejected_answer_text TEXT,
  rejected_answer_reason TEXT,
  web_url         TEXT,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trendyol_questions_status ON trendyol_questions(status);
CREATE INDEX IF NOT EXISTS idx_trendyol_questions_creation_date ON trendyol_questions(creation_date DESC);

ALTER TABLE trendyol_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_questions" ON trendyol_questions
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "admin_all_questions" ON trendyol_questions
  FOR ALL USING (is_admin());

CREATE TRIGGER set_trendyol_questions_updated_at
  BEFORE UPDATE ON trendyol_questions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ─── 5. trendyol_settlements ─────────────────────────────
CREATE TABLE IF NOT EXISTS trendyol_settlements (
  id              BIGINT PRIMARY KEY,
  transaction_date TEXT,
  transaction_type TEXT NOT NULL,
  debt            NUMERIC(12,2) DEFAULT 0,
  credit          NUMERIC(12,2) DEFAULT 0,
  receipt_id      TEXT,
  barcode         TEXT,
  payment_order_id TEXT,
  payment_date    TEXT,
  commission_rate NUMERIC(5,2),
  commission_amount NUMERIC(12,2),
  seller_revenue  NUMERIC(12,2),
  order_number    TEXT,
  affiliate       TEXT,
  shipment_package_id BIGINT,
  raw_data        JSONB,
  created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trendyol_settlements_type ON trendyol_settlements(transaction_type);
CREATE INDEX IF NOT EXISTS idx_trendyol_settlements_date ON trendyol_settlements(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_trendyol_settlements_order ON trendyol_settlements(order_number);

ALTER TABLE trendyol_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_settlements" ON trendyol_settlements
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "admin_all_settlements" ON trendyol_settlements
  FOR ALL USING (is_admin());

-- ─── 6. trendyol_sync_log ───────────────────────────────
CREATE TABLE IF NOT EXISTS trendyol_sync_log (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type     TEXT NOT NULL,  -- 'orders' | 'products' | 'questions' | 'settlements'
  status          TEXT NOT NULL DEFAULT 'running',  -- 'running' | 'success' | 'error'
  started_at      TIMESTAMPTZ DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  records_synced  INTEGER DEFAULT 0,
  error_message   TEXT,
  metadata        JSONB
);

CREATE INDEX IF NOT EXISTS idx_trendyol_sync_log_entity ON trendyol_sync_log(entity_type, started_at DESC);

ALTER TABLE trendyol_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_sync_log" ON trendyol_sync_log
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "admin_all_sync_log" ON trendyol_sync_log
  FOR ALL USING (is_admin());
