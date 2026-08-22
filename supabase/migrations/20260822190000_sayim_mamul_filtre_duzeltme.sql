-- =============================================================
-- Stok sayımı: "COALESCE types integer and boolean cannot be matched"
--
-- HATA: Mamül kapsamı seçilip sayım oluşturulmaya çalışıldığında
-- fonksiyon patlıyordu. Sebep:
--
--     WHERE COALESCE(p.stok_aktif, TRUE)
--
-- products.stok_aktif bir BAYRAK DEĞİL, integer stok miktarı.
-- Boolean beklenen yere integer konunca PostgreSQL tip hatası veriyor.
-- Doğru bayrak kolonu products.aktif_mi.
--
-- KAPSAM KARARI: yalnızca aktif_mi = true demek yeterli değil. Pasife
-- alınmış ama deposunda hâlâ mal olan bir ürün hiçbir zaman sayılmaz,
-- bakiyesi kalıcı olarak yanlış kalırdı. Bu yüzden "aktif ürünler VEYA
-- bakiyesi sıfırdan farklı olanlar" alınıyor.
--
-- İKİNCİ DÜZELTME: mamül kolunda v_eklenen, eklenen satır sayısı yerine
-- o sayımdaki TÜM 'urun' satırlarını sayıyordu. ON CONFLICT DO NOTHING
-- ile birlikte, fonksiyon ikinci kez çağrıldığında hiç satır eklenmese
-- bile yüksek bir sayı dönerdi. GET DIAGNOSTICS'e çevrildi.
-- =============================================================

CREATE OR REPLACE FUNCTION public.stok_sayimi_satirlari_olustur(p_sayim_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_kapsam TEXT[];
  v_durum  TEXT;
  v_eklenen INTEGER := 0;
  v_mamul   INTEGER := 0;
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
    SELECT p_sayim_id, 'urun', p.sku, p.urun_adi, 'MAMUL', b.bakiye
    FROM products p
    CROSS JOIN LATERAL (
      SELECT COALESCE((SELECT sum(m.qty) FROM stock_movements m WHERE m.sku = p.sku), 0) AS bakiye
    ) b
    -- Aktif ürünler + pasife alınmış ama stoğu kalanlar
    WHERE COALESCE(p.aktif_mi, TRUE) OR b.bakiye <> 0
    ON CONFLICT (sayim_id, kalem_tipi, kalem_id) DO NOTHING;
    GET DIAGNOSTICS v_mamul = ROW_COUNT;
    v_eklenen := v_eklenen + v_mamul;
  END IF;

  RETURN v_eklenen;
END;
$function$;
