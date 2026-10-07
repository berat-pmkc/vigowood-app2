-- =============================================================
-- 133: Talep RPC'leri
--
-- Kurallar:
--  * Talebi ofis rolleri açar (is_office_user). Düzenleme/geri çekme/silme: talebi açan
--    veya planlayıcı (is_admin_or_engineer).
--  * Açanın ilk 10 dakikası "serbest": düzenleme/geri çekme/silme kayıt bırakmaz.
--    10 dakikadan sonra yapılan değişiklikler talep_revizyonlar'a yazılır ve bağlı
--    talimat satırları degisti=true (kırmızı) olur.
--  * Durumlar talep_durum görünümünde türetilir (131).
--  * Talimat satırlarının pasife alınmasında neden "Talep: ..." öneklidir; talep_yeniden_ac
--    bu önekli satırları tekrar aktifleştirir.
-- =============================================================

-- Bağlı (pasif olmayan plandaki) aktif satırları pasife al
CREATE OR REPLACE FUNCTION public.talep_satirlari_pasifle_ic(p_talep UUID, p_neden TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER;
BEGIN
  UPDATE public.talimat_satirlar s
  SET durum = 'pasif', pasif_neden = p_neden, pasif_baslangic = public.talimat_bugun(),
      pasif_until = NULL, degisti = s.degisti OR (pl.durum = 'yayinda')
  FROM public.talimat_planlar pl
  WHERE pl.plan_id = s.plan_id AND pl.durum <> 'pasif'
    AND s.talep_id = p_talep AND s.durum <> 'pasif';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

-- ── Oluştur ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.talep_olustur(
  p_sku TEXT, p_hedef_depo TEXT, p_miktar NUMERIC, p_termin DATE, p_aciklama TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid TEXT := public.talimat_kullanici_id();
  v_id UUID;
BEGIN
  IF NOT public.is_office_user() OR v_uid IS NULL THEN
    RAISE EXCEPTION 'Talep açma yetkiniz yok' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE sku = p_sku) THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', p_sku;
  END IF;
  IF p_hedef_depo IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.depolar WHERE depo_id = p_hedef_depo AND aktif) THEN
    RAISE EXCEPTION 'Geçersiz hedef depo: %', p_hedef_depo;
  END IF;
  IF p_miktar IS NOT NULL AND p_miktar <= 0 THEN
    RAISE EXCEPTION 'İstenen miktar sıfırdan büyük olmalı';
  END IF;

  INSERT INTO public.talepler (sku, hedef_depo_id, istenen_miktar, termin_tarihi, aciklama, olusturan)
  VALUES (p_sku, NULLIF(p_hedef_depo, ''), p_miktar, p_termin, NULLIF(btrim(p_aciklama), ''), v_uid)
  RETURNING talep_id INTO v_id;
  RETURN v_id;
END;
$$;

