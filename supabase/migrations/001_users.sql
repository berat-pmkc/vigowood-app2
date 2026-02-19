-- VigoWood Platform — Katman 1: Users Table
-- 56 kullanıcı, 10 rol, shared station hesap desteği

-- Enum: user roles
CREATE TYPE public.user_role AS ENUM (
  'Yönetici',
  'Endüstri Mühendisi',
  'E-Ticaret Müdürü',
  'Dış Ticaret Müdürü',
  'Üretim',
  'Hat',
  'Muhasebe',
  'Sevkiyat Sorumlusu',
  'Pazaryeri Sorumlusu',
  'Mimar'
);

-- Enum: stations
CREATE TYPE public.station AS ENUM (
  'Yönetim',
  'Ofis',
  'Kesim',
  'Temizlik',
  'Montaj',
  'Paketleme',
  'Kutu',
  'Kesim Hattı',
  'Temilik Hattı',
  'Montaj Hattı',
  'Paketleme Hattı',
  'Kutu Hattı'
);

-- Users table
CREATE TABLE public.users (
  user_id     TEXT PRIMARY KEY,           -- VW001, VW002, ...
  auth_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT UNIQUE,
  full_name   TEXT NOT NULL,
  role        public.user_role NOT NULL,
  station     public.station NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for common queries
CREATE INDEX idx_users_auth_id ON public.users(auth_id);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_station ON public.users(station);
CREATE INDEX idx_users_active ON public.users(is_active) WHERE is_active = true;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read all active users (needed for operator selection)
CREATE POLICY "Authenticated users can read active users"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Users can read their own profile (even if inactive)
CREATE POLICY "Users can read own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth_id = auth.uid());

-- Only Yönetici can insert/update/delete users
CREATE POLICY "Yönetici can manage users"
  ON public.users
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.role = 'Yönetici'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
      AND u.role = 'Yönetici'
    )
  );

