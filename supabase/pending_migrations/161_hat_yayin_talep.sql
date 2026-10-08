-- =============================================================
-- 161: Hat bazlı iş talimatı — yayın/onay/bildirim, pasif(hat), zamanlayıcı,
--      talep çoklu hat ataması + aşama durumları, talep zili 'asama', ek seans hat bilgisi (H1, 2/2)
-- Bağımlılık: 160_hat_bazli_talimat.sql
-- =============================================================

-- ── 1) Görünümler ─────────────────────────────────────────────

-- Yayın özeti: hat hedefleri de sayılır. onaylamayanlar (text[]) yalnız eski personel hedefleri;
-- onaylamayan_hatlar = [{hat_id, hat_adi}] ve hat_sayisi sona eklendi.
CREATE OR REPLACE VIEW public.talimat_yayin_ozet AS
SELECT
  y.yayin_id, y.plan_id, y.yayinlayan, y.bildirim_gonder, y.sesli, y.hedef,
  y.gonderim_zamani, y.durum, y.ilk_gonderim_at, y.durdurma_at, y.durduran,
  y.rapor_gonderildi_at, y.otomatik, y.satir_sayisi, y.personel_sayisi, y.snapshot, y.created_at,
  COALESCE(h.hedef_sayisi, 0)       AS hedef_sayisi,
  COALESCE(h.onay_sayisi, 0)        AS onay_sayisi,
  COALESCE(h.hedef_sayisi, 0) - COALESCE(h.onay_sayisi, 0) AS onaylamayan_sayisi,
  COALESCE(h.onaylamayanlar, '{}')  AS onaylamayanlar,
  y.hat_sayisi,
  COALESCE(h.onaylamayan_hatlar, '[]'::jsonb) AS onaylamayan_hatlar
FROM public.talimat_yayinlar y
LEFT JOIN LATERAL (
  SELECT count(*) AS hedef_sayisi,
         count(o.yayin_id) AS onay_sayisi,
         array_agg(hh.personel_id ORDER BY hh.personel_id)
           FILTER (WHERE o.yayin_id IS NULL AND hh.hat_id IS NULL) AS onaylamayanlar,
         jsonb_agg(jsonb_build_object('hat_id', hh.hat_id, 'hat_adi', ht.ad) ORDER BY ht.sira)
           FILTER (WHERE o.yayin_id IS NULL AND hh.hat_id IS NOT NULL) AS onaylamayan_hatlar
  FROM public.talimat_yayin_hedefler hh
  LEFT JOIN public.talimat_hatlar ht ON ht.hat_id = hh.hat_id
  LEFT JOIN public.talimat_onaylar o
    ON o.yayin_id = hh.yayin_id
   AND ((hh.hat_id IS NOT NULL AND o.hat_id = hh.hat_id)
        OR (hh.hat_id IS NULL AND o.hat_id IS NULL AND o.personel_id = hh.personel_id))
  WHERE hh.yayin_id = y.yayin_id
) h ON true;
ALTER VIEW public.talimat_yayin_ozet SET (security_invoker = true);
GRANT SELECT ON public.talimat_yayin_ozet TO authenticated;

-- Talep durumu: uretilen (paketleme hattı varsa paketleme adedi, yoksa montaj bitiş adımı/kesim),
-- atanan_personeller NULL'suz, asamalar (hat bazlı aşama durumu) sona eklendi.
-- Aşama durumu: atandi (henüz seans yok) | basladi (seans açıldı/üretim var) | tamamlandi | tamamlanmadi (satır elle kapatıldı)
CREATE OR REPLACE VIEW public.talep_durum AS
WITH bagli AS (
  SELECT e.talep_id,
         count(*)                                  AS satir_sayisi,
         count(*) FILTER (WHERE e.etkin_pasif)     AS pasif_sayisi,
         array_agg(DISTINCT e.personel_id) FILTER (WHERE e.personel_id IS NOT NULL) AS personeller,
         array_agg(DISTINCT e.etkin_istasyon)      AS istasyonlar,
         array_agg(e.satir_id)                     AS satir_ids
  FROM public.talimat_satir_etkin e
  WHERE e.talep_id IS NOT NULL
  GROUP BY e.talep_id
)
SELECT
  t.talep_id, t.talep_no, t.sku, pd.urun_adi, t.hedef_depo_id, d.ad AS depo_adi,
  t.istenen_miktar, t.termin_tarihi, t.aciklama,
  t.olusturan, u.full_name AS olusturan_adi,
  t.created_at, t.updated_at,
  t.kapanis, t.kapanis_neden, t.kapanis_at, t.kapatan,
  CASE
    WHEN t.kapanis IS NOT NULL THEN t.kapanis
    WHEN b.talep_id IS NULL THEN 'acik'
    WHEN b.pasif_sayisi = b.satir_sayisi THEN 'pasif'
    WHEN t.istenen_miktar IS NOT NULL AND pr.uretilen >= t.istenen_miktar THEN 'hazir'
    WHEN pr.seans_basladi THEN 'hazirlaniyor'
    ELSE 'is_emri_verildi'
  END AS durum,
  COALESCE(b.satir_sayisi, 0) AS bagli_satir_sayisi,
  COALESCE(b.personeller, '{}') AS atanan_personeller,
  COALESCE(pr.uretilen, 0) AS uretilen,
  CASE WHEN t.istenen_miktar IS NOT NULL THEN GREATEST(t.istenen_miktar - COALESCE(pr.uretilen, 0), 0) END AS kalan,
  (t.created_at + interval '10 minutes') AS serbest_duzenleme_bitis,
  (now() <= t.created_at + interval '10 minutes') AS serbest_mi,
  COALESCE((SELECT ts.miktar FROM public.urun_toplam_stok ts WHERE ts.sku = t.sku), 0) AS toplam_stok,
  CASE WHEN t.hedef_depo_id IS NOT NULL THEN
    COALESCE((SELECT sum(ds.miktar) FROM public.urun_depo_stok ds
              WHERE ds.sku = t.sku AND ds.depo_id = t.hedef_depo_id), 0)
  END AS depo_stok,
  t.kaldirildi_at,
  COALESCE(st.asamalar, '[]'::jsonb) AS asamalar
