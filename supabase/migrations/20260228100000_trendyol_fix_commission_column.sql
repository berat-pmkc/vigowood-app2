-- ================================================================
-- Trendyol: commission kolonu düzeltmesi
-- NUMERIC(5,2) → NUMERIC(10,2)
-- Trendyol, yüksek tutarlı siparişlerde komisyon değerini tutar
-- olarak gönderiyor (ör. ₺1.200 komisyon). NUMERIC(5,2) max 999.99
-- olduğundan overflow oluyor. NUMERIC(10,2) ile 99,999,999.99'a
-- kadar güvenli şekilde saklanabilir.
-- ================================================================

ALTER TABLE trendyol_order_lines
  ALTER COLUMN commission TYPE NUMERIC(10,2);

-- commission_amount: Trendyol'un hesapladığı gerçek komisyon tutarı
-- (commission rate'den ayrı olarak API'den gelebilir)
ALTER TABLE trendyol_order_lines
  ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2);
