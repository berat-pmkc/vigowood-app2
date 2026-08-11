-- =============================================================
-- STOK SAYIMI
--
-- Neden gerekli:
-- Yarı mamül ve hazır eleman bakiyeleri hiçbir zaman bir açılış stoğuyla
-- başlatılmamış; sistem yalnızca hareketleri toplamış. Sonuçta hem eski
-- AppSheet kurulumunda hem de aktarılan veride bakiyeler eksiye düşüyor
-- (Menteşe -780, Vida 7.5mm -9.670 gibi). Ayrıca elimizdeki hareket
-- geçmişinde Nisan-Mayıs-Haziran 2026 arası boş.
--
-- Bu yüzden bakiye hesapla düzeltilemez; fiziksel sayım şart. Sayım bir
-- tarihte gerçek miktarı sabitler, sonraki hareketler üstüne işler.
--
-- Tasarım:
--   stok_sayimlari        — sayım başlığı (tarih, kapsam, durum)
--   stok_sayim_satirlari  — kalem bazında sistem/sayılan/fark
--   stok_sayimi_satirlari_olustur() — kapsama göre satırları ve o anki
--                                     sistem miktarını dondurur
--   stok_sayimi_uygula()  — farkları düzeltme hareketi olarak yazar ve
--                           bakiyeleri sayılan değere sabitler
--
-- Sayım uygulanınca geçmiş SİLİNMEZ: fark, kaynağı 'Sayım' olan bir
-- hareket olarak deftere düşer, böylece bakiyedeki sıçrama izlenebilir.
-- =============================================================

-- ── Tablolar ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stok_sayimlari (
  sayim_id          TEXT PRIMARY KEY,
  ad                TEXT NOT NULL,
  sayim_tarihi      DATE NOT NULL DEFAULT CURRENT_DATE,
  -- YARIMAMUL / HAZIR / KUTU / KARTON / MAMUL
  kapsam            TEXT[] NOT NULL DEFAULT '{}',
  durum             TEXT NOT NULL DEFAULT 'taslak'
                    CHECK (durum IN ('taslak','tamamlandi','iptal')),
  notlar            TEXT,
  olusturan         TEXT REFERENCES public.users(user_id),
  tamamlanma_zamani TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stok_sayim_satirlari (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sayim_id        TEXT NOT NULL REFERENCES public.stok_sayimlari(sayim_id) ON DELETE CASCADE,
  -- 'parca' → all_parts.part_id, 'urun' → products.sku
  kalem_tipi      TEXT NOT NULL CHECK (kalem_tipi IN ('parca','urun')),
  kalem_id        TEXT NOT NULL,
  kalem_adi       TEXT,
  kategori        TEXT NOT NULL,
  -- Sayım açıldığı andaki sistem miktarı; sonradan değişmez ki fark
  -- neye göre hesaplandığı belli olsun
  sistem_miktar   NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- NULL = bu kalem henüz sayılmadı (0 saymaktan farklı)
  sayilan_miktar  NUMERIC(14,2),
  fark            NUMERIC(14,2) GENERATED ALWAYS AS
                    (COALESCE(sayilan_miktar,0) - sistem_miktar) STORED,
  not_text        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sayim_id, kalem_tipi, kalem_id)
);

CREATE INDEX IF NOT EXISTS idx_sayim_satir_sayim   ON public.stok_sayim_satirlari (sayim_id);
CREATE INDEX IF NOT EXISTS idx_sayim_satir_kategori ON public.stok_sayim_satirlari (sayim_id, kategori);
CREATE INDEX IF NOT EXISTS idx_sayimlar_durum      ON public.stok_sayimlari (durum, sayim_tarihi DESC);

