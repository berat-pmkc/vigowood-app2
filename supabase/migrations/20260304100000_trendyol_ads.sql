-- ================================================================
-- Trendyol Reklam Yönetimi Tabloları
-- Excel'den yüklenen kümülatif snapshot verisi + haftalık delta
-- ================================================================

-- ─── 1. trendyol_ad_snapshots ──────────────────────────────────
-- Her Excel yüklemesinde, her reklam satırı ayrı row olarak saklanır.
-- Kümülatif değerler (harcama, tıklanma, ciro vb.)
CREATE TABLE IF NOT EXISTS trendyol_ad_snapshots (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date     DATE NOT NULL,              -- Dosya adından parse edilen tarih
  ad_name           TEXT NOT NULL,              -- Reklam adı (unique key per snapshot)
  status            TEXT,                       -- Reklam Statüsü (Yayında, Duraklatıldı vb.)
  start_date        TEXT,                       -- Başlangıç Tarihi (raw text)
  end_date          TEXT,                       -- Bitiş Tarihi (genelde "-")
  product_count     INTEGER DEFAULT 0,          -- Ürün Adedi
  content_ids       TEXT,                       -- Ürün ContentId Listesi (virgülle ayrılmış)
  total_budget      NUMERIC(12,2),              -- Toplam Bütçe
  daily_budget      NUMERIC(12,2),              -- Günlük Bütçe
  remaining_budget  NUMERIC(12,2),              -- Kalan Bütçe
  spent             NUMERIC(12,2) DEFAULT 0,    -- Harcanan Bütçe (KÜMÜLATİF)
  cpc_bid           TEXT,                       -- TBM Teklifi (opsiyonel, raw text)
  actual_cpc        NUMERIC(8,4) DEFAULT 0,     -- Gerçekleşen TBM
  clicks            INTEGER DEFAULT 0,          -- Tıklanma (KÜMÜLATİF)
  impressions       INTEGER DEFAULT 0,          -- Görüntülenme (KÜMÜLATİF)
  direct_sales      INTEGER DEFAULT 0,          -- Doğrudan Satış Adedi (KÜMÜLATİF)
  indirect_sales    INTEGER DEFAULT 0,          -- Dolaylı Satış Adedi (KÜMÜLATİF)
  total_sales       INTEGER DEFAULT 0,          -- Toplam Satış Adedi (KÜMÜLATİF)
  direct_revenue    NUMERIC(12,2) DEFAULT 0,    -- Doğrudan Reklam Cirosu (KÜMÜLATİF)
  indirect_revenue  NUMERIC(12,2) DEFAULT 0,    -- Dolaylı Reklam Cirosu (KÜMÜLATİF)
  total_revenue     NUMERIC(12,2) DEFAULT 0,    -- Toplam Reklam Cirosu (KÜMÜLATİF)
  cumulative_roas   NUMERIC(8,2) DEFAULT 0,     -- Harcama Getirisi (kümülatif)
  uploaded_by       TEXT,                       -- Yükleyen kullanıcı adı
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(snapshot_date, ad_name)
);

CREATE INDEX IF NOT EXISTS idx_ad_snapshots_date ON trendyol_ad_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_ad_snapshots_ad_name ON trendyol_ad_snapshots(ad_name);

ALTER TABLE trendyol_ad_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_ad_snapshots" ON trendyol_ad_snapshots
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "marketplace_insert_ad_snapshots" ON trendyol_ad_snapshots
  FOR INSERT WITH CHECK (has_marketplace_access());

CREATE POLICY "admin_all_ad_snapshots" ON trendyol_ad_snapshots
  FOR ALL USING (is_admin());

-- ─── 2. trendyol_ad_weekly ─────────────────────────────────────
-- İki snapshot arası delta hesabı — haftalık performans metrikleri
CREATE TABLE IF NOT EXISTS trendyol_ad_weekly (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_name           TEXT NOT NULL,
  period_start      DATE NOT NULL,              -- Önceki snapshot tarihi (veya reklam başlangıcı)
  period_end        DATE NOT NULL,              -- Bu snapshot tarihi
  days_in_period    INTEGER DEFAULT 0,          -- Periyot gün sayısı
  spent             NUMERIC(12,2) DEFAULT 0,    -- Delta harcama
  clicks            INTEGER DEFAULT 0,          -- Delta tıklanma
  impressions       INTEGER DEFAULT 0,          -- Delta görüntülenme
  direct_sales      INTEGER DEFAULT 0,          -- Delta doğrudan satış
  indirect_sales    INTEGER DEFAULT 0,          -- Delta dolaylı satış
  total_sales       INTEGER DEFAULT 0,          -- Delta toplam satış
  direct_revenue    NUMERIC(12,2) DEFAULT 0,    -- Delta doğrudan ciro
  indirect_revenue  NUMERIC(12,2) DEFAULT 0,    -- Delta dolaylı ciro
  total_revenue     NUMERIC(12,2) DEFAULT 0,    -- Delta toplam ciro
  roas              NUMERIC(8,2) DEFAULT 0,     -- total_revenue / spent
  ctr               NUMERIC(8,4) DEFAULT 0,     -- clicks / impressions * 100
  cvr               NUMERIC(8,4) DEFAULT 0,     -- total_sales / clicks * 100
  cpa               NUMERIC(12,2) DEFAULT 0,    -- spent / total_sales
  actual_cpc        NUMERIC(8,4) DEFAULT 0,     -- Snapshot'taki gerçekleşen TBM
  created_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(period_end, ad_name)
);

CREATE INDEX IF NOT EXISTS idx_ad_weekly_period ON trendyol_ad_weekly(period_end DESC);
CREATE INDEX IF NOT EXISTS idx_ad_weekly_ad_name ON trendyol_ad_weekly(ad_name);

ALTER TABLE trendyol_ad_weekly ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_ad_weekly" ON trendyol_ad_weekly
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "marketplace_insert_ad_weekly" ON trendyol_ad_weekly
  FOR INSERT WITH CHECK (has_marketplace_access());

CREATE POLICY "marketplace_update_ad_weekly" ON trendyol_ad_weekly
  FOR UPDATE USING (has_marketplace_access());

CREATE POLICY "admin_all_ad_weekly" ON trendyol_ad_weekly
  FOR ALL USING (is_admin());

-- ─── 3. trendyol_ad_sku_mappings ───────────────────────────────
-- Reklam adı → ürün SKU eşleştirmesi (max 2 SKU per ad)
CREATE TABLE IF NOT EXISTS trendyol_ad_sku_mappings (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_name           TEXT NOT NULL UNIQUE,        -- Reklam adı
  product_ids       TEXT[] DEFAULT '{}',         -- products.urun_id array (max 2)
  updated_at        TIMESTAMPTZ DEFAULT now(),
  updated_by        TEXT                         -- Güncelleyen kullanıcı adı
);

ALTER TABLE trendyol_ad_sku_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "marketplace_select_ad_sku" ON trendyol_ad_sku_mappings
  FOR SELECT USING (has_marketplace_access());

CREATE POLICY "marketplace_insert_ad_sku" ON trendyol_ad_sku_mappings
  FOR INSERT WITH CHECK (has_marketplace_access());

CREATE POLICY "marketplace_update_ad_sku" ON trendyol_ad_sku_mappings
  FOR UPDATE USING (has_marketplace_access());

CREATE POLICY "admin_all_ad_sku" ON trendyol_ad_sku_mappings
  FOR ALL USING (is_admin());

CREATE TRIGGER set_ad_sku_mappings_updated_at
  BEFORE UPDATE ON trendyol_ad_sku_mappings
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();
