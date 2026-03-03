-- Make plaka_adi nullable (KARTON records no longer use it)
ALTER TABLE plakalar ALTER COLUMN plaka_adi DROP NOT NULL;

-- Set existing KARTON plaka_adi to NULL (no longer relevant)
UPDATE plakalar SET plaka_adi = NULL WHERE plaka_kategori = 'KARTON';
