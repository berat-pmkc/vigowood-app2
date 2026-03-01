-- SKU Eşleştirme Tablosu
-- Farklı satış kanallarındaki (Trendyol, İkas vb.) ürün kodlarını master SKU ile eşleştirir

CREATE TABLE sku_mappings (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    master_sku text NOT NULL,
    channel text NOT NULL,
    channel_sku text,
    channel_barcode text,
    channel_product_code text,
    channel_product_name text,
    channel_product_id text,
    match_method text,
    match_status text DEFAULT 'matched',
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Aynı kanalda aynı barkod tekrarlanamaz (NULL barkodlar hariç)
CREATE UNIQUE INDEX sku_mappings_channel_barcode_unique
ON sku_mappings(channel, channel_barcode)
WHERE channel_barcode IS NOT NULL;

CREATE INDEX idx_sku_mappings_master ON sku_mappings(master_sku);
CREATE INDEX idx_sku_mappings_channel ON sku_mappings(channel);
CREATE INDEX idx_sku_mappings_status ON sku_mappings(match_status);

-- updated_at trigger
CREATE TRIGGER set_sku_mappings_updated_at
    BEFORE UPDATE ON sku_mappings
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE sku_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sku_mappings_select" ON sku_mappings
    FOR SELECT USING (true);

CREATE POLICY "sku_mappings_admin_insert" ON sku_mappings
    FOR INSERT WITH CHECK (is_admin_or_engineer());

CREATE POLICY "sku_mappings_admin_update" ON sku_mappings
    FOR UPDATE USING (is_admin_or_engineer());

CREATE POLICY "sku_mappings_admin_delete" ON sku_mappings
    FOR DELETE USING (is_admin_or_engineer());
