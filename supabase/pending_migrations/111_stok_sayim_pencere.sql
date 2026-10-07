-- =============================================================
-- STOK SAYIMI: sayım penceresi + uygunsuz/fire alanları — Revizyon 2, madde 31 ve 33
--
-- Önkoşul: 20260811100000_stok_sayimi.sql, 20260822190000, 20260822230000, 100, 110
--
-- Kural (kullanıcı kararı): sayım BAŞLATILDIĞI andan BİTİRİLDİĞİ ana kadar o
-- kaleme giren/çıkan hareketler (üretim/paketleme, uygunsuz stoktan düşme,
-- kontrol-uygun, fire, iade, satış ...) sayılan rakamın ÜSTÜNE eklenir:
--
--     nihai miktar = sayılan + pencere hareket toplamı
--     fark         = nihai - sayımın bitiş anındaki sistem bakiyesi
--
-- Pencerede HARİÇ tutulanlar: 'Sayım' düzeltmeleri (kendi düzeltmemiz) ve
-- 'Stok Düzeltme' (muhasebe düzeltmesi, fiziksel hareket değildir). Depolar arası
-- 'Transfer' dahil edilir; sayım toplam (tüm depolar) olduğundan net etkisi 0'dır.
--
-- Pencere kaynağı (sayım kategorisine göre):
--   MAMUL                  : stock_movements        (created_at, qty işaretli)
--   YARIMAMUL              : yari_mamul_stok        (IN +, OUT -; created_at)
--   HAZIR / KUTU / KARTON  : hazir_eleman_akis      (qty işaretli; created_at)
-- created_at (kayıt anı) kullanılır, tarih kolonu DEĞİL: 'Sayım' hareketleri
-- tarih kolonuna sayım gününü yazıyor, kayıt anı ise gerçek zamanı gösterir.
-- =============================================================

-- ── 1. Kolonlar ──────────────────────────────────────────────
ALTER TABLE public.stok_sayimlari
  ADD COLUMN IF NOT EXISTS baslangic_zamani TIMESTAMPTZ;
UPDATE public.stok_sayimlari SET baslangic_zamani = created_at WHERE baslangic_zamani IS NULL;
ALTER TABLE public.stok_sayimlari
  ALTER COLUMN baslangic_zamani SET DEFAULT now(),
  ALTER COLUMN baslangic_zamani SET NOT NULL;

ALTER TABLE public.stok_sayim_satirlari
  ADD COLUMN IF NOT EXISTS uygunsuz_qty    NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (uygunsuz_qty >= 0),
  ADD COLUMN IF NOT EXISTS fire_qty        NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (fire_qty >= 0),
  -- Tamamlanınca donar (taslakta NULL; canlı değer stok_sayim_pencere() ile hesaplanır)
  ADD COLUMN IF NOT EXISTS pencere_miktar  NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS nihai_miktar    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS canli_sistem    NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS uygulanan_fark  NUMERIC(14,2);

-- ── 2. Tek kalem için pencere toplamı ────────────────────────
CREATE OR REPLACE FUNCTION public._sayim_pencere_toplam(
  p_kategori TEXT, p_kalem_id TEXT, p_baslangic TIMESTAMPTZ
) RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN p_kategori = 'MAMUL' THEN
        (SELECT sum(m.qty) FROM stock_movements m
          WHERE m.sku = p_kalem_id AND m.created_at > p_baslangic
            AND COALESCE(m.source, '') NOT IN ('Sayım', 'Stok Düzeltme'))
      WHEN p_kategori = 'YARIMAMUL' THEN
        (SELECT sum(CASE WHEN y.direction = 'IN' THEN abs(y.qty) ELSE -abs(y.qty) END)
           FROM yari_mamul_stok y
          WHERE y.part_id = p_kalem_id AND y.created_at > p_baslangic
            AND COALESCE(y.source, '') <> 'Sayım')
      ELSE
        (SELECT sum(h.qty) FROM hazir_eleman_akis h
          WHERE h.part_id = p_kalem_id AND h.created_at > p_baslangic
            AND COALESCE(h.not_text, '') NOT LIKE 'Sayım %')
    END, 0);
$$;

