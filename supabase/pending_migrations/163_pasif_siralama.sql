-- 163: Hat satırı pasif olunca hattın en altına; yeniden aktif olunca aktiflerin sonuna.
-- Sıra anahtarı: (durum='pasif'), sonra (yeni aktif / yeni pasif -> kendi bloğunun sonu), sonra mevcut sira.
-- (plan_id, hat_id, sira) UNIQUE kısıtı DEFERRABLE INITIALLY DEFERRED: tek UPDATE ile yeniden numaralanır.
-- Boş (ürünsüz) ve tamamlandı satırlar aktif blokta kalır. Eski personel satırları (hat_id NULL) değişmez.

CREATE OR REPLACE FUNCTION public.talimat_hat_yeniden_sirala(
  p_plan UUID, p_hat UUID, p_son_pasif UUID[] DEFAULT '{}', p_son_aktif UUID[] DEFAULT '{}'
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yayinda BOOLEAN;
BEGIN
  IF p_hat IS NULL THEN RETURN; END IF;
  SELECT durum = 'yayinda' INTO v_yayinda FROM public.talimat_planlar WHERE plan_id = p_plan;

  WITH sirali AS (
    SELECT satir_id,
           row_number() OVER (
             ORDER BY (durum = 'pasif'),
                      CASE WHEN durum <> 'pasif' AND satir_id = ANY (COALESCE(p_son_aktif, '{}')) THEN 1
                           WHEN durum = 'pasif' AND satir_id = ANY (COALESCE(p_son_pasif, '{}')) THEN 1
                           ELSE 0 END,
                      sira, created_at
           ) AS yeni
    FROM public.talimat_satirlar
    WHERE plan_id = p_plan AND hat_id = p_hat
  )
  UPDATE public.talimat_satirlar s
  SET sira = sirali.yeni,
      degisti = s.degisti OR (COALESCE(v_yayinda, false) AND s.sira <> sirali.yeni
                              AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL))
  FROM sirali
  WHERE s.satir_id = sirali.satir_id AND s.sira <> sirali.yeni;
END;
$$;
REVOKE ALL ON FUNCTION public.talimat_hat_yeniden_sirala(UUID, UUID, UUID[], UUID[]) FROM PUBLIC, anon, authenticated;

-- Verilen satırların hatlarını bulup her hat için yeniden sıralar (p_pasif: satırlar yeni pasif mi, yeni aktif mi)
CREATE OR REPLACE FUNCTION public.talimat_hat_yeniden_sirala_satirlar(p_plan UUID, p_ids UUID[], p_pasif BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hat UUID;
  v_k UUID[];
BEGIN
  FOR v_hat IN SELECT DISTINCT hat_id FROM public.talimat_satirlar
               WHERE plan_id = p_plan AND satir_id = ANY (p_ids) AND hat_id IS NOT NULL LOOP
    SELECT COALESCE(array_agg(satir_id), '{}') INTO v_k FROM public.talimat_satirlar
    WHERE plan_id = p_plan AND hat_id = v_hat AND satir_id = ANY (p_ids);
    IF p_pasif THEN
      PERFORM public.talimat_hat_yeniden_sirala(p_plan, v_hat, v_k, '{}');
    ELSE
      PERFORM public.talimat_hat_yeniden_sirala(p_plan, v_hat, '{}', v_k);
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.talimat_hat_yeniden_sirala_satirlar(UUID, UUID[], BOOLEAN) FROM PUBLIC, anon, authenticated;

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
  v_yeni_pasif UUID[] := '{}';
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;
  IF p_bitis IS NOT NULL AND p_bitis < v_bas THEN RAISE EXCEPTION 'Bitiş tarihi başlangıçtan önce olamaz'; END IF;

  IF p_kapsam = 'satir' THEN
    -- Şimdiye dek pasif olmayanlar: hattın en altına gidecek (163)
    SELECT COALESCE(array_agg(satir_id), '{}') INTO v_yeni_pasif FROM public.talimat_satirlar
    WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]) AND hat_id IS NOT NULL AND durum <> 'pasif';
    UPDATE public.talimat_satirlar
    SET durum = 'pasif', pasif_neden = NULLIF(btrim(p_neden), ''), pasif_baslangic = v_bas,
        pasif_until = p_bitis, degisti = degisti OR (v_plan.durum = 'yayinda')
    WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    PERFORM public.talimat_hat_yeniden_sirala_satirlar(p_plan, v_yeni_pasif, true);
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
  v_aktif UUID[] := '{}';
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT durum = 'yayinda' INTO v_yayinda FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF v_yayinda IS NULL THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;

  IF p_kapsam = 'satir' THEN
    WITH u AS (
      UPDATE public.talimat_satirlar
      SET durum = 'aktif', pasif_neden = NULL, pasif_baslangic = NULL, pasif_until = NULL,
          degisti = degisti OR v_yayinda
      WHERE plan_id = p_plan AND satir_id = ANY (p_ids::uuid[]) AND durum = 'pasif'
      RETURNING satir_id
    )
    SELECT COALESCE(array_agg(satir_id), '{}'), count(*) INTO v_aktif, v_n FROM u;
    -- Yeniden aktif olanlar aktiflerin sonuna (163)
    PERFORM public.talimat_hat_yeniden_sirala_satirlar(p_plan, v_aktif, false);
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

