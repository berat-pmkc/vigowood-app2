-- =============================================================
-- 134: İş talimatı zamanlayıcısı (pg_cron, dakikada bir)
--
-- Yaptıkları (Europe/Istanbul saatiyle):
--  1) Cumartesi 17:30 (ayarlanabilir): yayındaki plan -> pasif; açık bildirimler durdurulur.
--  2) Pazartesi 07:55 (ayarlanabilir): bu haftanın yayındaki planı için otomatik "herkese" bildirim.
--  3) Zamanı gelen 'beklemede' yayınların bildirimlerini gönderir.
--  4) hatirlatma_dakika'da bir, onaylamayan personele yeni bildirim (onay/durdurma/pasif olana dek).
--  5) rapor_dakika sonra planlayıcıya "kimler onaylamadı" özeti.
-- Ayarlar: app_settings 'talimat_ayarlari' (eksikse varsayılanlar, bkz. talimat_ayarlari()).
-- =============================================================

CREATE OR REPLACE FUNCTION public.talimat_zamanlayici()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ay        JSONB := public.talimat_ayarlari();
  v_gun       INTEGER := COALESCE((v_ay -> 'pasif_gun_saat' ->> 'gun')::integer, 6);
  v_saat      TIME := COALESCE((v_ay -> 'pasif_gun_saat' ->> 'saat')::time, '17:30'::time);
  v_pzt_saat  TIME := COALESCE((v_ay ->> 'pazartesi_bildirim_saat')::time, '07:55'::time);
  v_hatirlat  INTEGER := GREATEST(COALESCE((v_ay ->> 'hatirlatma_dakika')::integer, 10), 1);
  v_rapor     INTEGER := GREATEST(COALESCE((v_ay ->> 'rapor_dakika')::integer, 15), 1);
  v_simdi     TIMESTAMP := now() AT TIME ZONE 'Europe/Istanbul';
  v_bugun     DATE := (now() AT TIME ZONE 'Europe/Istanbul')::date;
  v_pasif_n   INTEGER := 0;
  v_pzt_n     INTEGER := 0;
  v_gonder_n  INTEGER := 0;
  v_hatirlat_n INTEGER := 0;
  v_rapor_n   INTEGER := 0;
  r           RECORD;
  v_personel  TEXT[];
  v_hedef     TEXT;
  v_adlar     TEXT;
  v_liste     JSONB;
