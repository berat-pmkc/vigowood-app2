-- Migration: Convert plakalar.sku from TEXT to TEXT[] for multi-SKU support
-- Allows a plaka/karton template to be shared across multiple products

-- 1. Drop the foreign key constraint (can't have FK on array columns)
ALTER TABLE plakalar DROP CONSTRAINT IF EXISTS plakalar_sku_fkey;

-- 2. Convert sku column from TEXT to TEXT[]
ALTER TABLE plakalar
  ALTER COLUMN sku TYPE TEXT[]
  USING CASE WHEN sku IS NULL THEN NULL ELSE ARRAY[sku] END;

-- 3. Create GIN index for efficient array queries (contains, overlap)
CREATE INDEX IF NOT EXISTS idx_plakalar_sku_gin ON plakalar USING GIN (sku);

-- 4. Helper function: get distinct SKU values across all plakalar for a given category
CREATE OR REPLACE FUNCTION get_distinct_plaka_skus(p_kategori TEXT)
RETURNS TABLE(sku TEXT) AS $$
  SELECT DISTINCT unnest(p.sku) AS sku
  FROM plakalar p
  WHERE p.plaka_kategori = p_kategori
    AND p.sku IS NOT NULL
  ORDER BY sku;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
