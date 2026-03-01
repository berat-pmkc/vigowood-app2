-- Multi-channel support for summary tables
-- Adds channel + master_sku columns, updates unique constraints

-- ============================================================
-- 1. daily_summary: channel kolonu ekle
-- ============================================================
ALTER TABLE daily_summary ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'ikas';

-- Mevcut unique/pk constraint'i kaldır ve yenisini ekle
DO $$
DECLARE
  _conname text;
BEGIN
  -- date üzerindeki unique veya primary key constraint'i bul
  SELECT conname INTO _conname
  FROM pg_constraint
  WHERE conrelid = 'daily_summary'::regclass
    AND contype IN ('u', 'p')
    AND array_length(conkey, 1) = 1
    AND conkey[1] = (
      SELECT attnum FROM pg_attribute
      WHERE attrelid = 'daily_summary'::regclass AND attname = 'date'
    );

  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE daily_summary DROP CONSTRAINT %I', _conname);
  END IF;
END $$;

ALTER TABLE daily_summary ADD CONSTRAINT daily_summary_date_channel_unique UNIQUE (date, channel);

-- ============================================================
-- 2. weekly_sku_summary: channel + master_sku ekle
-- ============================================================
ALTER TABLE weekly_sku_summary ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'ikas';
ALTER TABLE weekly_sku_summary ADD COLUMN IF NOT EXISTS master_sku text;

-- Mevcut unique constraint'i kaldır (week_start, sku)
DO $$
DECLARE
  _conname text;
BEGIN
  SELECT conname INTO _conname
  FROM pg_constraint
  WHERE conrelid = 'weekly_sku_summary'::regclass
    AND contype IN ('u', 'p')
    AND conkey @> ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'weekly_sku_summary'::regclass AND attname = 'week_start'),
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'weekly_sku_summary'::regclass AND attname = 'sku')
    ];

  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE weekly_sku_summary DROP CONSTRAINT %I', _conname);
  END IF;
END $$;

ALTER TABLE weekly_sku_summary ADD CONSTRAINT weekly_sku_summary_week_sku_channel_unique UNIQUE (week_start, sku, channel);

-- ============================================================
-- 3. monthly_sku_summary: channel + master_sku ekle
-- ============================================================
ALTER TABLE monthly_sku_summary ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'ikas';
ALTER TABLE monthly_sku_summary ADD COLUMN IF NOT EXISTS master_sku text;

-- Mevcut unique constraint'i kaldır (month_start, sku)
DO $$
DECLARE
  _conname text;
BEGIN
  SELECT conname INTO _conname
  FROM pg_constraint
  WHERE conrelid = 'monthly_sku_summary'::regclass
    AND contype IN ('u', 'p')
    AND conkey @> ARRAY[
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'monthly_sku_summary'::regclass AND attname = 'month_start'),
      (SELECT attnum FROM pg_attribute WHERE attrelid = 'monthly_sku_summary'::regclass AND attname = 'sku')
    ];

  IF _conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE monthly_sku_summary DROP CONSTRAINT %I', _conname);
  END IF;
END $$;

ALTER TABLE monthly_sku_summary ADD CONSTRAINT monthly_sku_summary_month_sku_channel_unique UNIQUE (month_start, sku, channel);

-- ============================================================
-- 4. Indexler
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daily_summary_channel ON daily_summary(channel);
CREATE INDEX IF NOT EXISTS idx_weekly_sku_channel ON weekly_sku_summary(channel);
CREATE INDEX IF NOT EXISTS idx_monthly_sku_channel ON monthly_sku_summary(channel);
CREATE INDEX IF NOT EXISTS idx_weekly_sku_master ON weekly_sku_summary(master_sku);
CREATE INDEX IF NOT EXISTS idx_monthly_sku_master ON monthly_sku_summary(master_sku);

-- ============================================================
-- 5. Mevcut kayıtların master_sku'sunu doldur (ikas channel)
-- ============================================================
UPDATE weekly_sku_summary w
SET master_sku = sm.master_sku
FROM sku_mappings sm
WHERE sm.channel = 'ikas' AND sm.channel_sku = w.sku AND w.master_sku IS NULL;

UPDATE monthly_sku_summary m
SET master_sku = sm.master_sku
FROM sku_mappings sm
WHERE sm.channel = 'ikas' AND sm.channel_sku = m.sku AND m.master_sku IS NULL;