FROM public.talepler t
LEFT JOIN public.products pd ON pd.sku = t.sku
LEFT JOIN public.depolar d ON d.depo_id = t.hedef_depo_id
LEFT JOIN public.users u ON u.user_id = t.olusturan
LEFT JOIN bagli b ON b.talep_id = t.talep_id
LEFT JOIN LATERAL (
  SELECT
    CASE
      WHEN 'paketleme' = ANY (b.istasyonlar) THEN COALESCE((
        SELECT sum(pe.qty) FROM public.pack_events pe
        WHERE pe.sku = t.sku AND pe.durum = 'tamamlandi'
          AND COALESCE(pe.end_time, pe.tarih) >= t.created_at), 0)
      ELSE GREATEST(
        CASE WHEN 'montaj' = ANY (b.istasyonlar) THEN COALESCE((
          SELECT sum(ms.qty) FROM public.montaj_sessions ms
          WHERE ms.sku = t.sku AND ms.is_final_step AND ms.durum = 'tamamlandi'
            AND COALESCE(ms.end_time, ms.start_time) >= t.created_at), 0) ELSE 0 END,
        CASE WHEN 'kesim' = ANY (b.istasyonlar) THEN COALESCE((
          SELECT sum(cb.adet) FROM public.cut_batches cb
          WHERE cb.durum = 'tamamlandi' AND cb.talimat_satir_id = ANY (b.satir_ids)), 0) ELSE 0 END)
    END AS uretilen,
    (
      ('montaj' = ANY (b.istasyonlar) AND EXISTS (
         SELECT 1 FROM public.montaj_sessions ms
         WHERE ms.sku = t.sku AND ms.start_time >= t.created_at))
      OR ('paketleme' = ANY (b.istasyonlar) AND EXISTS (
         SELECT 1 FROM public.pack_events pe
         WHERE pe.sku = t.sku AND COALESCE(pe.start_time, pe.tarih) >= t.created_at))
      OR ('kesim' = ANY (b.istasyonlar) AND EXISTS (
         SELECT 1 FROM public.cut_batches cb WHERE cb.talimat_satir_id = ANY (b.satir_ids)))
    ) AS seans_basladi
) pr ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(jsonb_build_object(
           'satir_id', i.satir_id,
           'hat_id', i.hat_id,
           'hat_adi', i.hat_adi,
           'tur', i.hat_tur,
           'durum', CASE
                      WHEN i.kapanis = 'tamamlanmadi' THEN 'tamamlanmadi'
                      WHEN i.tamamlandi_mi THEN 'tamamlandi'
                      WHEN i.uretilen > 0 OR COALESCE(i.acik_seans_sayisi, 0) > 0 OR i.son_seans_at IS NOT NULL THEN 'basladi'
                      ELSE 'atandi' END,
           'uretilen', i.uretilen,
           'istenen', i.istenen_miktar,
           'pasif', i.etkin_pasif)
         ORDER BY i.hat_sira, i.sira) AS asamalar
  FROM public.talimat_satir_ilerleme i
  WHERE i.talep_id = t.talep_id AND i.hat_id IS NOT NULL
) st ON true;
ALTER VIEW public.talep_durum SET (security_invoker = true);
GRANT SELECT ON public.talep_durum TO authenticated;

-- Ek seans: hat bilgisi sona eklendi
CREATE OR REPLACE VIEW public.ek_seanslar AS
SELECT
  'montaj'::text                                   AS kaynak,
  ms.session_id,
  ms.operator_id                                   AS personel_id,
  ms.operator_name                                 AS personel_adi,
  ms.sku,
  p.urun_adi,
  ms.step_id,
  ms.step_name,
  ms.seq_no,
  ms.qty::numeric                                  AS qty,
  CASE WHEN ms.durum = 'tamamlandi' THEN 'tamamlandi'
       WHEN ms.duraklatma_baslangic IS NOT NULL THEN 'beklemede'
       ELSE 'acik' END                             AS durum,
  ms.start_time,
  ms.end_time,
  CASE WHEN ms.durum = 'tamamlandi' THEN
    COALESCE(ms.net_sure_dk,
      GREATEST(0, EXTRACT(EPOCH FROM (ms.end_time - ms.start_time)) / 60 - COALESCE(ms.duraklama_dk, 0)))
  END::numeric(12,2)                               AS net_sure_dk,
  (ms.start_time AT TIME ZONE 'Europe/Istanbul')::date AS gun,
  ms.hat_id,
  h.ad                                             AS hat_adi
FROM public.montaj_sessions ms
LEFT JOIN public.products p ON p.sku = ms.sku
LEFT JOIN public.talimat_hatlar h ON h.hat_id = ms.hat_id
WHERE ms.ek_seans AND ms.start_time IS NOT NULL
UNION ALL
SELECT
  'paketleme'::text,
  pe.session_id,
  pe.operator_id,
  pe.operator_name,
  pe.sku,
  p.urun_adi,
  NULL::text, NULL::text, NULL::integer,
  pe.qty::numeric,
  CASE WHEN pe.durum = 'tamamlandi' THEN 'tamamlandi'
       WHEN pe.duraklatma_baslangic IS NOT NULL THEN 'beklemede'
       ELSE 'acik' END,
  pe.start_time,
  pe.end_time,
  CASE WHEN pe.durum = 'tamamlandi' AND pe.end_time IS NOT NULL THEN
    GREATEST(0, EXTRACT(EPOCH FROM (pe.end_time - pe.start_time)) / 60 - COALESCE(pe.duraklama_dk, 0))
  END::numeric(12,2),
  (pe.start_time AT TIME ZONE 'Europe/Istanbul')::date,
  pe.hat_id,
  h.ad
FROM public.pack_events pe
LEFT JOIN public.products p ON p.sku = pe.sku
LEFT JOIN public.talimat_hatlar h ON h.hat_id = pe.hat_id
WHERE pe.ek_seans AND pe.start_time IS NOT NULL;
ALTER VIEW public.ek_seanslar SET (security_invoker = true);
GRANT SELECT ON public.ek_seanslar TO authenticated;

-- ── 2) Yayın yardımcıları ─────────────────────────────────────

-- Yayında onaylamamış hedef (hat veya eski personel) var mı
CREATE OR REPLACE FUNCTION public.talimat_yayin_onaysiz_var(p_yayin UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.talimat_yayin_hedefler h
    WHERE h.yayin_id = p_yayin
      AND NOT EXISTS (
        SELECT 1 FROM public.talimat_onaylar o
        WHERE o.yayin_id = h.yayin_id
          AND ((h.hat_id IS NOT NULL AND o.hat_id = h.hat_id)
               OR (h.hat_id IS NULL AND o.hat_id IS NULL AND o.personel_id = h.personel_id))));
$$;

