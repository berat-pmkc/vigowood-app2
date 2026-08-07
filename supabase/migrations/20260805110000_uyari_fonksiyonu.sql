-- Üretim uyarılarını üreten fonksiyon + zamanlayıcı
--
-- Vercel Hobby planında günde 2 cron sınırı var; kontrolleri veritabanı
-- içinden çalıştırıyoruz. Böylece sınıra takılmıyoruz ve uygulama kimse
-- tarafından açılmasa bile çalışıyor.
--
-- Fonksiyon 15 dakikada bir çağrılıyor ama içeride Türkiye saatine bakıp
-- hangi kontrolün sırası geldiğine kendisi karar veriyor. pg_cron UTC
-- çalıştığı için saat mantığını fonksiyona koymak yaz/kış saati
-- değişimlerinde de doğru kalmasını sağlıyor.

CREATE OR REPLACE FUNCTION public.uretim_uyarilari_uret()
RETURNS TABLE (uretilen_uyari INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  simdi     TIMESTAMPTZ := now() AT TIME ZONE 'Europe/Istanbul';
  bugun     DATE := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  saat      TIME := (now() AT TIME ZONE 'Europe/Istanbul')::time;
  hedef     TEXT;
  sayac     INTEGER := 0;
  kayitlar  JSONB;
  adet      INTEGER;
BEGIN
  -- Uyarılar Endüstri Mühendisi'ne gider. Birden fazla varsa ilki alınır.
  SELECT user_id INTO hedef
  FROM users
  WHERE role::text = 'Endüstri Mühendisi' AND is_active
  ORDER BY user_id
  LIMIT 1;

  IF hedef IS NULL THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  -- Hafta sonu pazar ise kontrol yapma
  IF EXTRACT(DOW FROM bugun) = 0 THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  -- Resmî tatilse kontrol yapma
  IF EXISTS (SELECT 1 FROM resmi_tatiller WHERE tarih = bugun AND aktif AND hedeften_dus) THEN
    RETURN QUERY SELECT 0;
    RETURN;
  END IF;

  -- ─── A. 09:00 — üretim seansı açmamış personel ────────────
  IF saat >= TIME '09:00' AND saat < TIME '09:20' THEN
    SELECT jsonb_agg(jsonb_build_object(
             'user_id', u.user_id,
             'ad', u.full_name,
             'istasyon', u.station::text
           ) ORDER BY u.station::text, u.full_name),
           count(*)
      INTO kayitlar, adet
    FROM users u
    WHERE u.is_active
      AND u.uretim_seansi_beklenir
      -- İzinli / raporlu işaretlenenler uyarıya girmez
      AND NOT EXISTS (
        SELECT 1 FROM attendance a
        WHERE a.employee = u.user_id AND a.tarih = bugun
          AND a.durum IN ('izinli','raporlu')
      )
      -- Bugün hiçbir üretim kaydı yoksa
      AND NOT EXISTS (SELECT 1 FROM montaj_sessions m WHERE m.operator_id = u.user_id AND m.start_time::date = bugun)
      AND NOT EXISTS (SELECT 1 FROM cut_batches c WHERE c.operator = u.user_id AND c.tarih = bugun)
      AND NOT EXISTS (SELECT 1 FROM pack_events p WHERE p.operator = u.user_id AND p.tarih = bugun)
      AND NOT EXISTS (SELECT 1 FROM kutu_uretim k WHERE k.operator = u.user_id AND k.tarih = bugun);

    IF adet > 0 THEN
      INSERT INTO uretim_uyarilari (tur, tarih, hedef_user, baslik, detay, adet, dedup_key)
      VALUES ('seans_acilmadi', bugun, hedef,
              adet || ' personel henüz üretim seansı açmadı',
              kayitlar, adet, 'seans_acilmadi|' || bugun)
      ON CONFLICT (dedup_key) DO NOTHING;
      GET DIAGNOSTICS sayac = ROW_COUNT;
    END IF;
  END IF;

  -- ─── B. Gün içi — 4 saattir açık kalan seanslar ───────────
  IF saat >= TIME '11:00' AND saat < TIME '18:00' THEN
    SELECT jsonb_agg(jsonb_build_object(
             'session_id', m.session_id,
             'ad', COALESCE(m.operator_name, m.operator_id),
             'sku', m.sku,
             'adim', m.step_name,
             'baslangic', to_char(m.start_time AT TIME ZONE 'Europe/Istanbul', 'HH24:MI'),
             'sure_saat', round(EXTRACT(EPOCH FROM (now() - m.start_time)) / 3600.0, 1)
           ) ORDER BY m.start_time),
           count(*)
      INTO kayitlar, adet
    FROM montaj_sessions m
    WHERE m.durum = 'montajda'
      AND m.start_time >= (bugun::timestamptz - INTERVAL '1 day')
      AND now() - m.start_time > INTERVAL '4 hours';

    IF adet > 0 THEN
      INSERT INTO uretim_uyarilari (tur, tarih, hedef_user, baslik, detay, adet, dedup_key)
      VALUES ('seans_uzun_acik', bugun, hedef,
              adet || ' seans 4 saatten uzun süredir açık',
              kayitlar, adet, 'seans_uzun_acik|' || bugun)
      ON CONFLICT (dedup_key) DO UPDATE
        SET detay = EXCLUDED.detay, adet = EXCLUDED.adet, baslik = EXCLUDED.baslik,
            updated_at = now();
      sayac := sayac + 1;
    END IF;
  END IF;

  -- ─── C. 18:15 — vardiya bitti, hâlâ açık seanslar ─────────
  IF saat >= TIME '18:15' AND saat < TIME '18:35' THEN
    SELECT jsonb_agg(jsonb_build_object(
             'session_id', m.session_id,
             'ad', COALESCE(m.operator_name, m.operator_id),
             'sku', m.sku,
             'adim', m.step_name,
             'baslangic', to_char(m.start_time AT TIME ZONE 'Europe/Istanbul', 'HH24:MI')
           ) ORDER BY m.start_time),
           count(*)
      INTO kayitlar, adet
    FROM montaj_sessions m
    WHERE m.durum = 'montajda'
      AND (m.start_time AT TIME ZONE 'Europe/Istanbul')::date <= bugun;

    IF adet > 0 THEN
      INSERT INTO uretim_uyarilari (tur, tarih, hedef_user, baslik, detay, adet, dedup_key)
      VALUES ('seans_kapanmadi', bugun, hedef,
              'Vardiya bitti, ' || adet || ' seans kapatılmamış',
              kayitlar, adet, 'seans_kapanmadi|' || bugun)
      ON CONFLICT (dedup_key) DO UPDATE
        SET detay = EXCLUDED.detay, adet = EXCLUDED.adet, baslik = EXCLUDED.baslik,
            updated_at = now();
      sayac := sayac + 1;
    END IF;
  END IF;

  RETURN QUERY SELECT sayac;
END;
$$;

COMMENT ON FUNCTION public.uretim_uyarilari_uret IS
  'Üretim uyarılarını üretir. pg_cron ile 15 dakikada bir çağrılır, hangi kontrolün sırası geldiğine Türkiye saatine bakarak kendisi karar verir.';

-- ─── Zamanlama ──────────────────────────────────────────────
-- pg_cron kurulumu bazı planlarda kısıtlı olabiliyor. Kurulamazsa
-- migration'ın tamamı çökmesin: fonksiyon her hâlükârda oluşsun,
-- zamanlama elle veya Vercel cron ile de tetiklenebilir.
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'uretim-uyarilari') THEN
    PERFORM cron.unschedule('uretim-uyarilari');
  END IF;

  PERFORM cron.schedule(
    'uretim-uyarilari',
    '*/15 * * * *',
    'SELECT public.uretim_uyarilari_uret();'
  );

  RAISE NOTICE 'uretim-uyarilari zamanlandı (15 dakikada bir)';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron zamanlaması kurulamadı: %. Fonksiyon oluşturuldu, elle tetiklenebilir.', SQLERRM;
END $$;
