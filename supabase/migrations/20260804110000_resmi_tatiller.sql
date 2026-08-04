-- Resmî tatil takvimi.
--
-- Devamsızlık raporundaki hedef iş günü sayısı ayın pazarları düşülerek
-- hesaplanıyordu; resmî tatiller hesaba katılmıyordu. Bu tablo tatilleri
-- bir kez tanımlayıp herkes için geçerli kılar — personel başına kayıt
-- girmeye gerek kalmaz.
--
-- hedeften_dus: arife gibi yarım günleri listede tutup hedeften düşmemek
-- için. Varsayılan olarak her tatil düşülür.

CREATE TABLE IF NOT EXISTS public.resmi_tatiller (
  tarih         DATE PRIMARY KEY,
  ad            TEXT NOT NULL,
  hedeften_dus  BOOLEAN NOT NULL DEFAULT true,
  aktif         BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_resmi_tatiller_updated_at ON public.resmi_tatiller;
CREATE TRIGGER set_resmi_tatiller_updated_at
  BEFORE UPDATE ON public.resmi_tatiller
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.resmi_tatiller ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read resmi_tatiller" ON public.resmi_tatiller;
CREATE POLICY "Authenticated read resmi_tatiller"
  ON public.resmi_tatiller FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Personel access manage resmi_tatiller" ON public.resmi_tatiller;
CREATE POLICY "Personel access manage resmi_tatiller"
  ON public.resmi_tatiller FOR ALL TO authenticated
  USING (public.has_personel_access());

-- Sabit tarihli millî bayramlar. Dini bayramlar her yıl kaydığı için
-- buraya yazılmadı — arayüzden eklenir.
INSERT INTO public.resmi_tatiller (tarih, ad) VALUES
  ('2026-01-01','Yılbaşı'),
  ('2026-04-23','Ulusal Egemenlik ve Çocuk Bayramı'),
  ('2026-05-01','Emek ve Dayanışma Günü'),
  ('2026-05-19','Atatürk''ü Anma, Gençlik ve Spor Bayramı'),
  ('2026-07-15','Demokrasi ve Millî Birlik Günü'),
  ('2026-08-30','Zafer Bayramı'),
  ('2026-10-29','Cumhuriyet Bayramı'),
  ('2027-01-01','Yılbaşı'),
  ('2027-04-23','Ulusal Egemenlik ve Çocuk Bayramı'),
  ('2027-05-01','Emek ve Dayanışma Günü'),
  ('2027-05-19','Atatürk''ü Anma, Gençlik ve Spor Bayramı'),
  ('2027-07-15','Demokrasi ve Millî Birlik Günü'),
  ('2027-08-30','Zafer Bayramı'),
  ('2027-10-29','Cumhuriyet Bayramı')
ON CONFLICT (tarih) DO NOTHING;

COMMENT ON TABLE public.resmi_tatiller IS
  'Resmî tatil takvimi — devamsızlık raporunda hedef iş gününden düşülür';
