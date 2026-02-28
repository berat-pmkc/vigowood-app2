-- trendyol_claims: İade talepleri (claims) tablosu
-- API: GET /integration/order/sellers/{sellerId}/claims
-- Panel'deki "İadeler" sayısıyla eşleşmek için bu endpoint sync edilmelidir.
-- trendyol_orders.status="Returned" yalnızca tamamlanmış iade = panel "İade Edildi"
-- Bu tablo ise hem bekleyen hem tamamlanmış talepleri tutar = panel "İadeler" toplamı

CREATE TABLE IF NOT EXISTS trendyol_claims (
  id                    TEXT PRIMARY KEY,           -- TrendyolClaim.id (string UUID)
  order_number          TEXT NOT NULL,              -- ilgili sipariş numarası
  status                TEXT NOT NULL,              -- TrendyolClaimStatus
  claim_date            BIGINT NOT NULL,            -- iade talebi tarihi (ms timestamp)
  shipment_package_id   BIGINT,                     -- ilgili sipariş paketi
  cargo_tracking_number TEXT,                       -- iade kargosu takip no
  items                 JSONB NOT NULL DEFAULT '[]',-- TrendyolClaimItem[]
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- updated_at otomatik güncelleme trigger
CREATE TRIGGER set_trendyol_claims_updated_at
  BEFORE UPDATE ON trendyol_claims
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_trendyol_claims_order_number ON trendyol_claims(order_number);
CREATE INDEX IF NOT EXISTS idx_trendyol_claims_status       ON trendyol_claims(status);
CREATE INDEX IF NOT EXISTS idx_trendyol_claims_claim_date   ON trendyol_claims(claim_date DESC);
CREATE INDEX IF NOT EXISTS idx_trendyol_claims_pkg_id       ON trendyol_claims(shipment_package_id);

-- RLS
ALTER TABLE trendyol_claims ENABLE ROW LEVEL SECURITY;

-- SELECT: pazaryeri erişimi olan roller (has_marketplace_access SECURITY DEFINER fonksiyon)
CREATE POLICY "marketplace_select_claims" ON trendyol_claims
  FOR SELECT USING (has_marketplace_access());

-- ALL (service role bypass eder, yedek olarak admin)
CREATE POLICY "admin_all_claims" ON trendyol_claims
  FOR ALL USING (is_admin());

COMMENT ON TABLE trendyol_claims IS 'Trendyol iade talepleri (claims) — API sync ile doldurulur';
