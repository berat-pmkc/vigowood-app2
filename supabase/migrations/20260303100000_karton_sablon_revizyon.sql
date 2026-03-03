-- ============================================================
-- Karton Şablon Revizyon Migration
-- - Add en/boy columns to plakalar
-- - Parse existing plaka_adi for dimensions
-- - Set tür (İç Kutu / Dış Koli) into renk column
-- - Rename PL-XXXX IDs to KRT-XXX for KARTON records
-- - Clean up tipi column for KARTON records
-- ============================================================

-- 1a. Add en/boy columns
ALTER TABLE plakalar
  ADD COLUMN IF NOT EXISTS en NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS boy NUMERIC(6,2);

-- 1b. Parse dimensions from plaka_adi: "(0.75*0.80)" pattern → en, boy
UPDATE plakalar
SET
  en = CAST(substring(plaka_adi from '\(([0-9.]+)\*') AS NUMERIC(6,2)),
  boy = CAST(substring(plaka_adi from '\*([0-9.]+)\)') AS NUMERIC(6,2))
WHERE plaka_kategori = 'KARTON'
  AND plaka_adi ~ '\([0-9.]+\*[0-9.]+\)';

-- 1c. Set tür (İç Kutu / Dış Koli) into renk column
UPDATE plakalar
SET renk = CASE
  WHEN plaka_adi ILIKE '%İÇ KUTU%' OR plaka_adi ILIKE '%IC KUTU%' OR plaka_adi ILIKE '%İÇ%KUTU%' THEN 'İç Kutu'
  ELSE 'Dış Koli'
END
WHERE plaka_kategori = 'KARTON';

-- 1d. ID migration: PL-XXXX → KRT-XXX
-- First, create a mapping temp table
DO $$
DECLARE
  rec RECORD;
  counter INT := 1;
  new_id TEXT;
BEGIN
  -- Process each KARTON record ordered by plakalar_id
  FOR rec IN
    SELECT plakalar_id, plaka_id
    FROM plakalar
    WHERE plaka_kategori = 'KARTON'
    ORDER BY plakalar_id
  LOOP
    new_id := 'KRT-' || LPAD(counter::TEXT, 3, '0');

    -- Update plaka_parts FK references (plaka_id)
    UPDATE plaka_parts SET plaka_id = new_id WHERE plaka_id = rec.plaka_id;

    -- Update kutu_uretim FK references (plaka_id)
    UPDATE kutu_uretim SET plaka_id = new_id WHERE plaka_id = rec.plaka_id;

    -- Update plakalar itself (plakalar_id PK + plaka_id)
    UPDATE plakalar
    SET plakalar_id = new_id, plaka_id = new_id
    WHERE plakalar_id = rec.plakalar_id;

    counter := counter + 1;
  END LOOP;
END $$;

-- 1e. Clean up tipi column for KARTON records (no longer used)
UPDATE plakalar SET tipi = NULL WHERE plaka_kategori = 'KARTON';

-- Done