-- Insert all 56 users (auth_id will be linked by seed script)
INSERT INTO public.users (user_id, email, full_name, role, station, is_active) VALUES
  ('VW001', 'hasan@hasmob.com.tr', 'Hasan Çolakoğlu', 'Yönetici', 'Yönetim', true),
  ('VW002', 'mustafa@hasmob.com.tr', 'Mustafa Çolakoğlu', 'Yönetici', 'Yönetim', true),
  ('VW003', 'ahmet@hasmob.com.tr', 'Ahmet Çolakoğlu', 'Yönetici', 'Yönetim', true),
  ('VW004', 'turgay@vigowood.com', 'Turgay Çolakoğlu', 'Yönetici', 'Yönetim', true),
  ('VW005', 'c.sedat@vigowood.com', 'Sedat Karaduman', 'Dış Ticaret Müdürü', 'Yönetim', true),
  ('VW006', 'sinan@vigowood.com', 'Sinan Çolakoğlu', 'E-Ticaret Müdürü', 'Yönetim', true),
  ('VW007', 'yunus@hasmob.com.tr', 'Yunus Emre Ocakdan', 'Muhasebe', 'Ofis', true),
  ('VW008', 'emrah@hasmob.com.tr', 'Emrah Taşcı', 'Mimar', 'Ofis', true),
  ('VW009', 'berat@vigowood.com', 'Berat Pamukcuoğlu', 'Endüstri Mühendisi', 'Ofis', true),
  ('VW010', 'zehra@vigowood.com', 'Zehra Alataş', 'Pazaryeri Sorumlusu', 'Ofis', true),
  ('VW011', 'asli@vigowood.com', 'Aslıhan Er', 'Sevkiyat Sorumlusu', 'Ofis', true),
  ('VW012', 'kesim@vigowood.com', 'Kesim Hattı', 'Hat', 'Kesim Hattı', true),
  ('VW013', 'temizlik@vigowood.com', 'Temilik Hattı', 'Hat', 'Temilik Hattı', true),
  ('VW014', 'montaj@vigowood.com', 'Montaj Hattı', 'Hat', 'Montaj Hattı', true),
  ('VW015', 'paketleme@vigowood.com', 'Paketleme Hattı', 'Hat', 'Paketleme Hattı', true),
  ('VW016', NULL, 'Selim Hasten', 'Üretim', 'Montaj', true),
  ('VW017', NULL, 'Abdulkadir Hasten', 'Üretim', 'Montaj', true),
  ('VW018', NULL, 'Bahtiyar Ovalı', 'Üretim', 'Montaj', true),
  ('VW019', NULL, 'Beyza Yılmaz', 'Üretim', 'Temizlik', true),
  ('VW020', NULL, 'Birol Şimşek', 'Üretim', 'Montaj', true),
  ('VW021', NULL, 'Emirhan Kayahan Akçay', 'Üretim', 'Montaj', true),
  ('VW022', NULL, 'Ferhat Aydoğdu', 'Üretim', 'Kesim', true),
  ('VW023', NULL, 'Gökçe Türkoğlu', 'Üretim', 'Paketleme', true),
  ('VW024', NULL, 'Huriye Yıldıran', 'Üretim', 'Temizlik', true),
  ('VW025', NULL, 'Kadircan Kocahüseyinoğlu', 'Üretim', 'Montaj', true),
  ('VW026', NULL, 'Nermin Ustaoğlu', 'Üretim', 'Temizlik', true),
  ('VW027', NULL, 'Oğuz Can', 'Üretim', 'Montaj', true),
  ('VW028', NULL, 'Rabia Altun', 'Üretim', 'Temizlik', true),
  ('VW029', NULL, 'Selin Çolakoğlu', 'Üretim', 'Paketleme', true),
  ('VW030', NULL, 'Şaban Kuyumcu', 'Üretim', 'Montaj', true),
  ('VW031', NULL, 'Taner Sezer', 'Üretim', 'Montaj', true),
  ('VW032', NULL, 'Vildan Bakırcı', 'Üretim', 'Paketleme', true),
  ('VW033', NULL, 'Zahiye Çolakoğlu', 'Üretim', 'Paketleme', true),
  ('VW034', NULL, 'Zeynep Çolakoğlu', 'Üretim', 'Paketleme', true),
  ('VW035', NULL, 'Bedirhan Niyazi Sül', 'Üretim', 'Montaj', true),
  ('VW036', NULL, 'Efe Yalman', 'Üretim', 'Montaj', true),
  ('VW038', NULL, 'Oğuzhan Acar Atacık', 'Üretim', 'Montaj', true),
  ('VW039', NULL, 'Acun Çenge', 'Üretim', 'Temizlik', true),
  ('VW040', NULL, 'Umutcan Şenel', 'Üretim', 'Montaj', true),
  ('VW041', NULL, 'Furkan Tarık Çağlayan', 'Üretim', 'Montaj', true),
  ('VW042', NULL, 'Efekan Aksoylu', 'Üretim', 'Montaj', false),
  ('VW043', NULL, 'Ozan Aydoğdu', 'Üretim', 'Montaj', false),
  ('VW044', NULL, 'Mustafa Can Cindioğlu', 'Üretim', 'Montaj', true),
  ('VW045', NULL, 'Selçuk Demir', 'Üretim', 'Temizlik', true),
  ('VW047', NULL, 'Bekçi', 'Üretim', 'Kesim', true),
  ('VW048', 'montaj2@vigowood.com', 'Montaj Hattı 2', 'Hat', 'Montaj Hattı', true),
  ('VW049', 'montaj3@vigowood.com', 'Montaj Hattı 3', 'Hat', 'Montaj Hattı', true),
  ('VW050', 'kutu@vigowood.com', 'Kutu Hattı', 'Hat', 'Kutu Hattı', true),
  ('VW051', NULL, 'İrem Bide', 'Üretim', 'Paketleme', true),
  ('VW052', NULL, 'Ufuk Alparslan', 'Üretim', 'Montaj', true),
  ('VW053', NULL, 'Ebrar Külünk', 'Üretim', 'Paketleme', true),
  ('VW054', NULL, 'Ertuğrul Güney', 'Üretim', 'Montaj', false),
  ('VW055', NULL, 'Serhat Aydoğdu', 'Üretim', 'Montaj', true),
  ('VW056', NULL, 'Meryem Yılmaz', 'Üretim', 'Paketleme', true),
  ('VW057', NULL, 'Arda Bedük', 'Üretim', 'Montaj', true),
  ('VW058', NULL, 'Bahadır Efe Salgın', 'Üretim', 'Montaj', true);