-- onay_bekliyor bayrağını, satırı hâlâ bekleyen başka bildirimli yayın yoksa temizler (hat sürümü)
CREATE OR REPLACE FUNCTION public.talimat_onay_bekliyor_temizle_hat(p_hat UUID, p_satir_ids UUID[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.talimat_satirlar s
  SET onay_bekliyor = false
  WHERE s.satir_id = ANY (p_satir_ids)
    AND s.onay_bekliyor
    AND NOT EXISTS (
      SELECT 1
      FROM public.talimat_yayin_hedefler h
      JOIN public.talimat_yayinlar y ON y.yayin_id = h.yayin_id
      WHERE h.hat_id = p_hat
        AND s.satir_id = ANY (h.satir_ids)
        AND y.bildirim_gonder
        AND y.durum IN ('beklemede', 'gonderildi')
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id AND o.hat_id = h.hat_id)
    );
$$;

-- Onaylamamış hedef HATLARA bildirim yazar. target_user NULL; payload.hat_id/hat_adi ile tablet süzer
-- (kind='talimat_degisiklik'). Aynı yayın+hat için önceki okunmamış bildirimler geri çekilir.
CREATE OR REPLACE FUNCTION public.talimat_bildirim_gonder_hat_ic(
  p_yayin UUID, p_hatirlatma BOOLEAN, p_hatlar UUID[] DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_y     public.talimat_yayinlar%ROWTYPE;
  r       RECORD;
  v_n     INTEGER := 0;
  v_baslik TEXT;
  v_mesaj  TEXT;
BEGIN
  SELECT * INTO v_y FROM public.talimat_yayinlar WHERE yayin_id = p_yayin;
  IF NOT FOUND THEN RETURN 0; END IF;

  FOR r IN
    SELECT h.hat_id, cardinality(h.satir_ids) AS satir_n, ht.ad AS hat_adi, ht.tur AS hat_tur
    FROM public.talimat_yayin_hedefler h
    JOIN public.talimat_hatlar ht ON ht.hat_id = h.hat_id
    WHERE h.yayin_id = p_yayin
      AND h.hat_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                      WHERE o.yayin_id = h.yayin_id AND o.hat_id = h.hat_id)
      AND (p_hatlar IS NULL OR h.hat_id = ANY (p_hatlar))
  LOOP
    UPDATE public.notifications SET geri_cekildi_at = now()
    WHERE yayin_id = p_yayin AND kind = 'talimat_degisiklik' AND geri_cekildi_at IS NULL
      AND payload ->> 'hat_id' = r.hat_id::text;

    v_baslik := CASE
      WHEN p_hatirlatma THEN 'Hatırlatma: ' || r.hat_adi || ' iş talimatını onayla'
      WHEN v_y.otomatik THEN r.hat_adi || ': bu haftanın iş talimatı hazır'
      ELSE r.hat_adi || ' iş talimatı güncellendi' END;
    v_mesaj := CASE
      WHEN r.satir_n > 0 AND NOT v_y.otomatik THEN
        r.satir_n || ' satır değişti. Listeni kontrol edip "Görüldü, anlaşıldı" düğmesine bas.'
      ELSE 'İş talimatı listeni kontrol edip "Görüldü, anlaşıldı" düğmesine bas.' END;

    INSERT INTO public.notifications
      (notif_id, title, message, target_user, status, created_by, kind, payload, sesli, yayin_id)
    VALUES (
      'TLM-' || to_char(clock_timestamp() AT TIME ZONE 'Europe/Istanbul', 'YYYYMMDDHH24MISSMS')
        || '-H' || substr(r.hat_id::text, 1, 8) || '-' || substr(md5(random()::text), 1, 4),
      v_baslik, v_mesaj, NULL, 'Yeni', 'sistem', 'talimat_degisiklik',
      jsonb_build_object(
        'yayin_id', p_yayin, 'plan_id', v_y.plan_id, 'hat_id', r.hat_id, 'hat_adi', r.hat_adi,
        'hat_tur', r.hat_tur, 'satir_sayisi', r.satir_n, 'hatirlatma', p_hatirlatma,
        'otomatik', v_y.otomatik),
      v_y.sesli, p_yayin);

    UPDATE public.talimat_yayin_hedefler
    SET son_bildirim_at = now(), bildirim_sayisi = bildirim_sayisi + 1
    WHERE yayin_id = p_yayin AND hat_id = r.hat_id;
    v_n := v_n + 1;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ── 3) Yayınla (hat + eski personel hedefleri) ────────────────
