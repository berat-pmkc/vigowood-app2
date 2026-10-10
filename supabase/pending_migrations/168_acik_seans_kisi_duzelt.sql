-- 168: "Bu personelin bu ürün/aşamada açık seansı var" yanlış alarmı.
-- 1) Uygulama workers'ı JSON.stringify ile yazıyordu -> jsonb 'string' oluyor, kişi listesi okunmuyordu.
-- 2) operator_id istasyon hesabı (ör. VW014 Montaj Hattı) olabiliyor; her seansta aynı olduğu için
--    aynı ürün/aşamadaki tüm seanslar "aynı kişi" sayılıyordu.
-- Çözüm: workers dizi veya metin-içi dizi olarak okunur; isimli çalışan varsa kişi kümesi = çalışanlar,
-- yoksa operatör. Paketlemede çalışanlar + personel CSV; ikisi de boşsa operatör.

CREATE OR REPLACE FUNCTION public.talimat_seans_isciler(p_workers JSONB)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::text[])
  FROM (
    SELECT w ->> 'id' AS x
    FROM jsonb_array_elements(
      CASE
        WHEN p_workers IS NULL THEN '[]'::jsonb
        WHEN jsonb_typeof(p_workers) = 'array' THEN p_workers
        WHEN jsonb_typeof(p_workers) = 'string' AND ltrim(p_workers #>> '{}') LIKE '[%'
          THEN (p_workers #>> '{}')::jsonb
        ELSE '[]'::jsonb
      END) AS w
    WHERE jsonb_typeof(w) = 'object'
  ) q
  WHERE x IS NOT NULL AND x <> '';
$$;

CREATE OR REPLACE FUNCTION public.talimat_seans_kisileri(p_operator TEXT, p_workers JSONB)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN cardinality(public.talimat_seans_isciler(p_workers)) > 0 THEN public.talimat_seans_isciler(p_workers)
    WHEN COALESCE(p_operator, '') <> '' THEN ARRAY[p_operator]
    ELSE '{}'::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_pack_kisileri(p_operator TEXT, p_personel TEXT, p_workers JSONB)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  WITH k AS (
    SELECT COALESCE(array_agg(DISTINCT x), '{}'::text[]) AS a
    FROM (
      SELECT unnest(public.talimat_seans_isciler(p_workers)) AS x
      UNION ALL
      SELECT unnest(string_to_array(replace(COALESCE(p_personel, ''), ' ', ''), ','))
    ) q
    WHERE x IS NOT NULL AND x <> ''
  )
  SELECT CASE
    WHEN cardinality(k.a) > 0 THEN k.a
    WHEN COALESCE(p_operator, '') <> '' THEN ARRAY[p_operator]
    ELSE '{}'::text[]
  END
  FROM k;
$$;

GRANT EXECUTE ON FUNCTION public.talimat_seans_isciler(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.talimat_seans_kisileri(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.talimat_pack_kisileri(TEXT, TEXT, JSONB) TO authenticated;

-- Metin olarak yazılmış workers kayıtlarını diziye çevir (yalnızca geçerli dizi metinleri)
UPDATE public.montaj_sessions
SET workers = (workers #>> '{}')::jsonb
WHERE jsonb_typeof(workers) = 'string' AND ltrim(workers #>> '{}') LIKE '[%';

UPDATE public.pack_events
SET workers = (workers #>> '{}')::jsonb
WHERE jsonb_typeof(workers) = 'string' AND ltrim(workers #>> '{}') LIKE '[%';
