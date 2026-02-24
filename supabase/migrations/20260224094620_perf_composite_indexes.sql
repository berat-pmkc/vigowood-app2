-- Performance: Composite indexes for large table chart/trend queries

-- yari_mamul_stok (234K rows): chart queries filter by tarih, aggregate by direction
CREATE INDEX IF NOT EXISTS idx_yms_tarih_direction
  ON public.yari_mamul_stok (tarih, direction);

-- stock_movements (20K rows): chart queries filter by tarih, aggregate by qty
CREATE INDEX IF NOT EXISTS idx_stock_mov_tarih_qty
  ON public.stock_movements (tarih, qty);

-- stock_movements: lastMovement lookup by sku+tarih (used in mamul stok page)
CREATE INDEX IF NOT EXISTS idx_stock_mov_sku_tarih
  ON public.stock_movements (sku, tarih DESC);

-- yari_mamul_stok: lastMovement lookup by part_id+tarih (used in yari-mamul stok page)
CREATE INDEX IF NOT EXISTS idx_yms_part_tarih
  ON public.yari_mamul_stok (part_id, tarih DESC);
