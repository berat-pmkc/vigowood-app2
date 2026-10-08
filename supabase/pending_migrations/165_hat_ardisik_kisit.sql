-- =============================================================
-- 165: Aynı HATTA art arda aynı ürün verilemez (hat bazlı ardışık SKU kuralı)
--  * Bir hatta işçinin sırayla gördüğü satırlar (ürünü dolu, pasif olmayan, tamamlanmamış)
--    arasında yan yana aynı sku olamaz. Boş / pasif / tamamlanan satırlar komşuluğa sayılmaz.
--    Araya başka ürün girerse aynı ürün tekrar verilebilir. Talepler aynı ürün için çok kez açılabilir.
--  * Doğrulama: talimat_hat_ardisik_dogrula(plan, hat [, satir, sira]) — 'ARDISIK_SKU: ...'
--  * DEFERRABLE INITIALLY DEFERRED constraint trigger: tüm yazma yolları (kaydet/sirala/sil/ata/pasif/
--    yeniden aktif/kopyala ...) COMMIT anında denetlenir. Ara durumlar (kaydırma) sorun olmaz.
--  * Üretimle tamamlanan satırlar nedeniyle oluşan eski komşuluklar, ilgili satırlara
--    dokunulmadıkça engel olmaz (yalnız değişen satırın komşulukları denetlenir).
--  * Eski personel bazlı talimat_ardisik_dogrula(plan, personel) no-op olarak kalır (155).
--  * talimat_satirlari_hatta_kopyala: yan yana aynı ürün oluşturacak satır atlanır (hata verilmez).
--  * talimat_zamanli_islem_calistir: ihlal olursa işlem 'hata' olur, zamanlayıcı çökmez.
-- =============================================================

