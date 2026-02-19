-- VigoWood Platform — Katman 3: Temel Tablolar
-- products (101), all_parts (379), kesim_makinesi (3)

---------------------------------------------------
-- 1. KESIM_MAKINESI (Cutting Machines)
---------------------------------------------------
CREATE TABLE public.kesim_makinesi (
  makine_id   TEXT PRIMARY KEY,         -- 'BÜYÜK', 'KÜÇÜK', 'KUTU'
  tipi        TEXT NOT NULL,            -- '600W Lazer', '300W Lazer', 'BALA'
  aciklama    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kesim_makinesi ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read machines"
  ON public.kesim_makinesi FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage machines"
  ON public.kesim_makinesi FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

-- Seed data
INSERT INTO public.kesim_makinesi (makine_id, tipi, aciklama) VALUES
  ('BÜYÜK', '600W Lazer', 'Büyük Makine'),
  ('KÜÇÜK', '300W Lazer', 'Küçük Makine'),
  ('KUTU', 'BALA', 'Kutu Makinesi');

---------------------------------------------------
-- 2. PRODUCTS (Ürünler — 101 aktif SKU)
---------------------------------------------------

-- Product category enum
CREATE TYPE public.product_category AS ENUM (
  'AT EVİ',
  'TELEFON STANDI',
  'KİTAP OKUMA STANDI',
  'BASAMAK',
  'LAPTOP SEHPASI',
  'KABAK LİFİ',
  'KİTAPLIK',
  'MİNDER',
  'ORGANİZER',
  'TABLO'
);

CREATE TABLE public.products (
  sku                 TEXT PRIMARY KEY,           -- 'AE-1', 'ATS01C', etc.
  kategori            public.product_category,    -- nullable: 2 products have no category
  urun_adi            TEXT,                       -- product name
  aktif_mi            BOOLEAN NOT NULL DEFAULT true,
  stok_aktif          INTEGER NOT NULL DEFAULT 0, -- current active stock (can be negative)
  toplam_satis        INTEGER NOT NULL DEFAULT 0,
  ilk_satis_tarihi    DATE,                       -- first sale date
  satilan_gun_sayisi  INTEGER NOT NULL DEFAULT 0,
  gunluk_satis        INTEGER NOT NULL DEFAULT 0,
  gecen_ay_uretim     INTEGER NOT NULL DEFAULT 0,
  aylik_uretim        INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_products_kategori ON public.products(kategori);
CREATE INDEX idx_products_aktif ON public.products(aktif_mi) WHERE aktif_mi = true;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read products"
  ON public.products FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage products"
  ON public.products FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 3. ALL_PARTS (Tüm Parçalar — 379 satır)
---------------------------------------------------

-- Part type enum
CREATE TYPE public.part_type AS ENUM (
  'HAZIR',       -- Hazır eleman (menteşe, vida vb.) — 68 adet
  'KUTU',        -- Kutu ambalaj — 30 adet
  'KARTON',      -- Karton ambalaj — 12 adet
  'YARIMAMUL'    -- Yarı mamül (kesim çıktısı) — 269 adet
);

CREATE TABLE public.all_parts (
  part_id               TEXT PRIMARY KEY,         -- 'HP0001', 'LS011-P01', etc.
  part_adi              TEXT NOT NULL,
  part_type             public.part_type NOT NULL,
  hazir_eleman_aktif_stok   INTEGER NOT NULL DEFAULT 0,
  hazir_eleman_kritik_stok  INTEGER NOT NULL DEFAULT 0,
  yari_mamul_stok           INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_all_parts_type ON public.all_parts(part_type);

CREATE TRIGGER all_parts_updated_at
  BEFORE UPDATE ON public.all_parts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.all_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read parts"
  ON public.all_parts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage parts"
  ON public.all_parts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));