-- ── Güncelle ──────────────────────────────────────────────────
-- p (jsonb): sku, hedef_depo_id, istenen_miktar, termin_tarihi, aciklama (yalnızca gelen anahtarlar değişir).
-- p_bildirim=true ve çağıran planlayıcıysa: bağlı satırların bulunduğu yayındaki planlar
-- bildirimli (sesli) yayınlanır. Planlayıcı değilse bayraklar kalır, planlayıcı yayınlar.
-- Bağlı satırlarda not/miktar, talebin eski değerine eşitse otomatik yeni değere çekilir.
CREATE OR REPLACE FUNCTION public.talep_guncelle(p_talep UUID, p JSONB, p_bildirim BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t        public.talepler%ROWTYPE;
  v_uid      TEXT := public.talimat_kullanici_id();
  v_creator  BOOLEAN;
  v_planner  BOOLEAN := public.is_admin_or_engineer();
  v_serbest  BOOLEAN;
  v_sku      TEXT;
  v_depo     TEXT;
  v_miktar   NUMERIC;
  v_termin   DATE;
  v_acik     TEXT;
  v_diff     JSONB := '{}'::jsonb;
  v_bagli    INTEGER;
  v_yayinlar UUID[] := '{}';
  r          RECORD;
BEGIN
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  v_creator := v_t.olusturan = v_uid AND public.is_office_user();
  IF NOT (v_creator OR v_planner) THEN
    RAISE EXCEPTION 'Bu talebi düzenleme yetkiniz yok' USING ERRCODE = '42501';
  END IF;
  IF v_t.kapanis IS NOT NULL THEN RAISE EXCEPTION 'Kapanmış talep düzenlenemez'; END IF;

  v_serbest := v_creator AND now() <= v_t.created_at + interval '10 minutes';
  SELECT count(*) INTO v_bagli FROM public.talimat_satirlar WHERE talep_id = p_talep;

  v_sku    := CASE WHEN p ? 'sku' THEN NULLIF(p ->> 'sku', '') ELSE v_t.sku END;
  v_depo   := CASE WHEN p ? 'hedef_depo_id' THEN NULLIF(p ->> 'hedef_depo_id', '') ELSE v_t.hedef_depo_id END;
  v_miktar := CASE WHEN p ? 'istenen_miktar' THEN NULLIF(p ->> 'istenen_miktar', '')::numeric ELSE v_t.istenen_miktar END;
  v_termin := CASE WHEN p ? 'termin_tarihi' THEN NULLIF(p ->> 'termin_tarihi', '')::date ELSE v_t.termin_tarihi END;
  v_acik   := CASE WHEN p ? 'aciklama' THEN NULLIF(btrim(p ->> 'aciklama'), '') ELSE v_t.aciklama END;

  IF v_sku IS NULL THEN RAISE EXCEPTION 'Ürün seçilmeli'; END IF;
  IF v_sku IS DISTINCT FROM v_t.sku THEN
    IF v_bagli > 0 THEN RAISE EXCEPTION 'İş talimatına bağlı talebin ürünü değiştirilemez'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku) THEN
      RAISE EXCEPTION 'Ürün bulunamadı: %', v_sku;
    END IF;
  END IF;
  IF v_depo IS NOT NULL AND v_depo IS DISTINCT FROM v_t.hedef_depo_id
     AND NOT EXISTS (SELECT 1 FROM public.depolar WHERE depo_id = v_depo AND aktif) THEN
    RAISE EXCEPTION 'Geçersiz hedef depo: %', v_depo;
  END IF;
  IF v_miktar IS NOT NULL AND v_miktar <= 0 THEN RAISE EXCEPTION 'İstenen miktar sıfırdan büyük olmalı'; END IF;

  IF v_sku IS DISTINCT FROM v_t.sku THEN
    v_diff := v_diff || jsonb_build_object('sku', jsonb_build_object('eski', v_t.sku, 'yeni', v_sku)); END IF;
  IF v_depo IS DISTINCT FROM v_t.hedef_depo_id THEN
    v_diff := v_diff || jsonb_build_object('hedef_depo_id', jsonb_build_object('eski', v_t.hedef_depo_id, 'yeni', v_depo)); END IF;
  IF v_miktar IS DISTINCT FROM v_t.istenen_miktar THEN
    v_diff := v_diff || jsonb_build_object('istenen_miktar', jsonb_build_object('eski', v_t.istenen_miktar, 'yeni', v_miktar)); END IF;
  IF v_termin IS DISTINCT FROM v_t.termin_tarihi THEN
    v_diff := v_diff || jsonb_build_object('termin_tarihi', jsonb_build_object('eski', v_t.termin_tarihi, 'yeni', v_termin)); END IF;
  IF v_acik IS DISTINCT FROM v_t.aciklama THEN
    v_diff := v_diff || jsonb_build_object('aciklama', jsonb_build_object('eski', v_t.aciklama, 'yeni', v_acik)); END IF;

  IF v_diff = '{}'::jsonb THEN
    RETURN jsonb_build_object('degisti', false, 'serbest', v_serbest, 'etkilenen_satir', 0, 'yayin_idler', '[]'::jsonb);
  END IF;

  UPDATE public.talepler
  SET sku = v_sku, hedef_depo_id = v_depo, istenen_miktar = v_miktar,
      termin_tarihi = v_termin, aciklama = v_acik
  WHERE talep_id = p_talep;

  IF NOT v_serbest THEN
    INSERT INTO public.talep_revizyonlar (talep_id, yapan, islem, degisiklikler)
    VALUES (p_talep, v_uid, 'guncelle', v_diff);
  END IF;

  IF v_bagli > 0 THEN
    UPDATE public.talimat_satirlar s
    SET not_text = CASE WHEN v_diff ? 'aciklama' AND s.not_text IS NOT DISTINCT FROM v_t.aciklama
                        THEN v_acik ELSE s.not_text END,
        istenen_miktar = CASE WHEN v_diff ? 'istenen_miktar' AND s.istenen_miktar IS NOT DISTINCT FROM v_t.istenen_miktar
                              THEN v_miktar ELSE s.istenen_miktar END,
        degisti = s.degisti OR (pl.durum = 'yayinda')
    FROM public.talimat_planlar pl
    WHERE pl.plan_id = s.plan_id AND pl.durum <> 'pasif' AND s.talep_id = p_talep;

    IF p_bildirim AND v_planner THEN
      FOR r IN
        SELECT DISTINCT s.plan_id
        FROM public.talimat_satirlar s
        JOIN public.talimat_planlar pl ON pl.plan_id = s.plan_id
        WHERE s.talep_id = p_talep AND pl.durum = 'yayinda' AND s.degisti
      LOOP
        v_yayinlar := array_append(v_yayinlar,
          (public.talimat_yayinla_ic(r.plan_id, true, now(), true, 'degisenler', v_uid, false) ->> 'yayin_id')::uuid);
      END LOOP;
    END IF;
  END IF;

  RETURN jsonb_build_object('degisti', true, 'serbest', v_serbest, 'etkilenen_satir', v_bagli,
                            'yayin_idler', to_jsonb(v_yayinlar));