CREATE OR REPLACE FUNCTION public.talimat_hat_ardisik_dogrula(
  p_plan UUID, p_hat UUID, p_satir UUID DEFAULT NULL, p_sira INTEGER DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sku TEXT;
  v_hat TEXT;
BEGIN
  IF p_plan IS NULL OR p_hat IS NULL THEN RETURN; END IF;
  -- p_satir/p_sira verilmişse yalnız o satırın (ve eski konumunun) komşulukları; ikisi de boşsa tüm hat
  WITH g AS (
    SELECT i.satir_id, i.sku, i.sira,
           lag(i.sku)      OVER w AS onceki_sku,
           lag(i.satir_id) OVER w AS onceki_id,
           lag(i.sira)     OVER w AS onceki_sira
    FROM public.talimat_satir_ilerleme i
    WHERE i.plan_id = p_plan AND i.hat_id = p_hat
      AND i.sku IS NOT NULL
      AND i.durum <> 'pasif'
      AND NOT COALESCE(i.tamamlandi_mi, false)
    WINDOW w AS (ORDER BY i.sira)
  )
  SELECT g.sku INTO v_sku FROM g
  WHERE g.sku = g.onceki_sku
    AND ((p_satir IS NULL AND p_sira IS NULL)
         OR g.satir_id = p_satir OR g.onceki_id = p_satir
         OR (p_sira IS NOT NULL AND g.onceki_sira < p_sira AND g.sira > p_sira))
  LIMIT 1;
  IF v_sku IS NOT NULL THEN
    SELECT ad INTO v_hat FROM public.talimat_hatlar WHERE hat_id = p_hat;
    RAISE EXCEPTION 'ARDISIK_SKU: % bu hatta arka arkaya verilemez (önceki/sonraki satırda aynı ürün var). Aynı ürünü tek satırda toplayın%',
      v_sku, COALESCE(' — ' || v_hat, '');
  END IF;
END;
$$;

-- Hat satırı değişince (INSERT/UPDATE/DELETE) tetiklenir
CREATE OR REPLACE FUNCTION public.talimat_hat_ardisik_trg()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.hat_id IS NOT NULL THEN
      PERFORM public.talimat_hat_ardisik_dogrula(OLD.plan_id, OLD.hat_id, NULL, OLD.sira);
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.hat_id IS NOT NULL THEN
    PERFORM public.talimat_hat_ardisik_dogrula(NEW.plan_id, NEW.hat_id, NEW.satir_id,
      CASE WHEN TG_OP = 'UPDATE' THEN OLD.sira END);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.hat_id IS NOT NULL
     AND (OLD.hat_id IS DISTINCT FROM NEW.hat_id OR OLD.plan_id IS DISTINCT FROM NEW.plan_id) THEN
    PERFORM public.talimat_hat_ardisik_dogrula(OLD.plan_id, OLD.hat_id, NULL, OLD.sira);
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.talimat_hat_ardisik_trg() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_talimat_hat_ardisik ON public.talimat_satirlar;
CREATE CONSTRAINT TRIGGER trg_talimat_hat_ardisik
  AFTER INSERT OR DELETE OR UPDATE OF sku, sira, durum, hat_id, plan_id, istenen_miktar, sayac_baslangic, kapanis
  ON public.talimat_satirlar
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.talimat_hat_ardisik_trg();

-- Bekleyen denetimleri hemen çalıştırır (hata varsa ARDISIK_SKU fırlatır). Alt işlemde (BEGIN/EXCEPTION)
-- yakalanması gereken yerlerde ve testlerde kullanılır.
CREATE OR REPLACE FUNCTION public.talimat_ardisik_simdi()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  SET CONSTRAINTS trg_talimat_hat_ardisik IMMEDIATE;
  SET CONSTRAINTS trg_talimat_hat_ardisik DEFERRED;
END;
$$;
REVOKE ALL ON FUNCTION public.talimat_ardisik_simdi() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_ardisik_simdi() TO authenticated;
REVOKE ALL ON FUNCTION public.talimat_hat_ardisik_dogrula(UUID, UUID, UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.talimat_hat_ardisik_dogrula(UUID, UUID, UUID, INTEGER) TO authenticated;

-- Eski personel bazlı kural: no-op (155) — burada dokunulmaz.

-- ── Hatlar arası kopyalama: komşu aynı ürünse satır ATLANIR ─────
CREATE OR REPLACE FUNCTION public.talimat_satirlari_hatta_kopyala(p_satir_ids UUID[], p_hedef_hat UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan UUID;
  v_planlar INTEGER;
  v_bulunan INTEGER;
  v_durum TEXT;
  r RECORD;
  v_bos UUID;
  v_id UUID;
  v_talep UUID;
  v_yeni UUID[] := '{}';
  v_atlanan INTEGER := 0;
  v_ardisik INTEGER := 0;
  v_poz INTEGER;
  v_onceki TEXT;
  v_sonraki TEXT;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  IF p_satir_ids IS NULL OR cardinality(p_satir_ids) = 0 THEN RAISE EXCEPTION 'Kopyalanacak satır seçilmedi'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.talimat_hatlar WHERE hat_id = p_hedef_hat AND aktif) THEN
    RAISE EXCEPTION 'Hedef hat bulunamadı veya pasif';
  END IF;

  SELECT count(DISTINCT plan_id), count(*), (array_agg(plan_id))[1]
    INTO v_planlar, v_bulunan, v_plan
  FROM public.talimat_satirlar WHERE satir_id = ANY (p_satir_ids);
  IF v_bulunan <> (SELECT count(DISTINCT x) FROM unnest(p_satir_ids) x) THEN
    RAISE EXCEPTION 'Satır bulunamadı';
  END IF;
  IF v_planlar <> 1 THEN RAISE EXCEPTION 'Satırlar aynı plandan olmalı'; END IF;
  SELECT durum INTO v_durum FROM public.talimat_planlar WHERE plan_id = v_plan;
  IF v_durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

  FOR r IN
    SELECT s.*
    FROM unnest(p_satir_ids) WITH ORDINALITY AS o(id, ord)
    JOIN public.talimat_satirlar s ON s.satir_id = o.id
    WHERE s.sku IS NOT NULL
    ORDER BY o.ord
  LOOP
    v_talep := NULL;
    IF r.talep_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.talepler WHERE talep_id = r.talep_id AND kapanis IS NULL) THEN
      v_talep := r.talep_id;
    END IF;
    -- Aynı talep (iş) bir hatta yalnız bir kez atanabilir: hedef hatta zaten varsa bu satır atlanır
    IF v_talep IS NOT NULL AND EXISTS (
         SELECT 1 FROM public.talimat_satirlar x
         WHERE x.plan_id = v_plan AND x.hat_id = p_hedef_hat AND x.talep_id = v_talep) THEN
      v_atlanan := v_atlanan + 1;
      CONTINUE;
    END IF;

    SELECT satir_id, sira INTO v_bos, v_poz FROM public.talimat_satirlar
    WHERE plan_id = v_plan AND hat_id = p_hedef_hat AND sku IS NULL AND plaka_id IS NULL
    ORDER BY sira LIMIT 1;
    IF v_bos IS NULL THEN
      SELECT COALESCE(max(sira), 0) + 1 INTO v_poz FROM public.talimat_satirlar
      WHERE plan_id = v_plan AND hat_id = p_hedef_hat;
    END IF;

    -- Hatta art arda aynı ürün verilemez (165): konumun görünen komşuları aynı ürünse bu satır atlanır
    SELECT i.sku INTO v_onceki FROM public.talimat_satir_ilerleme i
    WHERE i.plan_id = v_plan AND i.hat_id = p_hedef_hat AND i.sku IS NOT NULL AND i.durum <> 'pasif'
      AND NOT COALESCE(i.tamamlandi_mi, false) AND i.sira < v_poz
    ORDER BY i.sira DESC LIMIT 1;
    SELECT i.sku INTO v_sonraki FROM public.talimat_satir_ilerleme i
    WHERE i.plan_id = v_plan AND i.hat_id = p_hedef_hat AND i.sku IS NOT NULL AND i.durum <> 'pasif'
      AND NOT COALESCE(i.tamamlandi_mi, false) AND i.sira > v_poz
    ORDER BY i.sira LIMIT 1;
    IF r.sku = v_onceki OR r.sku = v_sonraki THEN
      v_ardisik := v_ardisik + 1;
      CONTINUE;
    END IF;

    IF v_bos IS NOT NULL THEN
      v_id := public.talimat_satir_kaydet(jsonb_build_object(
        'satir_id', v_bos, 'sku', r.sku, 'istenen_miktar', r.istenen_miktar,
        'not_text', r.not_text, 'talep_id', v_talep, 'durum', 'aktif'));
    ELSE
      v_id := public.talimat_satir_kaydet(jsonb_build_object(
        'plan_id', v_plan, 'hat_id', p_hedef_hat, 'sku', r.sku, 'istenen_miktar', r.istenen_miktar,
        'not_text', r.not_text, 'talep_id', v_talep));
    END IF;
    v_yeni := array_append(v_yeni, v_id);
  END LOOP;

  IF cardinality(v_yeni) = 0 THEN
    IF v_ardisik > 0 THEN
      RAISE EXCEPTION 'ARDISIK_SKU: Seçilen ürünler hedef hatta arka arkaya verilemez (önceki/sonraki satırda aynı ürün var, % satır atlandı). Aynı ürünü tek satırda toplayın', v_ardisik;
    END IF;
    IF v_atlanan > 0 THEN
      RAISE EXCEPTION 'Seçilen işler bu hatta zaten atanmış (aynı talep bir hatta bir kez atanabilir)';
    END IF;
    RAISE EXCEPTION 'Kopyalanacak dolu satır yok';
  END IF;
  IF v_ardisik > 0 THEN
    RAISE NOTICE 'Ardışık aynı ürün nedeniyle % satır atlandı', v_ardisik;
  END IF;
  RETURN v_yeni;
END;
$$;

GRANT EXECUTE ON FUNCTION public.talimat_satirlari_hatta_kopyala(UUID[], UUID) TO authenticated;

-- ── Zamanlı işlem: ardışık ihlalde 'hata' (cron çökmez) ───────
CREATE OR REPLACE FUNCTION public.talimat_zamanli_islem_calistir(p_islem UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_i     public.talimat_zamanli_islemler%ROWTYPE;
  v_plan  public.talimat_planlar%ROWTYPE;
  v_n     INTEGER := 0;
  v_idx   INTEGER := 0;
  v_id    TEXT;
  v_uyari TEXT;
BEGIN
  SELECT * INTO v_i FROM public.talimat_zamanli_islemler WHERE islem_id = p_islem FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Zamanlı işlem bulunamadı'; END IF;
  IF v_i.durum <> 'bekliyor' THEN
    RETURN jsonb_build_object('islem_id', p_islem, 'durum', v_i.durum, 'hata', v_i.hata);
  END IF;

  BEGIN
    SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = v_i.plan_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
    IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

    IF v_i.islem = 'pasif' THEN
      v_n := public.talimat_pasif_ic(v_i.kapsam, v_i.plan_id, v_i.ids, public.talimat_bugun(), v_i.pasif_bitis,
                                     v_i.pasif_neden, v_i.olusturan);
    ELSE
      v_n := public.talimat_pasif_kaldir_ic(v_i.kapsam, v_i.plan_id, v_i.ids);
      IF v_i.kapsam = 'satir' AND v_i.hedef_sira IS NOT NULL THEN
        FOREACH v_id IN ARRAY v_i.ids LOOP
          PERFORM public.talimat_satir_gorunen_sira_ic(v_i.plan_id, v_id::uuid, v_i.hedef_sira + v_idx);
          v_idx := v_idx + 1;
        END LOOP;
      END IF;
    END IF;

    -- Hatta art arda aynı ürün oluştuysa burada yakalanır (işlem 'hata' olur, değişiklik geri alınır)
    PERFORM public.talimat_ardisik_simdi();

    UPDATE public.talimat_zamanli_islemler SET durum = 'yapildi', calisti_at = now(), hata = NULL
    WHERE islem_id = p_islem;
  EXCEPTION WHEN OTHERS THEN
    UPDATE public.talimat_zamanli_islemler SET durum = 'hata', calisti_at = now(), hata = SQLERRM
    WHERE islem_id = p_islem;
    RETURN jsonb_build_object('islem_id', p_islem, 'durum', 'hata', 'hata', SQLERRM);
  END;

  -- Yayın ayrı blokta: başarısız olsa bile pasif/aktif değişikliği korunur
  IF v_i.yayin <> 'yok' THEN
    BEGIN
      PERFORM public.talimat_yayinla_ic(v_i.plan_id, v_i.yayin = 'bildirimli', now(), v_i.sesli, 'degisenler',
                                        v_i.olusturan, false);
    EXCEPTION WHEN OTHERS THEN
      v_uyari := 'Yayın yapılamadı: ' || SQLERRM;
      UPDATE public.talimat_zamanli_islemler SET hata = v_uyari WHERE islem_id = p_islem;
    END;
  END IF;

  RETURN jsonb_build_object('islem_id', p_islem, 'durum', 'yapildi', 'etkilenen', v_n, 'hata', v_uyari);
END;
$$;
