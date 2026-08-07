-- Montaj seanslarında net çalışma süresi.
--
-- birim_montaj_dk şimdiye kadar brüt süreden hesaplanıyordu:
--   birim = (bitiş - başlangıç) / (adet × kişi)
-- Seans bir çay veya öğle molasını kapsıyorsa o dakikalar da işçilik
-- sayılıyordu. Standart süre analizinde bu hata birikiyor.
--
-- Artık molalar düşülüyor. Yoklama tarafındaki mesai brüt kalıyor —
-- orası bordro, burası verimlilik.

ALTER TABLE public.montaj_sessions
  ADD COLUMN IF NOT EXISTS brut_sure_dk NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS mola_dk      NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS net_sure_dk  NUMERIC(10,2);

COMMENT ON COLUMN public.montaj_sessions.net_sure_dk IS
  'Molalar düşülmüş çalışma süresi — birim_montaj_dk bundan hesaplanır';

-- ─── Mola kesişimi ──────────────────────────────────────────
-- Verilen zaman aralığının, plandaki mola aralıklarıyla çakışan
-- dakika sayısını döndürür. Seans birden çok güne yayılırsa her gün
-- için ayrı hesaplanır.
CREATE OR REPLACE FUNCTION public.mola_kesisim_dk(
  p_bas TIMESTAMPTZ,
  p_bit TIMESTAMPTZ,
  p_plan_id INTEGER
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  araliklar JSONB;
  a         JSONB;
  gun       DATE;
  son_gun   DATE;
  m_bas     TIMESTAMPTZ;
  m_bit     TIMESTAMPTZ;
  kesisim   NUMERIC := 0;
BEGIN
  IF p_bas IS NULL OR p_bit IS NULL OR p_bit <= p_bas THEN
    RETURN 0;
  END IF;

  SELECT mp.araliklar INTO araliklar
  FROM mola_planlari mp
  WHERE mp.id = p_plan_id AND mp.aktif;

  IF araliklar IS NULL THEN RETURN 0; END IF;

  gun     := (p_bas AT TIME ZONE 'Europe/Istanbul')::date;
  son_gun := (p_bit AT TIME ZONE 'Europe/Istanbul')::date;

  WHILE gun <= son_gun LOOP
    FOR a IN SELECT * FROM jsonb_array_elements(araliklar) LOOP
      m_bas := (gun + (a->>'bas')::time) AT TIME ZONE 'Europe/Istanbul';
      m_bit := (gun + (a->>'bit')::time) AT TIME ZONE 'Europe/Istanbul';

      -- Çakışan bölüm: [max(başlangıçlar), min(bitişler)]
      IF LEAST(p_bit, m_bit) > GREATEST(p_bas, m_bas) THEN
        kesisim := kesisim +
          EXTRACT(EPOCH FROM (LEAST(p_bit, m_bit) - GREATEST(p_bas, m_bas))) / 60.0;
      END IF;
    END LOOP;
    gun := gun + 1;
  END LOOP;

  RETURN ROUND(kesisim, 2);
END;
$$;

-- ─── Seans süre hesabı ──────────────────────────────────────
-- Operatörün mola planına göre brüt / mola / net dakikayı döndürür.
-- Ekipte farklı plandan kişiler varsa operatörün planı esas alınır;
-- montaj hatları tek plan altında çalıştığı için pratikte fark etmiyor.
CREATE OR REPLACE FUNCTION public.montaj_sure_hesapla(
  p_bas TIMESTAMPTZ,
  p_bit TIMESTAMPTZ,
  p_operator_id TEXT
)
RETURNS TABLE (brut NUMERIC, mola NUMERIC, net NUMERIC)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  plan_id INTEGER;
  b NUMERIC;
  m NUMERIC;
BEGIN
  IF p_bas IS NULL OR p_bit IS NULL OR p_bit <= p_bas THEN
    RETURN QUERY SELECT 0::numeric, 0::numeric, 0::numeric;
    RETURN;
  END IF;

  SELECT u.mola_plani_id INTO plan_id FROM users u WHERE u.user_id = p_operator_id;

  b := ROUND(EXTRACT(EPOCH FROM (p_bit - p_bas)) / 60.0, 2);
  m := COALESCE(public.mola_kesisim_dk(p_bas, p_bit, plan_id), 0);

  RETURN QUERY SELECT b, m, GREATEST(b - m, 0);
END;
$$;

COMMENT ON FUNCTION public.montaj_sure_hesapla IS
  'Montaj seansının brüt / mola / net dakikasını operatörün mola planına göre hesaplar';