END;
$$;

-- ── Geri çek ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.talep_geri_cek(p_talep UUID, p_neden TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t       public.talepler%ROWTYPE;
  v_uid     TEXT := public.talimat_kullanici_id();
  v_creator BOOLEAN;
  v_serbest BOOLEAN;
BEGIN
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  v_creator := v_t.olusturan = v_uid AND public.is_office_user();
  IF NOT (v_creator OR public.is_admin_or_engineer()) THEN
    RAISE EXCEPTION 'Bu talebi geri çekme yetkiniz yok' USING ERRCODE = '42501';
  END IF;
  IF v_t.kapanis IS NOT NULL THEN RAISE EXCEPTION 'Talep zaten kapalı'; END IF;
  v_serbest := v_creator AND now() <= v_t.created_at + interval '10 minutes';

  UPDATE public.talepler
  SET kapanis = 'geri_cekildi', kapanis_neden = NULLIF(btrim(p_neden), ''), kapanis_at = now(), kapatan = v_uid
  WHERE talep_id = p_talep;

  IF NOT v_serbest THEN
    INSERT INTO public.talep_revizyonlar (talep_id, yapan, islem, neden)
    VALUES (p_talep, v_uid, 'geri_cek', NULLIF(btrim(p_neden), ''));
  END IF;
  PERFORM public.talep_satirlari_pasifle_ic(p_talep, 'Talep: geri çekildi');
END;
$$;

-- ── Sil ───────────────────────────────────────────────────────
-- Açan yalnızca ilk 10 dakikada; planlayıcı her zaman. Talimata bağlı talep silinemez (geri çekin).
CREATE OR REPLACE FUNCTION public.talep_sil(p_talep UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t   public.talepler%ROWTYPE;
  v_uid TEXT := public.talimat_kullanici_id();
BEGIN
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  IF NOT (public.is_admin_or_engineer()
          OR (v_t.olusturan = v_uid AND public.is_office_user()
              AND now() <= v_t.created_at + interval '10 minutes')) THEN
    RAISE EXCEPTION 'Talep yalnızca açıldıktan sonraki ilk 10 dakikada silinebilir' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.talimat_satirlar WHERE talep_id = p_talep) THEN
    RAISE EXCEPTION 'İş talimatına bağlı talep silinemez, geri çekin';
  END IF;
  DELETE FROM public.talepler WHERE talep_id = p_talep;
END;
$$;

-- ── Kapat ('tamamlandi' | 'tamamlanmadi') ─────────────────────
CREATE OR REPLACE FUNCTION public.talep_kapat(p_talep UUID, p_durum TEXT, p_neden TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t   public.talepler%ROWTYPE;
  v_uid TEXT := public.talimat_kullanici_id();
BEGIN
  IF p_durum NOT IN ('tamamlandi', 'tamamlanmadi') THEN
    RAISE EXCEPTION 'Geçersiz kapanış durumu: % (tamamlandi|tamamlanmadi)', p_durum;
  END IF;
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  IF NOT ((v_t.olusturan = v_uid AND public.is_office_user()) OR public.is_admin_or_engineer()) THEN
    RAISE EXCEPTION 'Bu talebi kapatma yetkiniz yok' USING ERRCODE = '42501';
  END IF;
  IF v_t.kapanis IS NOT NULL THEN RAISE EXCEPTION 'Talep zaten kapalı'; END IF;

  UPDATE public.talepler
  SET kapanis = p_durum, kapanis_neden = NULLIF(btrim(p_neden), ''), kapanis_at = now(), kapatan = v_uid
  WHERE talep_id = p_talep;

  INSERT INTO public.talep_revizyonlar (talep_id, yapan, islem, degisiklikler, neden)
  VALUES (p_talep, v_uid, 'kapat', jsonb_build_object('kapanis', jsonb_build_object('eski', NULL::text, 'yeni', p_durum)),
          NULLIF(btrim(p_neden), ''));

  IF p_durum = 'tamamlandi' THEN
    UPDATE public.talimat_satirlar s SET durum = 'tamamlandi'
    FROM public.talimat_planlar pl
    WHERE pl.plan_id = s.plan_id AND pl.durum <> 'pasif' AND s.talep_id = p_talep AND s.durum = 'aktif';
  ELSE
    PERFORM public.talep_satirlari_pasifle_ic(p_talep, 'Talep: tamamlanmadı olarak kapatıldı');
  END IF;
END;
$$;

-- ── Stokta mevcut (yalnızca planlayıcı) ───────────────────────
CREATE OR REPLACE FUNCTION public.talep_stokta_mevcut(p_talep UUID, p_neden TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t   public.talepler%ROWTYPE;
  v_uid TEXT := public.talimat_kullanici_id();
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  IF v_t.kapanis IS NOT NULL THEN RAISE EXCEPTION 'Talep zaten kapalı'; END IF;

  UPDATE public.talepler
  SET kapanis = 'stokta_mevcut', kapanis_neden = NULLIF(btrim(p_neden), ''), kapanis_at = now(), kapatan = v_uid
  WHERE talep_id = p_talep;

  INSERT INTO public.talep_revizyonlar (talep_id, yapan, islem, neden)
  VALUES (p_talep, v_uid, 'stokta_mevcut', NULLIF(btrim(p_neden), ''));
  PERFORM public.talep_satirlari_pasifle_ic(p_talep, 'Talep: stokta mevcut');
END;
$$;

-- ── Yeniden aç (açan veya planlayıcı) ─────────────────────────
CREATE OR REPLACE FUNCTION public.talep_yeniden_ac(p_talep UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t   public.talepler%ROWTYPE;
  v_uid TEXT := public.talimat_kullanici_id();
BEGIN
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  IF NOT ((v_t.olusturan = v_uid AND public.is_office_user()) OR public.is_admin_or_engineer()) THEN
    RAISE EXCEPTION 'Bu talebi yeniden açma yetkiniz yok' USING ERRCODE = '42501';
  END IF;
  IF v_t.kapanis IS NULL THEN RAISE EXCEPTION 'Talep zaten açık'; END IF;

  UPDATE public.talepler
  SET kapanis = NULL, kapanis_neden = NULL, kapanis_at = NULL, kapatan = NULL
  WHERE talep_id = p_talep;

  INSERT INTO public.talep_revizyonlar (talep_id, yapan, islem, degisiklikler)
  VALUES (p_talep, v_uid, 'yeniden_ac',
          jsonb_build_object('kapanis', jsonb_build_object('eski', v_t.kapanis, 'yeni', NULL::text)));

  UPDATE public.talimat_satirlar s
  SET durum = 'aktif', pasif_neden = NULL, pasif_baslangic = NULL, pasif_until = NULL,
      degisti = s.degisti OR (pl.durum = 'yayinda')
  FROM public.talimat_planlar pl
  WHERE pl.plan_id = s.plan_id AND pl.durum <> 'pasif' AND s.talep_id = p_talep
    AND ((s.durum = 'pasif' AND s.pasif_neden LIKE 'Talep:%') OR (s.durum = 'tamamlandi' AND v_t.kapanis = 'tamamlandi'));
END;
$$;

-- ── Talebi iş talimatına ata (planlayıcı) ─────────────────────
-- p_sira NULL = personelin ilk boş sırası (listenin sonu). Sıra doluysa: p_kaydir=true araya girer
-- (diğerleri aşağı kayar), değilse SIRA_DOLU hatası (arayüz önce talimat_satirlar'dan dolu satırı gösterir).
-- p_miktar NULL ise talebin istenen miktarı kullanılır. Talebin açıklaması satırın notuna kopyalanır.
-- p_plan NULL ise bu haftanın yayındaki planı, yoksa bu hafta/sonrası en yakın taslak plan.
CREATE OR REPLACE FUNCTION public.talep_talimata_ata(
  p_talep UUID, p_personel TEXT, p_sira INTEGER DEFAULT NULL, p_miktar NUMERIC DEFAULT NULL,
  p_istasyon TEXT DEFAULT NULL, p_kaydir BOOLEAN DEFAULT false, p_plan UUID DEFAULT NULL,
  p_plaka TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_t    public.talepler%ROWTYPE;
  v_plan UUID := p_plan;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_t FROM public.talepler WHERE talep_id = p_talep;
  IF NOT FOUND THEN RAISE EXCEPTION 'Talep bulunamadı'; END IF;
  IF v_t.kapanis IS NOT NULL THEN RAISE EXCEPTION 'Kapalı talep iş talimatına atanamaz'; END IF;

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

  RETURN public.talimat_satir_kaydet(jsonb_build_object(
    'plan_id', v_plan,
    'personel_id', p_personel,
    'sira', p_sira,
    'kaydir', COALESCE(p_kaydir, false),
    'istasyon', p_istasyon,
    'sku', v_t.sku,
    'plaka_id', p_plaka,
    'istenen_miktar', COALESCE(p_miktar, v_t.istenen_miktar),
    'not_text', v_t.aciklama,
    'talep_id', p_talep));
END;
$$;

-- ── Yetkiler ──────────────────────────────────────────────────
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'talep_olustur(text,text,numeric,date,text)',
    'talep_guncelle(uuid,jsonb,boolean)',
    'talep_geri_cek(uuid,text)',
    'talep_sil(uuid)',
    'talep_kapat(uuid,text,text)',
    'talep_stokta_mevcut(uuid,text)',
    'talep_yeniden_ac(uuid)',
    'talep_talimata_ata(uuid,text,integer,numeric,text,boolean,uuid,text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;
  REVOKE ALL ON FUNCTION public.talep_satirlari_pasifle_ic(uuid,text) FROM PUBLIC, anon, authenticated;
END $$;
