-- Kesim talep kuyruğu.
--
-- Kesimhane şimdiye kadar ne keseceğini sistem üzerinden görmüyordu.
-- Artık üretim personeli ihtiyacını plaka bazında girebiliyor, kesimhane
-- talep listesinden seçip başlatıyor.
--
-- Talep plaka adedi üzerinden veriliyor; çıkacak parça sayısı zaten
-- plaka_parts.default_qty ile biliniyor, arayüzde hesaplanıp gösteriliyor.

CREATE TABLE IF NOT EXISTS public.kesim_talepleri (
  talep_id      TEXT PRIMARY KEY,
  sku           TEXT NOT NULL REFERENCES public.products(sku),
  plaka_id      TEXT NOT NULL REFERENCES public.plakalar(plaka_id),
  talep_adet    INTEGER NOT NULL CHECK (talep_adet > 0),
  -- Kısmi karşılama: 10 istenip 6 kesilirse kalan 4 açık kalır
  kesilen_adet  INTEGER NOT NULL DEFAULT 0 CHECK (kesilen_adet >= 0),
  durum         TEXT NOT NULL DEFAULT 'bekliyor'
                CHECK (durum IN ('bekliyor','kesimde','tamamlandi','iptal')),
  oncelik       TEXT NOT NULL DEFAULT 'normal' CHECK (oncelik IN ('normal','acil')),
  talep_eden    TEXT NOT NULL REFERENCES public.users(user_id),
  talep_notu    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  tamamlanma_zamani TIMESTAMPTZ
);

-- Kesimhane ekranı açık talepleri önceliğe ve tarihe göre sıralı çekiyor
CREATE INDEX IF NOT EXISTS idx_kesim_talepleri_acik
  ON public.kesim_talepleri (oncelik DESC, created_at)
  WHERE durum IN ('bekliyor','kesimde');

CREATE INDEX IF NOT EXISTS idx_kesim_talepleri_plaka
  ON public.kesim_talepleri (plaka_id) WHERE durum IN ('bekliyor','kesimde');

DROP TRIGGER IF EXISTS set_kesim_talepleri_updated_at ON public.kesim_talepleri;
CREATE TRIGGER set_kesim_talepleri_updated_at
  BEFORE UPDATE ON public.kesim_talepleri
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.kesim_talepleri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read kesim_talepleri" ON public.kesim_talepleri;
CREATE POLICY "Authenticated read kesim_talepleri"
  ON public.kesim_talepleri FOR SELECT TO authenticated USING (true);

-- Üretim erişimi olan herkes talep açabilir ve güncelleyebilir
DROP POLICY IF EXISTS "Production insert kesim_talepleri" ON public.kesim_talepleri;
CREATE POLICY "Production insert kesim_talepleri"
  ON public.kesim_talepleri FOR INSERT TO authenticated
  WITH CHECK (public.has_production_access());

DROP POLICY IF EXISTS "Production update kesim_talepleri" ON public.kesim_talepleri;
CREATE POLICY "Production update kesim_talepleri"
  ON public.kesim_talepleri FOR UPDATE TO authenticated
  USING (public.has_production_access());

DROP POLICY IF EXISTS "Admin delete kesim_talepleri" ON public.kesim_talepleri;
CREATE POLICY "Admin delete kesim_talepleri"
  ON public.kesim_talepleri FOR DELETE TO authenticated
  USING (public.is_admin_or_engineer());

-- ─── Kesim kaydı ↔ talep bağlantısı ─────────────────────────
ALTER TABLE public.cut_batches
  ADD COLUMN IF NOT EXISTS talep_id TEXT REFERENCES public.kesim_talepleri(talep_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cut_batches_talep ON public.cut_batches (talep_id)
  WHERE talep_id IS NOT NULL;

-- Kesim kaydı bir talebe bağlıysa kesilen adedi talebe işle.
-- Talep karşılandıysa otomatik kapanır.
CREATE OR REPLACE FUNCTION public.kesim_talebi_guncelle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  t RECORD;
BEGIN
  IF NEW.talep_id IS NULL THEN RETURN NEW; END IF;

  SELECT * INTO t FROM kesim_talepleri WHERE talep_id = NEW.talep_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  UPDATE kesim_talepleri
  SET kesilen_adet = kesilen_adet + NEW.adet::integer,
      durum = CASE
                WHEN kesilen_adet + NEW.adet::integer >= talep_adet THEN 'tamamlandi'
                ELSE 'kesimde'
              END,
      tamamlanma_zamani = CASE
                WHEN kesilen_adet + NEW.adet::integer >= talep_adet THEN now()
                ELSE NULL
              END,
      updated_at = now()
  WHERE talep_id = NEW.talep_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kesim_talebi_guncelle ON public.cut_batches;
CREATE TRIGGER trg_kesim_talebi_guncelle
  AFTER INSERT ON public.cut_batches
  FOR EACH ROW EXECUTE FUNCTION public.kesim_talebi_guncelle();

COMMENT ON TABLE public.kesim_talepleri IS
  'Kesim talep kuyruğu — üretim personeli plaka bazında ihtiyaç girer, kesimhane listeden işler';