BEGIN
  -- Aynı anda iki çalışma olmasın
  IF NOT pg_try_advisory_xact_lock(hashtext('talimat_zamanlayici')) THEN
    RETURN jsonb_build_object('atlandi', true);
  END IF;

  -- 1) Otomatik pasif: hafta_baslangic + (gun-1) günü, saat'ten itibaren (veya hafta tamamen geçtiyse)
  FOR r IN
    SELECT plan_id FROM public.talimat_planlar
    WHERE durum = 'yayinda'
      AND (hafta_baslangic + (v_gun - 1)) + v_saat <= v_simdi
  LOOP
    UPDATE public.talimat_planlar SET durum = 'pasif', pasif_at = now() WHERE plan_id = r.plan_id;
    UPDATE public.talimat_yayinlar SET durum = 'durduruldu', durdurma_at = now()
    WHERE plan_id = r.plan_id AND durum IN ('beklemede', 'gonderildi');
    UPDATE public.notifications SET geri_cekildi_at = now()
    WHERE kind = 'talimat_degisiklik' AND geri_cekildi_at IS NULL
      AND yayin_id IN (SELECT yayin_id FROM public.talimat_yayinlar WHERE plan_id = r.plan_id);
    UPDATE public.talimat_satirlar SET onay_bekliyor = false WHERE plan_id = r.plan_id AND onay_bekliyor;
    v_pasif_n := v_pasif_n + 1;
  END LOOP;

  -- 2) Pazartesi sabahı otomatik bildirim (bu haftanın yayındaki planı, bir kez)
  IF v_simdi::time >= v_pzt_saat THEN
    FOR r IN
      SELECT plan_id FROM public.talimat_planlar
      WHERE durum = 'yayinda' AND hafta_baslangic = v_bugun AND pazartesi_bildirim_at IS NULL
    LOOP
      -- Yayın başarısız olsa (ör. boş plan) tekrar denenmesin
      UPDATE public.talimat_planlar SET pazartesi_bildirim_at = now() WHERE plan_id = r.plan_id;
      BEGIN
        PERFORM public.talimat_yayinla_ic(r.plan_id, true, now(), true, 'herkes', NULL, true);
        v_pzt_n := v_pzt_n + 1;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'talimat pazartesi bildirimi başarısız (plan %): %', r.plan_id, SQLERRM;
      END;
    END LOOP;
  END IF;

  -- 3) Zamanı gelen planlı gönderimler
  FOR r IN
    SELECT y.yayin_id FROM public.talimat_yayinlar y
    JOIN public.talimat_planlar p ON p.plan_id = y.plan_id
    WHERE y.durum = 'beklemede' AND y.bildirim_gonder AND y.gonderim_zamani <= now()
      AND p.durum <> 'pasif'
  LOOP
    PERFORM public.talimat_bildirim_gonder_ic(r.yayin_id, false, NULL);
    UPDATE public.talimat_yayinlar SET durum = 'gonderildi', ilk_gonderim_at = now() WHERE yayin_id = r.yayin_id;
    v_gonder_n := v_gonder_n + 1;
  END LOOP;

  -- 4) Hatırlatmalar: son bildirimden beri hatirlatma_dakika geçmiş, onaylamamış personel
  FOR r IN
    SELECT y.yayin_id,
           array_agg(h.personel_id) AS personeller
    FROM public.talimat_yayinlar y
    JOIN public.talimat_yayin_hedefler h ON h.yayin_id = y.yayin_id
    WHERE y.durum = 'gonderildi' AND y.bildirim_gonder
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                      WHERE o.yayin_id = h.yayin_id AND o.personel_id = h.personel_id)
      AND COALESCE(h.son_bildirim_at, y.ilk_gonderim_at, y.gonderim_zamani)
            <= now() - make_interval(mins => v_hatirlat)
    GROUP BY y.yayin_id
  LOOP
    v_hatirlat_n := v_hatirlat_n + public.talimat_bildirim_gonder_ic(r.yayin_id, true, r.personeller);
  END LOOP;

  -- 5) Planlayıcıya özet: ilk gönderimden rapor_dakika sonra, hâlâ onaylamayan varsa (bir kez)
  FOR r IN
    SELECT y.yayin_id, y.plan_id, COALESCE(y.yayinlayan, p.olusturan) AS alici, p.hafta_baslangic
    FROM public.talimat_yayinlar y
    JOIN public.talimat_planlar p ON p.plan_id = y.plan_id
    WHERE y.durum = 'gonderildi' AND y.bildirim_gonder AND y.rapor_gonderildi_at IS NULL
      AND y.ilk_gonderim_at <= now() - make_interval(mins => v_rapor)
  LOOP
    SELECT string_agg(u.full_name, ', ' ORDER BY u.full_name),
           jsonb_agg(jsonb_build_object('personel_id', u.user_id, 'ad', u.full_name) ORDER BY u.full_name)
      INTO v_adlar, v_liste
    FROM public.talimat_yayin_hedefler h
    JOIN public.users u ON u.user_id = h.personel_id
    WHERE h.yayin_id = r.yayin_id
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                      WHERE o.yayin_id = h.yayin_id AND o.personel_id = h.personel_id);

    UPDATE public.talimat_yayinlar SET rapor_gonderildi_at = now() WHERE yayin_id = r.yayin_id;

    IF v_liste IS NOT NULL AND r.alici IS NOT NULL THEN
      INSERT INTO public.notifications
        (notif_id, title, message, target_user, status, created_by, kind, payload, sesli, yayin_id)
      VALUES (
        'TLR-' || to_char(clock_timestamp() AT TIME ZONE 'Europe/Istanbul', 'YYYYMMDDHH24MISSMS')
          || '-' || r.alici || '-' || substr(md5(random()::text), 1, 4),
        'İş talimatını henüz onaylamayan personel var',
        jsonb_array_length(v_liste) || ' personel ' || v_rapor || ' dakikadır onaylamadı: ' || v_adlar,
        r.alici, 'Yeni', 'sistem', 'talimat_rapor',
        jsonb_build_object('yayin_id', r.yayin_id, 'plan_id', r.plan_id, 'onaylamayanlar', v_liste),
        false, r.yayin_id);
      v_rapor_n := v_rapor_n + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'pasif_plan', v_pasif_n, 'pazartesi_bildirim', v_pzt_n, 'planli_gonderim', v_gonder_n,
    'hatirlatma', v_hatirlat_n, 'rapor', v_rapor_n);
END;
$$;

COMMENT ON FUNCTION public.talimat_zamanlayici IS
  'İş talimatı zamanlayıcısı: otomatik pasif, Pazartesi bildirimi, planlı gönderim, hatırlatma, planlayıcı raporu. pg_cron her dakika çağırır.';

REVOKE ALL ON FUNCTION public.talimat_zamanlayici() FROM PUBLIC, anon, authenticated;

-- ── Zamanlama ───────────────────────────────────────────────
-- pg_cron kurulamazsa migration çökmesin; fonksiyon elle veya harici cron ile de tetiklenebilir.
DO $$
BEGIN
  EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'talimat-zamanlayici') THEN
    PERFORM cron.unschedule('talimat-zamanlayici');
  END IF;

  PERFORM cron.schedule(
    'talimat-zamanlayici',
    '* * * * *',
    'SELECT public.talimat_zamanlayici();'
  );
  RAISE NOTICE 'talimat-zamanlayici zamanlandı (dakikada bir)';
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'pg_cron zamanlaması kurulamadı: %. Fonksiyon oluşturuldu, elle tetiklenebilir.', SQLERRM;
END $$;