DROP TRIGGER IF EXISTS set_stok_sayimlari_updated_at ON public.stok_sayimlari;
CREATE TRIGGER set_stok_sayimlari_updated_at
  BEFORE UPDATE ON public.stok_sayimlari
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_stok_sayim_satirlari_updated_at ON public.stok_sayim_satirlari;
CREATE TRIGGER set_stok_sayim_satirlari_updated_at
  BEFORE UPDATE ON public.stok_sayim_satirlari
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
-- Mevcut SECURITY DEFINER yardımcıları kullanılıyor; users tablosuna
-- doğrudan sorgu YAZILMIYOR (sonsuz özyineleme hatası).
ALTER TABLE public.stok_sayimlari      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stok_sayim_satirlari ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sayim oku"    ON public.stok_sayimlari;
DROP POLICY IF EXISTS "sayim yaz"    ON public.stok_sayimlari;
DROP POLICY IF EXISTS "sayim guncel" ON public.stok_sayimlari;
DROP POLICY IF EXISTS "sayim sil"    ON public.stok_sayimlari;
CREATE POLICY "sayim oku"    ON public.stok_sayimlari FOR SELECT TO authenticated USING (public.has_stock_access());
CREATE POLICY "sayim yaz"    ON public.stok_sayimlari FOR INSERT TO authenticated WITH CHECK (public.has_stock_access());
CREATE POLICY "sayim guncel" ON public.stok_sayimlari FOR UPDATE TO authenticated USING (public.has_stock_access());
CREATE POLICY "sayim sil"    ON public.stok_sayimlari FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "sayim satir oku"    ON public.stok_sayim_satirlari;
DROP POLICY IF EXISTS "sayim satir yaz"    ON public.stok_sayim_satirlari;
DROP POLICY IF EXISTS "sayim satir guncel" ON public.stok_sayim_satirlari;
DROP POLICY IF EXISTS "sayim satir sil"    ON public.stok_sayim_satirlari;
CREATE POLICY "sayim satir oku"    ON public.stok_sayim_satirlari FOR SELECT TO authenticated USING (public.has_stock_access());
CREATE POLICY "sayim satir yaz"    ON public.stok_sayim_satirlari FOR INSERT TO authenticated WITH CHECK (public.has_stock_access());
CREATE POLICY "sayim satir guncel" ON public.stok_sayim_satirlari FOR UPDATE TO authenticated USING (public.has_stock_access());
CREATE POLICY "sayim satir sil"    ON public.stok_sayim_satirlari FOR DELETE TO authenticated USING (public.is_admin());