-- p_hedef 'degisenler': değişen satırı olan hatlar + silme/sıra değişikliği olan hatlar (degisen_hatlar);
-- 'herkes' / ilk yayın / otomatik: ürünlü satırı olan tüm hatlar. Boş satırlar hiçbir zaman hedef olmaz.
CREATE OR REPLACE FUNCTION public.talimat_yayinla_ic(
  p_plan UUID, p_bildirim BOOLEAN, p_gonderim TIMESTAMPTZ, p_sesli BOOLEAN, p_hedef TEXT,
  p_yayinlayan TEXT, p_otomatik BOOLEAN DEFAULT false
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan      public.talimat_planlar%ROWTYPE;
  v_ilk       BOOLEAN;
  v_tum       BOOLEAN;
  v_hedef     TEXT;
  v_bildirim  BOOLEAN;
  v_gonderim  TIMESTAMPTZ;
  v_yayin     UUID;
  v_snapshot  JSONB;
  v_satir_n   INTEGER;
  v_personel  TEXT[];
  v_hatlar    UUID[];
BEGIN
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan yayınlanamaz'; END IF;

  v_ilk := v_plan.durum = 'taslak';
  v_tum := v_ilk OR p_otomatik;
  v_hedef := CASE WHEN v_tum THEN 'herkes' ELSE COALESCE(NULLIF(p_hedef, ''), 'degisenler') END;
  IF v_hedef NOT IN ('degisenler', 'herkes') THEN RAISE EXCEPTION 'Geçersiz hedef: %', v_hedef; END IF;
  v_bildirim := COALESCE(p_bildirim, false) AND v_plan.hafta_baslangic <= public.talimat_bugun();
  v_gonderim := COALESCE(p_gonderim, now());

  IF v_hedef = 'herkes' THEN
    SELECT array_agg(DISTINCT personel_id) INTO v_personel
    FROM public.talimat_satirlar
    WHERE plan_id = p_plan AND personel_id IS NOT NULL AND (sku IS NOT NULL OR plaka_id IS NOT NULL);
    SELECT array_agg(DISTINCT hat_id) INTO v_hatlar
    FROM public.talimat_satirlar
    WHERE plan_id = p_plan AND hat_id IS NOT NULL AND (sku IS NOT NULL OR plaka_id IS NOT NULL);
  ELSE
    SELECT array_agg(DISTINCT q.pid) INTO v_personel FROM (
      SELECT personel_id AS pid FROM public.talimat_satirlar
      WHERE plan_id = p_plan AND degisti AND personel_id IS NOT NULL AND (sku IS NOT NULL OR plaka_id IS NOT NULL)
      UNION
      SELECT unnest(v_plan.degisen_personeller) AS pid
    ) q WHERE q.pid IS NOT NULL;
    SELECT array_agg(DISTINCT q.hid) INTO v_hatlar FROM (
      SELECT hat_id AS hid FROM public.talimat_satirlar
      WHERE plan_id = p_plan AND degisti AND hat_id IS NOT NULL AND (sku IS NOT NULL OR plaka_id IS NOT NULL)
      UNION
      SELECT unnest(v_plan.degisen_hatlar) AS hid
    ) q;
  END IF;
  IF COALESCE(cardinality(v_personel), 0) + COALESCE(cardinality(v_hatlar), 0) = 0 THEN
    RAISE EXCEPTION 'Yayınlanacak değişiklik yok';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'satir_id', satir_id, 'personel_id', personel_id, 'hat_id', hat_id, 'sira', sira, 'istasyon', istasyon,
           'sku', sku, 'plaka_id', plaka_id, 'istenen_miktar', istenen_miktar,
           'not_text', not_text, 'durum', durum) ORDER BY hat_id, personel_id, sira), '[]'::jsonb),
         count(*)
    INTO v_snapshot, v_satir_n
  FROM public.talimat_satirlar
  WHERE plan_id = p_plan AND (degisti OR v_tum) AND (sku IS NOT NULL OR plaka_id IS NOT NULL);

  INSERT INTO public.talimat_yayinlar
    (plan_id, yayinlayan, bildirim_gonder, sesli, hedef, gonderim_zamani, durum, otomatik,
     satir_sayisi, personel_sayisi, hat_sayisi, snapshot)
  VALUES
    (p_plan, p_yayinlayan, v_bildirim, COALESCE(p_sesli, false), v_hedef, v_gonderim,
     CASE WHEN v_bildirim THEN 'beklemede' ELSE 'bildirimsiz' END, COALESCE(p_otomatik, false),
     v_satir_n, COALESCE(cardinality(v_personel), 0), COALESCE(cardinality(v_hatlar), 0), v_snapshot)
  RETURNING yayin_id INTO v_yayin;

  INSERT INTO public.talimat_yayin_hedefler (yayin_id, personel_id, satir_ids)
  SELECT v_yayin, pid,
         COALESCE((SELECT array_agg(s.satir_id ORDER BY s.sira)
                   FROM public.talimat_satirlar s
                   WHERE s.plan_id = p_plan AND s.personel_id = pid AND (s.degisti OR v_tum)
                     AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)), '{}')
  FROM unnest(COALESCE(v_personel, '{}'::text[])) AS pid;

  INSERT INTO public.talimat_yayin_hedefler (yayin_id, hat_id, satir_ids)
  SELECT v_yayin, hid,
         COALESCE((SELECT array_agg(s.satir_id ORDER BY s.sira)
                   FROM public.talimat_satirlar s
                   WHERE s.plan_id = p_plan AND s.hat_id = hid AND (s.degisti OR v_tum)
                     AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)), '{}')
  FROM unnest(COALESCE(v_hatlar, '{}'::uuid[])) AS hid;

  -- Kırmızı (onay bekliyor) yalnızca bildirimli ve ilk/otomatik olmayan yayında
  IF v_bildirim AND NOT v_tum THEN
    UPDATE public.talimat_satirlar SET onay_bekliyor = true
    WHERE plan_id = p_plan AND degisti AND (sku IS NOT NULL OR plaka_id IS NOT NULL);
  END IF;
  UPDATE public.talimat_satirlar SET degisti = false WHERE plan_id = p_plan AND degisti;

  UPDATE public.talimat_planlar SET
    durum = 'yayinda',
    yayinlandi_at = COALESCE(yayinlandi_at, now()),
    degisen_personeller = '{}',
    degisen_hatlar = '{}',
    pazartesi_bildirim_at = CASE
      WHEN pazartesi_bildirim_at IS NULL
           AND (p_otomatik OR (v_ilk AND hafta_baslangic <= public.talimat_bugun()))
        THEN now() ELSE pazartesi_bildirim_at END
  WHERE plan_id = p_plan;

  IF v_bildirim AND v_gonderim <= now() THEN
    PERFORM public.talimat_bildirim_gonder_ic(v_yayin, false, NULL);
    PERFORM public.talimat_bildirim_gonder_hat_ic(v_yayin, false, NULL);
    UPDATE public.talimat_yayinlar SET durum = 'gonderildi', ilk_gonderim_at = now() WHERE yayin_id = v_yayin;
  END IF;

  RETURN jsonb_build_object(
    'yayin_id', v_yayin, 'personel_sayisi', COALESCE(cardinality(v_personel), 0),
    'hat_sayisi', COALESCE(cardinality(v_hatlar), 0), 'satir_sayisi', v_satir_n,
    'bildirim_gonder', v_bildirim, 'ilk_yayin', v_ilk,
    'durum', (SELECT durum FROM public.talimat_yayinlar WHERE yayin_id = v_yayin));
END;
$$;

-- Bildirimi durdurur / geri çeker (eski tanım + hat hedefleri)
CREATE OR REPLACE FUNCTION public.talimat_bildirim_durdur(p_yayin UUID, p_geri_cek BOOLEAN DEFAULT false)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_y public.talimat_yayinlar%ROWTYPE;
  r RECORD;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_y FROM public.talimat_yayinlar WHERE yayin_id = p_yayin FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Yayın bulunamadı'; END IF;
  IF v_y.durum NOT IN ('beklemede', 'gonderildi') THEN
    RAISE EXCEPTION 'Bu yayının bildirimi zaten sona ermiş (durum: %)', v_y.durum;
  END IF;

  UPDATE public.talimat_yayinlar
  SET durum = CASE WHEN p_geri_cek THEN 'geri_cekildi' ELSE 'durduruldu' END,
      durdurma_at = now(), durduran = public.talimat_kullanici_id()
  WHERE yayin_id = p_yayin;

  IF p_geri_cek THEN
    UPDATE public.notifications SET geri_cekildi_at = now()
    WHERE yayin_id = p_yayin AND geri_cekildi_at IS NULL;
    FOR r IN
      SELECT h.personel_id, h.hat_id, h.satir_ids FROM public.talimat_yayin_hedefler h
      WHERE h.yayin_id = p_yayin
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id
                          AND ((h.hat_id IS NOT NULL AND o.hat_id = h.hat_id)
                               OR (h.hat_id IS NULL AND o.hat_id IS NULL AND o.personel_id = h.personel_id)))
    LOOP
      IF r.hat_id IS NOT NULL THEN
        PERFORM public.talimat_onay_bekliyor_temizle_hat(r.hat_id, r.satir_ids);
      ELSE
        PERFORM public.talimat_onay_bekliyor_temizle(r.personel_id, r.satir_ids);
      END IF;
    END LOOP;
  END IF;
END;
$$;