CREATE OR REPLACE FUNCTION public.talimat_satir_kaydet(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id          UUID := NULLIF(p ->> 'satir_id', '')::uuid;
  v_eski        public.talimat_satirlar%ROWTYPE;
  v_plan        public.talimat_planlar%ROWTYPE;
  v_plan_id     UUID;
  v_hat         UUID;
  v_hat_tur     TEXT;
  v_personel    TEXT;
  v_sku         TEXT;
  v_plaka       TEXT;
  v_ist         TEXT;
  v_miktar      NUMERIC;
  v_not         TEXT;
  v_talep       UUID;
  v_durum       TEXT;
  v_pneden      TEXT;
  v_pbas        DATE;
  v_puntil      DATE;
  v_sira        INTEGER := NULLIF(p ->> 'sira', '')::integer;
  v_kaydir      BOOLEAN := COALESCE((p ->> 'kaydir')::boolean, false);
  v_yayinda     BOOLEAN;
  v_degisti     BOOLEAN := false;
  v_n           INTEGER;
  v_grup_degisti BOOLEAN := false;
  v_bos         BOOLEAN;
  v_eski_bos    BOOLEAN := true;
  v_yeni        BOOLEAN := false;
BEGIN
  PERFORM public.talimat_yetki_planlayici();

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_eski FROM public.talimat_satirlar WHERE satir_id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Satır bulunamadı'; END IF;
    v_plan_id := v_eski.plan_id;
  ELSE
    v_plan_id := NULLIF(p ->> 'plan_id', '')::uuid;
    IF v_plan_id IS NULL THEN RAISE EXCEPTION 'plan_id gerekli'; END IF;
  END IF;

  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = v_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;
  v_yayinda := v_plan.durum = 'yayinda';

  -- Alan değerleri (anahtar varsa yeni değer, yoksa eski)
  v_hat      := CASE WHEN p ? 'hat_id' THEN NULLIF(p ->> 'hat_id', '')::uuid ELSE v_eski.hat_id END;
  v_personel := CASE WHEN v_hat IS NOT NULL THEN NULL
                     WHEN p ? 'personel_id' THEN NULLIF(p ->> 'personel_id', '')
                     ELSE v_eski.personel_id END;
  v_sku      := CASE WHEN p ? 'sku'         THEN NULLIF(p ->> 'sku', '')         ELSE v_eski.sku END;
  v_plaka    := CASE WHEN p ? 'plaka_id'    THEN NULLIF(p ->> 'plaka_id', '')    ELSE v_eski.plaka_id END;
  v_ist      := CASE WHEN p ? 'istasyon'    THEN NULLIF(p ->> 'istasyon', '')    ELSE v_eski.istasyon END;
  v_miktar   := CASE WHEN p ? 'istenen_miktar' THEN NULLIF(p ->> 'istenen_miktar', '')::numeric ELSE v_eski.istenen_miktar END;
  v_not      := CASE WHEN p ? 'not_text'    THEN NULLIF(btrim(p ->> 'not_text'), '') ELSE v_eski.not_text END;
  v_talep    := CASE WHEN p ? 'talep_id'    THEN NULLIF(p ->> 'talep_id', '')::uuid ELSE v_eski.talep_id END;
  v_durum    := CASE WHEN p ? 'durum'       THEN COALESCE(NULLIF(p ->> 'durum', ''), 'aktif') ELSE COALESCE(v_eski.durum, 'aktif') END;

  IF v_hat IS NULL AND v_personel IS NULL THEN RAISE EXCEPTION 'Hat veya personel seçilmeli'; END IF;

  IF v_hat IS NOT NULL THEN
    SELECT tur INTO v_hat_tur FROM public.talimat_hatlar
    WHERE hat_id = v_hat AND (aktif OR v_hat IS NOT DISTINCT FROM v_eski.hat_id);
    IF v_hat_tur IS NULL THEN RAISE EXCEPTION 'Hat bulunamadı veya pasif'; END IF;
    v_ist := v_hat_tur;          -- istasyon hattın türünden
    v_plaka := NULL;             -- hat satırlarında plaka yok (kesim hattı yok)
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = v_personel AND is_active = true AND role::text IN ('Üretim', 'Hat')
    ) THEN
      RAISE EXCEPTION 'Geçersiz personel: % (yalnızca aktif Üretim/Hat personeli)', v_personel;
    END IF;
  END IF;

  IF v_plaka IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.plakalar WHERE plaka_id = v_plaka) THEN
      RAISE EXCEPTION 'Plaka bulunamadı: %', v_plaka;
    END IF;
    IF v_sku IS NULL THEN
      SELECT sku[1] INTO v_sku FROM public.plakalar
      WHERE plaka_id = v_plaka AND sku IS NOT NULL AND cardinality(sku) = 1 LIMIT 1;
    END IF;
  END IF;
  -- Ürün/plaka zorunlu değil: ürünsüz (boş) satır geçerlidir (ürün sonra seçilir)
  IF v_sku IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku) THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', v_sku;
  END IF;
  v_bos := v_sku IS NULL AND v_plaka IS NULL;
  IF v_id IS NOT NULL THEN v_eski_bos := v_eski.sku IS NULL AND v_eski.plaka_id IS NULL; END IF;
  IF v_ist IS NOT NULL AND v_ist NOT IN ('kesim', 'montaj', 'paketleme') THEN
    RAISE EXCEPTION 'Geçersiz istasyon: %', v_ist;
  END IF;
  IF v_miktar IS NOT NULL AND v_miktar <= 0 THEN RAISE EXCEPTION 'İstenen miktar sıfırdan büyük olmalı'; END IF;
  IF v_durum NOT IN ('aktif', 'pasif', 'tamamlandi') THEN RAISE EXCEPTION 'Geçersiz durum: %', v_durum; END IF;
  IF v_talep IS NOT NULL AND v_talep IS DISTINCT FROM v_eski.talep_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.talepler WHERE talep_id = v_talep AND kapanis IS NULL) THEN
      RAISE EXCEPTION 'Talep bulunamadı veya kapalı';
    END IF;
  END IF;

  IF v_durum = 'pasif' THEN
    v_pneden := CASE WHEN p ? 'pasif_neden'     THEN NULLIF(p ->> 'pasif_neden', '')          ELSE v_eski.pasif_neden END;
    v_pbas   := CASE WHEN p ? 'pasif_baslangic' THEN NULLIF(p ->> 'pasif_baslangic', '')::date ELSE COALESCE(v_eski.pasif_baslangic, public.talimat_bugun()) END;
    v_puntil := CASE WHEN p ? 'pasif_until'     THEN NULLIF(p ->> 'pasif_until', '')::date     ELSE v_eski.pasif_until END;
  END IF;

  IF v_id IS NULL THEN
    -- ── Yeni satır ──
    SELECT count(*) INTO v_n FROM public.talimat_satirlar
    WHERE plan_id = v_plan_id AND hat_id IS NOT DISTINCT FROM v_hat AND personel_id IS NOT DISTINCT FROM v_personel;
    IF v_sira IS NOT NULL AND v_sira <= v_n AND NOT v_kaydir THEN
      RAISE EXCEPTION 'SIRA_DOLU: % numaralı öncelik dolu', v_sira;
    END IF;

    v_yeni := true;
    INSERT INTO public.talimat_satirlar
      (plan_id, personel_id, hat_id, sira, istasyon, sku, plaka_id, istenen_miktar, not_text, talep_id,
       durum, pasif_neden, pasif_baslangic, pasif_until, degisti)
    VALUES
      (v_plan_id, v_personel, v_hat, v_n + 1, v_ist, v_sku, v_plaka, v_miktar, v_not, v_talep,
       v_durum, v_pneden, v_pbas, v_puntil, v_yayinda AND NOT v_bos)
    RETURNING satir_id INTO v_id;

    IF v_sira IS NOT NULL AND v_sira <= v_n THEN
      PERFORM public.talimat_sira_yerlestir_g(v_plan_id, v_hat, v_personel, v_id, v_sira);
    END IF;
  ELSE
    -- ── Güncelleme ──
    v_grup_degisti := v_hat IS DISTINCT FROM v_eski.hat_id OR v_personel IS DISTINCT FROM v_eski.personel_id;

    v_degisti := v_yayinda AND NOT (v_bos AND v_eski_bos) AND (
      v_grup_degisti
      OR v_sku IS DISTINCT FROM v_eski.sku OR v_plaka IS DISTINCT FROM v_eski.plaka_id
      OR v_ist IS DISTINCT FROM v_eski.istasyon OR v_miktar IS DISTINCT FROM v_eski.istenen_miktar
      OR v_not IS DISTINCT FROM v_eski.not_text OR v_durum IS DISTINCT FROM v_eski.durum
      OR (v_durum = 'pasif' AND (v_pbas IS DISTINCT FROM v_eski.pasif_baslangic
                                 OR v_puntil IS DISTINCT FROM v_eski.pasif_until))
    );

    IF v_grup_degisti AND NOT (p ? 'durum') THEN
      -- Başka hatta/personele devredilen iş aktifleşir (talep durumu da yeniden aktif görünür)
      v_durum := 'aktif';
    END IF;
    IF v_durum <> 'pasif' THEN
      v_pneden := NULL; v_pbas := NULL; v_puntil := NULL;
    END IF;

    SELECT count(*) INTO v_n FROM public.talimat_satirlar
    WHERE plan_id = v_plan_id AND hat_id IS NOT DISTINCT FROM v_hat AND personel_id IS NOT DISTINCT FROM v_personel;

    UPDATE public.talimat_satirlar SET
      personel_id = v_personel,
      hat_id = v_hat,
      sira = CASE WHEN v_grup_degisti THEN v_n + 1 ELSE sira END,
      istasyon = v_ist, sku = v_sku, plaka_id = v_plaka, istenen_miktar = v_miktar,
      not_text = v_not, talep_id = v_talep, durum = v_durum,
      pasif_neden = v_pneden, pasif_baslangic = v_pbas, pasif_until = v_puntil,
      degisti = degisti OR v_degisti
    WHERE satir_id = v_id;

    IF v_grup_degisti THEN
      PERFORM public.talimat_sira_yerlestir_g(v_plan_id, v_eski.hat_id, v_eski.personel_id);
      IF NOT v_eski_bos THEN
        PERFORM public.talimat_degisen_grup_isaretle(v_plan_id, v_eski.hat_id, v_eski.personel_id);
      END IF;
      IF v_sira IS NOT NULL THEN
        PERFORM public.talimat_sira_yerlestir_g(v_plan_id, v_hat, v_personel, v_id, v_sira);
      END IF;
      UPDATE public.talimat_satirlar SET degisti = degisti OR (v_yayinda AND NOT v_bos) WHERE satir_id = v_id;
    ELSIF v_sira IS NOT NULL AND v_sira <> v_eski.sira THEN
      PERFORM public.talimat_sira_yerlestir_g(v_plan_id, v_hat, v_personel, v_id, v_sira);
    END IF;
  END IF;

  IF v_id IS NOT NULL AND v_bos AND NOT v_eski_bos THEN
    -- Dolu satırın ürünü kaldırıldı: tablette düşer, hat/personel değişen sayılır
    PERFORM public.talimat_degisen_grup_isaretle(v_plan_id, v_hat, v_personel);
  END IF;
  -- Pasif/aktif geçişinde hat içi sıra: pasif en alta, yeniden aktif aktiflerin sonuna (163)
  IF v_hat IS NOT NULL AND (
       (v_yeni AND v_durum = 'pasif')
       OR (NOT v_yeni AND ((v_durum = 'pasif') IS DISTINCT FROM (v_eski.durum = 'pasif')))
       OR (NOT v_yeni AND v_grup_degisti AND v_durum = 'pasif')
     ) THEN
    IF v_durum = 'pasif' THEN
      PERFORM public.talimat_hat_yeniden_sirala(v_plan_id, v_hat, ARRAY[v_id], '{}');
    ELSE
      PERFORM public.talimat_hat_yeniden_sirala(v_plan_id, v_hat, '{}', ARRAY[v_id]);
    END IF;
  END IF;
  -- Hattın son satırı başka hatta taşındıysa eski hat boş satırla kalsın
  PERFORM public.talimat_plan_hat_hazirla_ic(v_plan_id);

  RETURN v_id;
END;
$$;