-- =============================================================
-- Satırları oluştur — kapsamdaki her kalem için o anki sistem miktarını
-- dondurur. Tekrar çağrılırsa eksik kalanları ekler, mevcutlara dokunmaz.
-- =============================================================
CREATE OR REPLACE FUNCTION public.stok_sayimi_satirlari_olustur(p_sayim_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_kapsam TEXT[];
  v_durum  TEXT;
  v_eklenen INTEGER := 0;
BEGIN
  SELECT kapsam, durum INTO v_kapsam, v_durum
  FROM stok_sayimlari WHERE sayim_id = p_sayim_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sayım bulunamadı: %', p_sayim_id; END IF;
  IF v_durum <> 'taslak' THEN
    RAISE EXCEPTION 'Sayım taslak değil, satır eklenemez (durum: %)', v_durum;
  END IF;

  -- Parçalar: yarı mamül, hazır eleman, kutu, karton
  INSERT INTO stok_sayim_satirlari
    (sayim_id, kalem_tipi, kalem_id, kalem_adi, kategori, sistem_miktar)
  SELECT p_sayim_id, 'parca', a.part_id, a.part_adi, a.part_type::text,
         CASE WHEN a.part_type::text = 'YARIMAMUL'
              THEN COALESCE(a.yari_mamul_stok,0)
              ELSE COALESCE(a.hazir_eleman_aktif_stok,0) END
  FROM all_parts a
  WHERE a.part_type::text = ANY (v_kapsam)
  ON CONFLICT (sayim_id, kalem_tipi, kalem_id) DO NOTHING;
  GET DIAGNOSTICS v_eklenen = ROW_COUNT;

  -- Mamül: bakiye kolonu yok, stock_movements toplamından geliyor
  IF 'MAMUL' = ANY (v_kapsam) THEN
    INSERT INTO stok_sayim_satirlari
      (sayim_id, kalem_tipi, kalem_id, kalem_adi, kategori, sistem_miktar)
    SELECT p_sayim_id, 'urun', p.sku, p.urun_adi, 'MAMUL',
           COALESCE((SELECT sum(m.qty) FROM stock_movements m WHERE m.sku = p.sku),0)
    FROM products p
    WHERE COALESCE(p.stok_aktif, TRUE)
    ON CONFLICT (sayim_id, kalem_tipi, kalem_id) DO NOTHING;
    v_eklenen := v_eklenen + (SELECT count(*)::int FROM stok_sayim_satirlari
                              WHERE sayim_id = p_sayim_id AND kalem_tipi = 'urun');
  END IF;

  RETURN v_eklenen;
END;
$$;

-- =============================================================
-- Sayımı uygula — farkları düzeltme hareketi yazar, bakiyeleri sabitler.
-- Sayılmamış (sayilan_miktar IS NULL) satırlara DOKUNULMAZ.
-- =============================================================
CREATE OR REPLACE FUNCTION public.stok_sayimi_uygula(p_sayim_id TEXT, p_operator TEXT DEFAULT NULL)
RETURNS TABLE (guncellenen INTEGER, hareket INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_durum TEXT;
  v_tarih DATE;
  r RECORD;
  v_guncellenen INTEGER := 0;
  v_hareket INTEGER := 0;
BEGIN
  SELECT durum, sayim_tarihi INTO v_durum, v_tarih
  FROM stok_sayimlari WHERE sayim_id = p_sayim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sayım bulunamadı: %', p_sayim_id; END IF;
  IF v_durum <> 'taslak' THEN
    RAISE EXCEPTION 'Bu sayım zaten işlenmiş (durum: %)', v_durum;
  END IF;

  FOR r IN
    SELECT * FROM stok_sayim_satirlari
    WHERE sayim_id = p_sayim_id AND sayilan_miktar IS NOT NULL
  LOOP
    IF r.kalem_tipi = 'parca' THEN
      -- Fark varsa deftere düzeltme hareketi
      IF r.fark <> 0 THEN
        INSERT INTO yari_mamul_stok
          (yms_id, tarih, part_id, part_adi, qty, direction, source, source_id, operator)
        VALUES
          ('SYM-'||replace(gen_random_uuid()::text,'-',''), v_tarih::timestamptz,
           r.kalem_id, r.kalem_adi, r.fark,
           CASE WHEN r.fark > 0 THEN 'IN' ELSE 'OUT' END,
           'Sayım', p_sayim_id, p_operator);
        v_hareket := v_hareket + 1;
      END IF;

      -- Bakiyeyi sayılan değere sabitle
      IF r.kategori = 'YARIMAMUL' THEN
        UPDATE all_parts SET yari_mamul_stok = r.sayilan_miktar WHERE part_id = r.kalem_id;
      ELSE
        UPDATE all_parts SET hazir_eleman_aktif_stok = r.sayilan_miktar WHERE part_id = r.kalem_id;
      END IF;
      v_guncellenen := v_guncellenen + 1;

    ELSE  -- mamül: bakiye kolonu yok, farkı hareket olarak yaz
      IF r.fark <> 0 THEN
        INSERT INTO stock_movements (mov_id, tarih, sku, qty, source, source_row_id)
        VALUES ('SYM-'||replace(gen_random_uuid()::text,'-',''), v_tarih::timestamptz,
                r.kalem_id, r.fark, 'Sayım', p_sayim_id);
        v_hareket := v_hareket + 1;
      END IF;
      v_guncellenen := v_guncellenen + 1;
    END IF;
  END LOOP;

  UPDATE stok_sayimlari
  SET durum = 'tamamlandi', tamamlanma_zamani = now()
  WHERE sayim_id = p_sayim_id;

  RETURN QUERY SELECT v_guncellenen, v_hareket;
END;
$$;

REVOKE ALL ON FUNCTION public.stok_sayimi_satirlari_olustur(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stok_sayimi_uygula(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stok_sayimi_satirlari_olustur(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stok_sayimi_uygula(TEXT, TEXT) TO authenticated;