-- "Görüldü, anlaşıldı". p_hat verilirse HAT onayı (hat başına bir kez; o planın tüm üretim kullanıcıları/istasyon
-- tabletleri onaylayabilir; onaylayan kullanıcı talimat_onaylar.onaylayan'a yazılır). Aksi halde eski personel onayı.
-- p_hepsi=true: aynı plandaki o hat/personel için onaylanmamış TÜM açık yayınlar onaylanır.
-- Dönen: onaylanan yayın sayısı.
DROP FUNCTION IF EXISTS public.talimat_onayla(UUID, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION public.talimat_onayla(
  p_yayin UUID, p_personel TEXT DEFAULT NULL, p_hepsi BOOLEAN DEFAULT true, p_hat UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan UUID;
  v_ids  UUID[];
  v_y    UUID;
  v_n    INTEGER := 0;
  v_satirlar UUID[];
  v_kim  TEXT := public.talimat_kullanici_id();
BEGIN
  IF NOT (public.has_production_access() OR public.is_office_user()) THEN
    RAISE EXCEPTION 'Bu işlem için yetkiniz yok' USING ERRCODE = '42501';
  END IF;

  SELECT plan_id INTO v_plan FROM public.talimat_yayinlar WHERE yayin_id = p_yayin;
  IF v_plan IS NULL THEN RAISE EXCEPTION 'Yayın bulunamadı'; END IF;

  IF p_hat IS NOT NULL THEN
    -- ── Hat onayı ──
    IF NOT EXISTS (SELECT 1 FROM public.talimat_yayin_hedefler WHERE yayin_id = p_yayin AND hat_id = p_hat) THEN
      RAISE EXCEPTION 'Bu hat yayının hedefi değil';
    END IF;

    SELECT array_agg(y.yayin_id) INTO v_ids
    FROM public.talimat_yayinlar y
    JOIN public.talimat_yayin_hedefler h ON h.yayin_id = y.yayin_id AND h.hat_id = p_hat
    WHERE y.plan_id = v_plan
      AND y.durum IN ('gonderildi', 'durduruldu')
      AND (p_hepsi OR y.yayin_id = p_yayin)
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o WHERE o.yayin_id = y.yayin_id AND o.hat_id = p_hat);
    v_ids := COALESCE(v_ids, '{}');
    IF NOT (p_yayin = ANY (v_ids))
       AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar WHERE yayin_id = p_yayin AND hat_id = p_hat) THEN
      v_ids := array_append(v_ids, p_yayin);
    END IF;

    FOREACH v_y IN ARRAY v_ids LOOP
      INSERT INTO public.talimat_onaylar (yayin_id, hat_id, onaylayan)
      VALUES (v_y, p_hat, v_kim)
      ON CONFLICT (yayin_id, hat_id) WHERE hat_id IS NOT NULL DO NOTHING;
      v_n := v_n + 1;

      SELECT satir_ids INTO v_satirlar FROM public.talimat_yayin_hedefler
      WHERE yayin_id = v_y AND hat_id = p_hat;
      PERFORM public.talimat_onay_bekliyor_temizle_hat(p_hat, v_satirlar);

      INSERT INTO public.notification_reads (notif_id, user_id)
      SELECT n.notif_id, COALESCE(v_kim, 'HAT') FROM public.notifications n
      WHERE n.yayin_id = v_y AND n.payload ->> 'hat_id' = p_hat::text
      ON CONFLICT (notif_id, user_id) DO NOTHING;
      UPDATE public.notifications SET status = 'Okundu'
      WHERE yayin_id = v_y AND payload ->> 'hat_id' = p_hat::text AND status <> 'Okundu';

      IF NOT public.talimat_yayin_onaysiz_var(v_y) THEN
        UPDATE public.talimat_yayinlar SET durum = 'tamamlandi'
        WHERE yayin_id = v_y AND durum IN ('gonderildi', 'beklemede');
      END IF;
    END LOOP;
    RETURN v_n;
  END IF;

  -- ── Eski personel onayı ──
  IF p_personel IS NULL THEN RAISE EXCEPTION 'Hat veya personel belirtilmeli'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.talimat_yayin_hedefler WHERE yayin_id = p_yayin AND personel_id = p_personel) THEN
    RAISE EXCEPTION 'Bu personel yayının hedefi değil';
  END IF;

  SELECT array_agg(y.yayin_id) INTO v_ids
  FROM public.talimat_yayinlar y
  JOIN public.talimat_yayin_hedefler h ON h.yayin_id = y.yayin_id AND h.personel_id = p_personel
  WHERE y.plan_id = v_plan
    AND y.durum IN ('gonderildi', 'durduruldu')
    AND (p_hepsi OR y.yayin_id = p_yayin)
    AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                    WHERE o.yayin_id = y.yayin_id AND o.hat_id IS NULL AND o.personel_id = p_personel);
  -- Seçilen yayın henüz 'beklemede'/'bildirimsiz' bile olsa kendisi onaylanabilir
  v_ids := COALESCE(v_ids, '{}');
  IF NOT (p_yayin = ANY (v_ids))
     AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar WHERE yayin_id = p_yayin AND hat_id IS NULL AND personel_id = p_personel) THEN
    v_ids := array_append(v_ids, p_yayin);
  END IF;

  FOREACH v_y IN ARRAY v_ids LOOP
    INSERT INTO public.talimat_onaylar (yayin_id, personel_id, onaylayan)
    VALUES (v_y, p_personel, v_kim)
    ON CONFLICT (yayin_id, personel_id) WHERE hat_id IS NULL DO NOTHING;
    v_n := v_n + 1;

    SELECT satir_ids INTO v_satirlar FROM public.talimat_yayin_hedefler
    WHERE yayin_id = v_y AND personel_id = p_personel;
    PERFORM public.talimat_onay_bekliyor_temizle(p_personel, v_satirlar);

    INSERT INTO public.notification_reads (notif_id, user_id)
    SELECT n.notif_id, p_personel FROM public.notifications n
    WHERE n.yayin_id = v_y AND n.target_user = p_personel
    ON CONFLICT (notif_id, user_id) DO NOTHING;
    UPDATE public.notifications SET status = 'Okundu'
    WHERE yayin_id = v_y AND target_user = p_personel AND status <> 'Okundu';

    IF NOT public.talimat_yayin_onaysiz_var(v_y) THEN
      UPDATE public.talimat_yayinlar SET durum = 'tamamlandi'
      WHERE yayin_id = v_y AND durum IN ('gonderildi', 'beklemede');
    END IF;
  END LOOP;
  RETURN v_n;
END;
$$;

