-- =============================================================
-- Tamamlanan montaj seanslarında arama
--
-- Personel ve işlem adına göre arama gerekiyor. Personel adı `workers`
-- JSONB dizisinin içinde; PostgREST üzerinden dizi içi metin araması
-- yapılamıyor, ILIKE yalnızca düz metin kolonlarda çalışıyor.
--
-- Çözüm: aranabilir alanları tek düz metin kolonunda toplayan trigger.
-- Sorgu tarafı basit bir ILIKE'a iniyor; filtreleme, sayfalama ve sayım
-- sunucuda kalıyor. (İstemcide filtrelemek sayfalamayı bozardı: 25'lik
-- sayfada arama yapıp "sonuç yok" demek yanlış olurdu.)
-- =============================================================

ALTER TABLE public.montaj_sessions
  ADD COLUMN IF NOT EXISTS arama_metni TEXT;

COMMENT ON COLUMN public.montaj_sessions.arama_metni IS
  'SKU + adım + operatör + ekip üyelerinin adları, küçük harfe indirgenmiş. Trigger doldurur, elle yazılmaz.';

CREATE OR REPLACE FUNCTION public.montaj_arama_metni_guncelle()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_ekip TEXT := '';
  v_json JSONB;
BEGIN
  -- workers hem JSONB hem (eski kayıtlarda) JSON metni olabiliyor
  BEGIN
    v_json := NEW.workers::jsonb;
    IF jsonb_typeof(v_json) = 'string' THEN
      v_json := (v_json #>> '{}')::jsonb;
    END IF;
    IF jsonb_typeof(v_json) = 'array' THEN
      SELECT string_agg(w->>'name', ' ') INTO v_ekip
      FROM jsonb_array_elements(v_json) w;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_ekip := '';
  END;

  -- Türkçe karakterler ASCII'ye katlanıyor. Sebep: Postgres lower('İ')
  -- birleşik noktalı 'i̇' (2 kod noktası) üretirken JS'in Türkçe küçültmesi
  -- düz 'i' veriyor. Katlamadan, "BKOSCEVİZ" araması hiçbir zaman
  -- eşleşmezdi. İstemci tarafı da aynı katlamayı yapıyor.
  NEW.arama_metni := lower(translate(concat_ws(' ',
    NEW.sku, NEW.step_name, NEW.step_id, NEW.operator_name, coalesce(v_ekip, '')),
    'İIıŞşĞğÜüÖöÇç', 'IIiSsGgUuOoCc'));

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS montaj_arama_metni ON public.montaj_sessions;
CREATE TRIGGER montaj_arama_metni
  BEFORE INSERT OR UPDATE OF sku, step_name, step_id, operator_name, workers
  ON public.montaj_sessions
  FOR EACH ROW EXECUTE FUNCTION public.montaj_arama_metni_guncelle();

-- Mevcut kayıtları doldur (trigger UPDATE OF ile sınırlı olduğundan
-- kolonlardan birine dokunmak gerekiyor)
UPDATE public.montaj_sessions SET sku = sku;

-- ILIKE '%...%' baştan eşleşme şartı olmadan çalışsın diye trigram indeksi
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_montaj_arama_metni
  ON public.montaj_sessions USING gin (arama_metni gin_trgm_ops);