-- Tek kalem için şu anki sistem bakiyesi (sayım uygulama referansı)
--  MAMUL     : Σ stock_movements (depo bazlı view'larla aynı kaynak)
--  YARIMAMUL : Σ yari_mamul_stok defteri (bakiye tetikleyicisinin kaynağı)
--  diğerleri : all_parts.hazir_eleman_aktif_stok
CREATE OR REPLACE FUNCTION public._sayim_canli_sistem(p_kategori TEXT, p_kalem_id TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    CASE
      WHEN p_kategori = 'MAMUL' THEN
        (SELECT sum(m.qty) FROM stock_movements m WHERE m.sku = p_kalem_id)
      WHEN p_kategori = 'YARIMAMUL' THEN
        (SELECT sum(CASE WHEN y.direction = 'IN' THEN abs(y.qty) ELSE -abs(y.qty) END)
           FROM yari_mamul_stok y WHERE y.part_id = p_kalem_id)
      ELSE
        (SELECT a.hazir_eleman_aktif_stok FROM all_parts a WHERE a.part_id = p_kalem_id)
    END, 0);
$$;

REVOKE ALL ON FUNCTION public._sayim_pencere_toplam(TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._sayim_canli_sistem(TEXT, TEXT) FROM PUBLIC, anon;

-- ── 3. Taslak sayım için canlı pencere (arayüz) ──────────────
CREATE OR REPLACE FUNCTION public.stok_sayim_pencere(p_sayim_id TEXT)
RETURNS TABLE (satir_id UUID, kalem_id TEXT, pencere_miktar NUMERIC, canli_sistem NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_baslangic TIMESTAMPTZ;
BEGIN
  IF NOT public.has_stock_access() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  SELECT s.baslangic_zamani INTO v_baslangic FROM stok_sayimlari s WHERE s.sayim_id = p_sayim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sayım bulunamadı: %', p_sayim_id; END IF;

  RETURN QUERY
  SELECT r.id, r.kalem_id,
         public._sayim_pencere_toplam(r.kategori, r.kalem_id, v_baslangic),
         public._sayim_canli_sistem(r.kategori, r.kalem_id)
  FROM stok_sayim_satirlari r
  WHERE r.sayim_id = p_sayim_id;
END;
$$;

REVOKE ALL ON FUNCTION public.stok_sayim_pencere(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stok_sayim_pencere(TEXT) TO authenticated;

-- ── 4. Atomik tamamlama ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stok_sayim_tamamla(
  p_sayim_id TEXT, p_operator TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL
) RETURNS TABLE (guncellenen INTEGER, hareket INTEGER, uygunsuz_kayit INTEGER, fire_kayit INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_durum   TEXT;
  v_bas     TIMESTAMPTZ;
  r         RECORD;
  v_pencere NUMERIC;
  v_canli   NUMERIC;
  v_nihai   NUMERIC;
  v_fark    NUMERIC;
  v_tipi    TEXT;
  v_g INTEGER := 0;
  v_h INTEGER := 0;
  v_u INTEGER := 0;
  v_f INTEGER := 0;
BEGIN
  IF NOT public.has_stock_access() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;

  SELECT durum, baslangic_zamani INTO v_durum, v_bas
  FROM stok_sayimlari WHERE sayim_id = p_sayim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sayım bulunamadı: %', p_sayim_id; END IF;
  IF v_durum <> 'taslak' THEN
    RAISE EXCEPTION 'Bu sayım zaten işlenmiş (durum: %)', v_durum;
  END IF;

  -- Sayılmamış satıra uygunsuz/fire girilmişse belirsizlik olmasın
  IF EXISTS (SELECT 1 FROM stok_sayim_satirlari
             WHERE sayim_id = p_sayim_id AND sayilan_miktar IS NULL
               AND (uygunsuz_qty > 0 OR fire_qty > 0)) THEN
    RAISE EXCEPTION 'Sayılmamış kalemde uygunsuz/fire miktarı girilmiş; önce sayılan miktarı girin';
  END IF;

  FOR r IN
    SELECT * FROM stok_sayim_satirlari
    WHERE sayim_id = p_sayim_id AND sayilan_miktar IS NOT NULL
    ORDER BY kategori, kalem_id
  LOOP
    v_pencere := public._sayim_pencere_toplam(r.kategori, r.kalem_id, v_bas);
    v_canli   := public._sayim_canli_sistem(r.kategori, r.kalem_id);
    v_nihai   := r.sayilan_miktar + v_pencere;
    v_fark    := v_nihai - v_canli;

    -- Uygunsuz / fire yalnızca mamül ve yarı mamülde defterlenebilir
    IF (r.uygunsuz_qty > 0 OR r.fire_qty > 0) AND r.kategori NOT IN ('MAMUL', 'YARIMAMUL') THEN
      RAISE EXCEPTION 'Uygunsuz/fire yalnızca mamül ve yarı mamül kalemlerde girilebilir (%)', r.kalem_id;
    END IF;

    IF r.kategori = 'YARIMAMUL' THEN
      IF v_fark <> 0 THEN
        INSERT INTO yari_mamul_stok
          (yms_id, tarih, part_id, part_adi, qty, direction, source, source_id, operator)
        VALUES (public.next_id('YMS-', 6), now(), r.kalem_id, r.kalem_adi, abs(v_fark),
                CASE WHEN v_fark > 0 THEN 'IN' ELSE 'OUT' END, 'Sayım', p_sayim_id, p_operator);
        v_h := v_h + 1;
      END IF;
      -- Tetikleyici bakiyeyi defterden yeniden hesaplar; defter = nihai olur
    ELSIF r.kategori = 'MAMUL' THEN
      IF v_fark <> 0 THEN
        INSERT INTO stock_movements (mov_id, tarih, sku, qty, source, source_row_id, batch_id)
        VALUES (public.next_id('SM-', 6), now(), r.kalem_id, v_fark, 'Sayım', p_sayim_id, p_sayim_id);
        v_h := v_h + 1;
      END IF;
      -- products.stok_aktif = tüm depoların toplamı = Σ hareketler
      UPDATE products SET stok_aktif = round(v_nihai)::int WHERE sku = r.kalem_id;
    ELSE  -- HAZIR / KUTU / KARTON
      IF v_fark <> 0 THEN
        INSERT INTO hazir_eleman_akis (hakis_id, tarih, part_id, qty, operator, not_text)
        VALUES (public.next_id('HAK-', 6), now(), r.kalem_id, v_fark, p_operator, 'Sayım ' || p_sayim_id);
        v_h := v_h + 1;
      END IF;
      UPDATE all_parts SET hazir_eleman_aktif_stok = v_nihai WHERE part_id = r.kalem_id;
    END IF;
    v_g := v_g + 1;

    -- Uygunsuz / fire: stoktan DÜŞMEDEN deftere (sayılan zaten iyi stok)
    IF r.uygunsuz_qty > 0 OR r.fire_qty > 0 THEN
      v_tipi := CASE WHEN r.kategori = 'MAMUL' THEN 'URUN' ELSE 'YARI_MAMUL' END;
      IF r.uygunsuz_qty > 0 THEN
        PERFORM public.kalite_uygunsuz_giris(
          v_tipi, r.kalem_id, r.uygunsuz_qty, 'stok', FALSE, NULL, p_sayim_id,
          p_operator, p_operator_name, NULL, NULL, 'Stok sayımı ' || p_sayim_id);
        v_u := v_u + 1;
      END IF;
      IF r.fire_qty > 0 THEN
        PERFORM public.kalite_fire_giris(
          v_tipi, r.kalem_id, r.fire_qty, 'stok', FALSE, NULL, NULL, FALSE,
          p_operator, p_operator_name, 'Stok sayımı ' || p_sayim_id);
        v_f := v_f + 1;
      END IF;
    END IF;

    UPDATE stok_sayim_satirlari
    SET pencere_miktar = v_pencere, nihai_miktar = v_nihai,
        canli_sistem = v_canli, uygulanan_fark = v_fark
    WHERE id = r.id;
  END LOOP;

  UPDATE stok_sayimlari SET durum = 'tamamlandi', tamamlanma_zamani = now()
  WHERE sayim_id = p_sayim_id;

  RETURN QUERY SELECT v_g, v_h, v_u, v_f;
END;
$$;

REVOKE ALL ON FUNCTION public.stok_sayim_tamamla(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stok_sayim_tamamla(TEXT, TEXT, TEXT) TO authenticated;

-- Eski giriş noktası aynı mantığa yönlendirilir (iki ayrı uygulama yolu kalmasın)
CREATE OR REPLACE FUNCTION public.stok_sayimi_uygula(p_sayim_id TEXT, p_operator TEXT DEFAULT NULL)
RETURNS TABLE (guncellenen INTEGER, hareket INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT t.guncellenen, t.hareket FROM public.stok_sayim_tamamla(p_sayim_id, p_operator, NULL) t;
END;
$$;

REVOKE ALL ON FUNCTION public.stok_sayimi_uygula(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stok_sayimi_uygula(TEXT, TEXT) TO authenticated;