-- ── 4) Pasif (satir | personel | liste | hat) ─────────────────
CREATE OR REPLACE FUNCTION public.talimat_pasif(
  p_kapsam TEXT, p_plan UUID, p_ids TEXT[], p_baslangic DATE, p_bitis DATE, p_neden TEXT
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.talimat_planlar%ROWTYPE;
  v_bas DATE := COALESCE(p_baslangic, public.talimat_bugun());
  v_n INTEGER := 0;
  v_p TEXT;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;
  IF p_bitis IS NOT NULL AND p_bitis < v_bas THEN RAISE EXCEPTION 'Bitiş tarihi başlangıçtan önce olamaz'; END IF;

  IF p_kapsam = 'satir' THEN
    UPDATE public.talimat_satirlar
    SET durum = 'pasif', pasif_neden = NULLIF(btrim(p_neden), ''), pasif_baslangic = v_bas,
        pasif_until = p_bitis, degisti = degisti OR (v_plan.durum = 'yayinda')
    WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]);
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_kapsam = 'personel' THEN
    FOREACH v_p IN ARRAY COALESCE(p_ids, '{}') LOOP
      INSERT INTO public.talimat_pasifler (plan_id, kapsam, personel_id, baslangic, bitis, neden, olusturan)
      VALUES (p_plan, 'personel', v_p, v_bas, COALESCE(p_bitis, 'infinity'), NULLIF(btrim(p_neden), ''),
              public.talimat_kullanici_id());
      v_n := v_n + 1;
      PERFORM public.talimat_degisen_isaretle(p_plan, v_p);
    END LOOP;
  ELSIF p_kapsam = 'hat' THEN
    FOREACH v_p IN ARRAY COALESCE(p_ids, '{}') LOOP
      IF NOT EXISTS (SELECT 1 FROM public.talimat_hatlar WHERE hat_id = v_p::uuid) THEN
        RAISE EXCEPTION 'Hat bulunamadı: %', v_p;
      END IF;
      INSERT INTO public.talimat_pasifler (plan_id, kapsam, hat_id, baslangic, bitis, neden, olusturan)
      VALUES (p_plan, 'hat', v_p::uuid, v_bas, COALESCE(p_bitis, 'infinity'), NULLIF(btrim(p_neden), ''),
              public.talimat_kullanici_id());
      v_n := v_n + 1;
      PERFORM public.talimat_degisen_grup_isaretle(p_plan, v_p::uuid, NULL);
    END LOOP;
  ELSIF p_kapsam = 'liste' THEN
    INSERT INTO public.talimat_pasifler (plan_id, kapsam, baslangic, bitis, neden, olusturan)
    VALUES (p_plan, 'liste', v_bas, COALESCE(p_bitis, 'infinity'), NULLIF(btrim(p_neden), ''),
            public.talimat_kullanici_id());
    v_n := 1;
  ELSE
    RAISE EXCEPTION 'Geçersiz kapsam: % (satir|personel|hat|liste)', p_kapsam;
  END IF;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_pasif_kaldir(p_kapsam TEXT, p_plan UUID, p_ids TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yayinda BOOLEAN;
  v_n INTEGER := 0;
  v_p TEXT;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT durum = 'yayinda' INTO v_yayinda FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF v_yayinda IS NULL THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;

  IF p_kapsam = 'satir' THEN
    UPDATE public.talimat_satirlar
    SET durum = 'aktif', pasif_neden = NULL, pasif_baslangic = NULL, pasif_until = NULL,
        degisti = degisti OR v_yayinda
    WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]) AND durum = 'pasif';
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_kapsam = 'personel' THEN
    UPDATE public.talimat_pasifler SET iptal_at = now()
    WHERE plan_id = p_plan AND kapsam = 'personel' AND personel_id = ANY (p_ids) AND iptal_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSIF p_kapsam = 'hat' THEN
    UPDATE public.talimat_pasifler SET iptal_at = now()
    WHERE plan_id = p_plan AND kapsam = 'hat' AND hat_id = ANY (p_ids::uuid[]) AND iptal_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    FOREACH v_p IN ARRAY COALESCE(p_ids, '{}') LOOP
      PERFORM public.talimat_degisen_grup_isaretle(p_plan, v_p::uuid, NULL);
    END LOOP;
  ELSIF p_kapsam = 'liste' THEN
    UPDATE public.talimat_pasifler SET iptal_at = now()
    WHERE plan_id = p_plan AND kapsam = 'liste' AND iptal_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
  ELSE
    RAISE EXCEPTION 'Geçersiz kapsam: % (satir|personel|hat|liste)', p_kapsam;
  END IF;
  RETURN v_n;
END;
$$;

-- ── 5) Tablet planı (hat) ─────────────────────────────────────
-- Bu haftanın yayındaki planı; plan pasif olduysa yalnızca hat satırlarına bağlı AÇIK seans sürdüğü sürece
-- (en fazla 14 gün) eski plan. Hiçbiri yoksa NULL.
CREATE OR REPLACE FUNCTION public.talimat_tablet_plan_hat()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.plan_id
  FROM public.talimat_planlar p
  WHERE (p.durum = 'yayinda' AND p.hafta_baslangic <= public.talimat_bugun())
     OR (p.durum = 'pasif'
         AND p.hafta_baslangic >= public.talimat_bugun() - 14
         AND (EXISTS (SELECT 1 FROM public.montaj_sessions ms
                      JOIN public.talimat_satirlar s ON s.plan_id = p.plan_id AND s.hat_id IS NOT NULL
                       AND (s.satir_id = ms.talimat_satir_id OR (s.hat_id = ms.hat_id AND s.sku = ms.sku))
                      WHERE ms.durum = 'montajda')
              OR EXISTS (SELECT 1 FROM public.pack_events pe
                         JOIN public.talimat_satirlar s ON s.plan_id = p.plan_id AND s.hat_id IS NOT NULL
                          AND (s.satir_id = pe.talimat_satir_id OR (s.hat_id = pe.hat_id AND s.sku = pe.sku))
                         WHERE pe.durum = 'paketlemede')))
  ORDER BY (p.durum = 'yayinda') DESC, p.hafta_baslangic DESC
  LIMIT 1;
$$;

-- ── 6) Talebi birden fazla hatta ata ──────────────────────────
-- Her hat için bir hat satırı (sku=talep ürünü, miktar, not=talep açıklaması, talep_id). p_sira boşsa: hattın ilk BOŞ
-- satırı doldurulur, yoksa sona eklenir. p_sira doluysa: o sıradaki satır boşsa doldurulur; dolu ise p_kaydir=true araya
-- girer, değilse SIRA_DOLU. p_plan boşsa bu haftanın yayındaki planı, yoksa bu hafta/sonrası en yakın taslak.
-- Dönen: satir_id dizisi (p_hat_ids sırasıyla).
CREATE OR REPLACE FUNCTION public.talep_talimata_ata(
  p_talep UUID, p_hat_ids UUID[], p_miktar NUMERIC DEFAULT NULL, p_sira INTEGER DEFAULT NULL,
  p_kaydir BOOLEAN DEFAULT false, p_plan UUID DEFAULT NULL
) RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t    public.talepler%ROWTYPE;
  v_plan UUID := p_plan;
  v_hat  UUID;
  v_bos  UUID;
  v_id   UUID;
  v_yeni UUID[] := '{}';
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  IF v_t.kapanis IS NOT NULL THEN RAISE EXCEPTION 'Kapalı talep iş talimatına atanamaz'; END IF;
  IF p_hat_ids IS NULL OR cardinality(p_hat_ids) = 0 THEN RAISE EXCEPTION 'Hat seçilmeli'; END IF;
  IF (SELECT count(DISTINCT x) FROM unnest(p_hat_ids) x) <> cardinality(p_hat_ids) THEN
    RAISE EXCEPTION 'Aynı hat birden fazla seçilemez';
  END IF;

  IF v_plan IS NULL THEN
    SELECT plan_id INTO v_plan FROM public.talimat_planlar
    WHERE durum = 'yayinda' AND hafta_baslangic <= public.talimat_bugun()
    ORDER BY hafta_baslangic DESC LIMIT 1;
  END IF;
  IF v_plan IS NULL THEN
    SELECT plan_id INTO v_plan FROM public.talimat_planlar
    WHERE durum IN ('taslak', 'yayinda')
      AND hafta_baslangic >= date_trunc('week', public.talimat_bugun()::timestamp)::date
    ORDER BY hafta_baslangic LIMIT 1;
  END IF;
  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Atanacak iş talimatı planı bulunamadı, önce plan oluşturun';
  END IF;
  PERFORM public.talimat_plan_hat_hazirla_ic(v_plan);

  FOREACH v_hat IN ARRAY p_hat_ids LOOP
    IF NOT EXISTS (SELECT 1 FROM public.talimat_hatlar WHERE hat_id = v_hat AND aktif) THEN
      RAISE EXCEPTION 'Hat bulunamadı veya pasif';
    END IF;
    IF EXISTS (SELECT 1 FROM public.talimat_satirlar
               WHERE plan_id = v_plan AND hat_id = v_hat AND talep_id = p_talep) THEN
      RAISE EXCEPTION 'Talep bu hatta zaten atanmış';
    END IF;

    v_bos := NULL;
    IF p_sira IS NULL THEN
      SELECT satir_id INTO v_bos FROM public.talimat_satirlar
      WHERE plan_id = v_plan AND hat_id = v_hat AND sku IS NULL AND plaka_id IS NULL
      ORDER BY sira LIMIT 1;
    ELSE
      SELECT satir_id INTO v_bos FROM public.talimat_satirlar
      WHERE plan_id = v_plan AND hat_id = v_hat AND sira = p_sira AND sku IS NULL AND plaka_id IS NULL;
    END IF;

    IF v_bos IS NOT NULL THEN
      v_id := public.talimat_satir_kaydet(jsonb_build_object(
        'satir_id', v_bos, 'sku', v_t.sku, 'istenen_miktar', COALESCE(p_miktar, v_t.istenen_miktar),
        'not_text', v_t.aciklama, 'talep_id', p_talep, 'durum', 'aktif'));
    ELSE
      v_id := public.talimat_satir_kaydet(jsonb_build_object(
        'plan_id', v_plan, 'hat_id', v_hat, 'sira', p_sira, 'kaydir', COALESCE(p_kaydir, false),
        'sku', v_t.sku, 'istenen_miktar', COALESCE(p_miktar, v_t.istenen_miktar),
        'not_text', v_t.aciklama, 'talep_id', p_talep));
    END IF;
    v_yeni := array_append(v_yeni, v_id);
  END LOOP;
  RETURN v_yeni;
