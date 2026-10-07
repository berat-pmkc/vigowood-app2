-- 151: Talep bildirimleri (zil). Yeni talep + talep değişikliği (revizyon) olaylarında
-- planlayıcılara (actor hariç) ve talep sahibine (actor değilse) satır üretir.
-- Görüldü: ekranda görünen satır okundu sayılır; goruldu_at + 30 dk sonra cron siler.

CREATE TABLE IF NOT EXISTS public.talep_bildirimleri (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talep_id       UUID NOT NULL REFERENCES public.talepler(talep_id) ON DELETE CASCADE,
  alici_user_id  TEXT NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  olay           TEXT NOT NULL CHECK (olay IN ('yeni','degisti','geri_cekildi','kapandi','yeniden_acildi')),
  ozet           TEXT,
  revizyon_id    UUID,
  olusturan      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  goruldu_at     TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_talep_bildirim_alici ON public.talep_bildirimleri (alici_user_id, goruldu_at);
CREATE INDEX IF NOT EXISTS idx_talep_bildirim_talep ON public.talep_bildirimleri (talep_id);

ALTER TABLE public.talep_bildirimleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS talep_bildirim_select ON public.talep_bildirimleri;
CREATE POLICY talep_bildirim_select ON public.talep_bildirimleri
  FOR SELECT TO authenticated
  USING (alici_user_id = public.talimat_kullanici_id());
-- INSERT/UPDATE/DELETE politikası yok: yalnız trigger / SECURITY DEFINER fonksiyonlar yazar.

REVOKE ALL ON public.talep_bildirimleri FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.talep_bildirimleri TO authenticated;

-- Bildirim üretici (dahili)
CREATE OR REPLACE FUNCTION public.talep_bildirim_uret_ic(
  p_talep UUID, p_olay TEXT, p_actor TEXT, p_rev UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t   public.talepler%ROWTYPE;
  v_ad  TEXT;
  v_ozet TEXT;
BEGIN
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep;
  IF NOT FOUND THEN RETURN; END IF;

  SELECT split_part(full_name, ' ', 1)
         || CASE WHEN position(' ' IN trim(full_name)) > 0
                 THEN ' ' || left(split_part(trim(full_name), ' ', array_length(string_to_array(trim(full_name), ' '), 1)), 1) || '.'
                 ELSE '' END
    INTO v_ad FROM public.users WHERE user_id = v_t.olusturan;

  v_ozet := v_t.sku
    || CASE WHEN v_t.istenen_miktar IS NOT NULL THEN ' · ' || trim(to_char(v_t.istenen_miktar, 'FM999999990.##')) || ' adet' ELSE '' END
    || CASE WHEN v_ad IS NOT NULL THEN ' · ' || v_ad ELSE '' END;

  INSERT INTO public.talep_bildirimleri (talep_id, alici_user_id, olay, ozet, revizyon_id, olusturan)
  SELECT p_talep, r.user_id, p_olay, v_ozet, p_rev, p_actor
  FROM (
    SELECT u.user_id FROM public.users u
    WHERE u.is_active
      AND u.role IN ('Yönetici','E-Ticaret Müdürü','Üretim ve Planlama Sorumlusu','Endüstri Mühendisi')
    UNION
    SELECT u.user_id FROM public.users u
    WHERE u.is_active AND u.user_id = v_t.olusturan
  ) r
  WHERE r.user_id IS DISTINCT FROM p_actor;
END;
$$;

CREATE OR REPLACE FUNCTION public.talep_bildirim_trg_talep()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.talep_bildirim_uret_ic(NEW.talep_id, 'yeni', NEW.olusturan, NULL);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.talep_bildirim_trg_revizyon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_olay TEXT;
BEGIN
  v_olay := CASE NEW.islem
    WHEN 'guncelle'      THEN 'degisti'
    WHEN 'geri_cek'      THEN 'geri_cekildi'
    WHEN 'kapat'         THEN 'kapandi'
    WHEN 'stokta_mevcut' THEN 'kapandi'
    WHEN 'yeniden_ac'    THEN 'yeniden_acildi'
  END;
  IF v_olay IS NOT NULL THEN
    PERFORM public.talep_bildirim_uret_ic(NEW.talep_id, v_olay, NEW.yapan, NULL);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talep_bildirim_yeni ON public.talepler;
CREATE TRIGGER trg_talep_bildirim_yeni
  AFTER INSERT ON public.talepler
  FOR EACH ROW EXECUTE FUNCTION public.talep_bildirim_trg_talep();

DROP TRIGGER IF EXISTS trg_talep_bildirim_revizyon ON public.talep_revizyonlar;
CREATE TRIGGER trg_talep_bildirim_revizyon
  AFTER INSERT ON public.talep_revizyonlar
  FOR EACH ROW EXECUTE FUNCTION public.talep_bildirim_trg_revizyon();

-- Görüldü işaretle (yalnız kendi satırları)
CREATE OR REPLACE FUNCTION public.talep_bildirim_goruldu(p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  UPDATE public.talep_bildirimleri
  SET goruldu_at = now()
  WHERE id = ANY(p_ids)
    AND goruldu_at IS NULL
    AND alici_user_id = public.talimat_kullanici_id();
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- Temizlik: görüldükten 30 dk sonra sil (dahili; cron)
CREATE OR REPLACE FUNCTION public.talep_bildirim_temizle()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE n INTEGER;
BEGIN
  DELETE FROM public.talep_bildirimleri WHERE goruldu_at < now() - interval '30 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.talep_bildirim_uret_ic(UUID, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.talep_bildirim_trg_talep() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.talep_bildirim_trg_revizyon() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.talep_bildirim_temizle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.talep_bildirim_goruldu(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talep_bildirim_goruldu(UUID[]) TO authenticated;

-- Realtime
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'talep_bildirimleri') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.talep_bildirimleri;
  END IF;
END $$;

-- Cron (5 dk'da bir temizlik)
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'talep-bildirim-temizle') THEN
    PERFORM cron.unschedule('talep-bildirim-temizle');
  END IF;
  PERFORM cron.schedule('talep-bildirim-temizle', '*/5 * * * *', 'SELECT public.talep_bildirim_temizle();');
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron zamanlaması kurulamadı: %', SQLERRM;
END $$;
