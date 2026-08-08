-- İstasyona göre otomatik mola planı.
--
-- Mola düzeni istasyona bağlı ve sabit: Paketleme ve Temizlik ekibi öğleyi
-- 12:45'te, çayı 15:40'ta yapıyor (Plan B); diğerleri 12:15 ve 15:00
-- (Plan A). Yeni personel eklendiğinde veya istasyon değiştiğinde planın
-- elle seçilmesi unutuluyordu — artık otomatik atanıyor.
--
-- Eşleme tabloda tutuluyor, kodda değil. Düzen değişirse tek satırlık
-- UPDATE yeterli, migration gerekmez.

CREATE TABLE IF NOT EXISTS public.istasyon_mola_plani (
  station        TEXT PRIMARY KEY,
  mola_plani_id  INTEGER NOT NULL REFERENCES public.mola_planlari(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS set_istasyon_mola_plani_updated_at ON public.istasyon_mola_plani;
CREATE TRIGGER set_istasyon_mola_plani_updated_at
  BEFORE UPDATE ON public.istasyon_mola_plani
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.istasyon_mola_plani ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read istasyon_mola_plani" ON public.istasyon_mola_plani;
CREATE POLICY "Authenticated read istasyon_mola_plani"
  ON public.istasyon_mola_plani FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin or engineer manage istasyon_mola_plani" ON public.istasyon_mola_plani;
CREATE POLICY "Admin or engineer manage istasyon_mola_plani"
  ON public.istasyon_mola_plani FOR ALL TO authenticated
  USING (public.is_admin_or_engineer());

-- Yalnızca Plan A'dan farklı olan istasyonlar yazılıyor.
-- Eşlemede olmayan istasyon Plan A alır.
INSERT INTO public.istasyon_mola_plani (station, mola_plani_id)
SELECT s, (SELECT id FROM public.mola_planlari WHERE ad = 'Plan B')
FROM (VALUES ('Paketleme'), ('Temizlik'), ('Paketleme Hattı'), ('Temilik Hattı')) AS v(s)
ON CONFLICT (station) DO NOTHING;

-- ─── Otomatik atama ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.users_mola_plani_ata()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  hedef_plan INTEGER;
BEGIN
  SELECT imp.mola_plani_id INTO hedef_plan
  FROM istasyon_mola_plani imp
  WHERE imp.station = NEW.station::text;

  -- Eşlemede yoksa varsayılan Plan A
  IF hedef_plan IS NULL THEN
    SELECT id INTO hedef_plan FROM mola_planlari WHERE ad = 'Plan A';
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Açıkça plan verilmişse ona dokunma
    IF NEW.mola_plani_id IS NULL THEN
      NEW.mola_plani_id := hedef_plan;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND NEW.station IS DISTINCT FROM OLD.station THEN
    -- İstasyon değiştiyse plan da o istasyonun düzenine geçer.
    -- Mola saati istasyona bağlı olduğu için elle yapılan istisna
    -- taşınmaz; gerekirse yeni istasyonda tekrar seçilir.
    NEW.mola_plani_id := hedef_plan;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_mola_plani ON public.users;
CREATE TRIGGER trg_users_mola_plani
  BEFORE INSERT OR UPDATE OF station ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.users_mola_plani_ata();

-- Mevcut kayıtları eşlemeye göre hizala
UPDATE public.users u
SET mola_plani_id = COALESCE(
      (SELECT imp.mola_plani_id FROM istasyon_mola_plani imp WHERE imp.station = u.station::text),
      (SELECT id FROM mola_planlari WHERE ad = 'Plan A')
    ),
    updated_at = now();

COMMENT ON TABLE public.istasyon_mola_plani IS
  'İstasyon → mola planı eşlemesi. users tablosundaki trigger buradan okur; eşlemede olmayan istasyon Plan A alır.';