END;
$$;

-- ── 7) Talep zili: aşama bildirimleri (başladı / tamamlandı) ──
-- Bağlı hat satırının ilk seansı ve tamamlanması BİR KEZ bildirilir (talimat_satirlar.asama_*_bildirildi).
-- Alıcılar: planlayıcı rolleri + talebi açan (talep_bildirim_uret_ic ile aynı küme).
CREATE OR REPLACE FUNCTION public.talep_asama_bildirim_ic(p_talep UUID, p_hat UUID, p_hat_adi TEXT, p_asama TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t    public.talepler%ROWTYPE;
  v_ozet TEXT;
BEGIN
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep;
  IF NOT FOUND THEN RETURN; END IF;

  v_ozet := v_t.sku
    || CASE WHEN v_t.istenen_miktar IS NOT NULL
            THEN ' · ' || trim(to_char(v_t.istenen_miktar, 'FM999999990.##')) || ' adet' ELSE '' END
    || ' · ' || p_hat_adi
    || CASE p_asama WHEN 'basladi' THEN ' · başladı' ELSE ' · tamamlandı' END;

  INSERT INTO public.talep_bildirimleri (talep_id, alici_user_id, olay, ozet, olusturan, hat_id, hat_adi, asama)
  SELECT p_talep, r.user_id, 'asama', v_ozet, NULL, p_hat, p_hat_adi, p_asama
  FROM (
    SELECT u.user_id FROM public.users u
    WHERE u.is_active
      AND u.role IN ('Yönetici','E-Ticaret Müdürü','Üretim ve Planlama Sorumlusu','Endüstri Mühendisi')
    UNION
    SELECT u.user_id FROM public.users u
    WHERE u.is_active AND u.user_id = v_t.olusturan
  ) r;
END;
$$;

-- Seans olayı -> ilgili hat satırlarının aşama durumunu kontrol et
CREATE OR REPLACE FUNCTION public.talep_asama_isle_ic(p_sku TEXT, p_hat UUID, p_satir UUID, p_tamamlandi BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_bitti BOOLEAN;
BEGIN
  IF p_sku IS NULL THEN RETURN; END IF;
  FOR r IN
    SELECT s.satir_id, s.talep_id, s.hat_id, h.ad AS hat_adi,
           s.asama_basladi_bildirildi AS b, s.asama_tamamlandi_bildirildi AS t
    FROM public.talimat_satirlar s
    JOIN public.talimat_hatlar h ON h.hat_id = s.hat_id
    JOIN public.talepler tp ON tp.talep_id = s.talep_id
    WHERE s.talep_id IS NOT NULL AND tp.kapanis IS NULL AND s.sku = p_sku
      AND (s.satir_id = p_satir OR (p_hat IS NOT NULL AND s.hat_id = p_hat))
  LOOP
    v_bitti := false;
    IF p_tamamlandi AND NOT r.t THEN
      SELECT i.tamamlandi_mi INTO v_bitti FROM public.talimat_satir_ilerleme i WHERE i.satir_id = r.satir_id;
      v_bitti := COALESCE(v_bitti, false);
    END IF;

    IF v_bitti THEN
      PERFORM public.talep_asama_bildirim_ic(r.talep_id, r.hat_id, r.hat_adi, 'tamamlandi');
      UPDATE public.talimat_satirlar
      SET asama_basladi_bildirildi = true, asama_tamamlandi_bildirildi = true
      WHERE satir_id = r.satir_id;
    ELSIF NOT r.b THEN
      PERFORM public.talep_asama_bildirim_ic(r.talep_id, r.hat_id, r.hat_adi, 'basladi');
      UPDATE public.talimat_satirlar SET asama_basladi_bildirildi = true WHERE satir_id = r.satir_id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.talep_asama_trg_montaj()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.talep_asama_isle_ic(
      NEW.sku, NEW.hat_id, NEW.talimat_satir_id,
      NEW.durum = 'tamamlandi' AND COALESCE(NEW.is_final_step, false));
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'talep aşama bildirimi (montaj) başarısız: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.talep_asama_trg_pack()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  BEGIN
    PERFORM public.talep_asama_isle_ic(NEW.sku, NEW.hat_id, NEW.talimat_satir_id, NEW.durum = 'tamamlandi');
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'talep aşama bildirimi (paketleme) başarısız: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_montaj_talep_asama ON public.montaj_sessions;
CREATE TRIGGER trg_montaj_talep_asama
  AFTER INSERT OR UPDATE OF durum, qty ON public.montaj_sessions
  FOR EACH ROW WHEN (NEW.hat_id IS NOT NULL OR NEW.talimat_satir_id IS NOT NULL)
  EXECUTE FUNCTION public.talep_asama_trg_montaj();

DROP TRIGGER IF EXISTS trg_pack_talep_asama ON public.pack_events;
CREATE TRIGGER trg_pack_talep_asama
  AFTER INSERT OR UPDATE OF durum, qty ON public.pack_events
  FOR EACH ROW WHEN (NEW.hat_id IS NOT NULL OR NEW.talimat_satir_id IS NOT NULL)
  EXECUTE FUNCTION public.talep_asama_trg_pack();

-- ── 8) Zamanlayıcı (134 + hat bazlı bildirim/hatırlatma/rapor) ─
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
  v_adlar     TEXT;
  v_liste     JSONB;
  v_say       INTEGER;
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

  -- 3) Zamanı gelen planlı gönderimler (personel + hat hedefleri)
  FOR r IN
    SELECT y.yayin_id FROM public.talimat_yayinlar y
    JOIN public.talimat_planlar p ON p.plan_id = y.plan_id
    WHERE y.durum = 'beklemede' AND y.bildirim_gonder AND y.gonderim_zamani <= now()
      AND p.durum <> 'pasif'
  LOOP
    PERFORM public.talimat_bildirim_gonder_ic(r.yayin_id, false, NULL);
    PERFORM public.talimat_bildirim_gonder_hat_ic(r.yayin_id, false, NULL);
    UPDATE public.talimat_yayinlar SET durum = 'gonderildi', ilk_gonderim_at = now() WHERE yayin_id = r.yayin_id;
    v_gonder_n := v_gonder_n + 1;
  END LOOP;

  -- 4a) Hatırlatmalar (eski personel hedefleri)
  FOR r IN
    SELECT y.yayin_id,
           array_agg(h.personel_id) AS personeller
    FROM public.talimat_yayinlar y
    JOIN public.talimat_yayin_hedefler h ON h.yayin_id = y.yayin_id AND h.hat_id IS NULL
    WHERE y.durum = 'gonderildi' AND y.bildirim_gonder
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                      WHERE o.yayin_id = h.yayin_id AND o.hat_id IS NULL AND o.personel_id = h.personel_id)
      AND COALESCE(h.son_bildirim_at, y.ilk_gonderim_at, y.gonderim_zamani)
            <= now() - make_interval(mins => v_hatirlat)
    GROUP BY y.yayin_id
  LOOP
    v_hatirlat_n := v_hatirlat_n + public.talimat_bildirim_gonder_ic(r.yayin_id, true, r.personeller);
  END LOOP;

  -- 4b) Hatırlatmalar (hat hedefleri): onaylamayan her hata, son bildirimden hatirlatma_dakika sonra
  FOR r IN
    SELECT y.yayin_id,
           array_agg(h.hat_id) AS hatlar
    FROM public.talimat_yayinlar y
    JOIN public.talimat_yayin_hedefler h ON h.yayin_id = y.yayin_id AND h.hat_id IS NOT NULL
    WHERE y.durum = 'gonderildi' AND y.bildirim_gonder
      AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                      WHERE o.yayin_id = h.yayin_id AND o.hat_id = h.hat_id)
      AND COALESCE(h.son_bildirim_at, y.ilk_gonderim_at, y.gonderim_zamani)
            <= now() - make_interval(mins => v_hatirlat)
    GROUP BY y.yayin_id
  LOOP
    v_hatirlat_n := v_hatirlat_n + public.talimat_bildirim_gonder_hat_ic(r.yayin_id, true, r.hatlar);
  END LOOP;

  -- 5) Planlayıcıya özet: ilk gönderimden rapor_dakika sonra, hâlâ onaylamayan (hat veya personel) varsa (bir kez)
  FOR r IN
    SELECT y.yayin_id, y.plan_id, COALESCE(y.yayinlayan, p.olusturan) AS alici, p.hafta_baslangic
    FROM public.talimat_yayinlar y
    JOIN public.talimat_planlar p ON p.plan_id = y.plan_id
    WHERE y.durum = 'gonderildi' AND y.bildirim_gonder AND y.rapor_gonderildi_at IS NULL
      AND y.ilk_gonderim_at <= now() - make_interval(mins => v_rapor)
  LOOP
    SELECT string_agg(x.ad, ', ' ORDER BY x.ad), jsonb_agg(x.j ORDER BY x.ad), count(*)::integer
      INTO v_adlar, v_liste, v_say
    FROM (
      SELECT u.full_name AS ad, jsonb_build_object('personel_id', u.user_id, 'ad', u.full_name) AS j
      FROM public.talimat_yayin_hedefler h
      JOIN public.users u ON u.user_id = h.personel_id
      WHERE h.yayin_id = r.yayin_id AND h.hat_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id AND o.hat_id IS NULL AND o.personel_id = h.personel_id)
      UNION ALL
      SELECT ht.ad, jsonb_build_object('hat_id', ht.hat_id, 'ad', ht.ad)
      FROM public.talimat_yayin_hedefler h
      JOIN public.talimat_hatlar ht ON ht.hat_id = h.hat_id
      WHERE h.yayin_id = r.yayin_id
        AND NOT EXISTS (SELECT 1 FROM public.talimat_onaylar o
                        WHERE o.yayin_id = h.yayin_id AND o.hat_id = h.hat_id)
    ) x;

    UPDATE public.talimat_yayinlar SET rapor_gonderildi_at = now() WHERE yayin_id = r.yayin_id;

    IF v_liste IS NOT NULL AND r.alici IS NOT NULL THEN
      INSERT INTO public.notifications
        (notif_id, title, message, target_user, status, created_by, kind, payload, sesli, yayin_id)
      VALUES (
        'TLR-' || to_char(clock_timestamp() AT TIME ZONE 'Europe/Istanbul', 'YYYYMMDDHH24MISSMS')
          || '-' || r.alici || '-' || substr(md5(random()::text), 1, 4),
        'İş talimatını henüz onaylamayan hat/personel var',
        v_say || ' kayıt ' || v_rapor || ' dakikadır onaylamadı: ' || v_adlar,
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
  'İş talimatı zamanlayıcısı (hat bazlı): otomatik pasif, Pazartesi bildirimi, planlı gönderim, hatırlatma, planlayıcı raporu. pg_cron her dakika çağırır.';

-- ── 9) Yetkiler ───────────────────────────────────────────────
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'talimat_onayla(uuid,text,boolean,uuid)',
    'talimat_tablet_plan_hat()',
    'talep_talimata_ata(uuid,uuid[],numeric,integer,boolean,uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'talimat_yayin_onaysiz_var(uuid)',
    'talimat_onay_bekliyor_temizle_hat(uuid,uuid[])',
    'talimat_bildirim_gonder_hat_ic(uuid,boolean,uuid[])',
    'talimat_yayinla_ic(uuid,boolean,timestamptz,boolean,text,text,boolean)',
    'talep_asama_bildirim_ic(uuid,uuid,text,text)',
    'talep_asama_isle_ic(text,uuid,uuid,boolean)',
    'talep_asama_trg_montaj()',
    'talep_asama_trg_pack()',
    'talimat_zamanlayici()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
