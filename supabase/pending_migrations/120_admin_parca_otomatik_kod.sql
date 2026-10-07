-- =============================================================
-- Admin Plaka/Parça ağacı: yarı mamül parça kodu OTOMATİK üretimi
--
-- Kod kuralı: <ÖNEK>-P<NN>  (ör. LS051-P07). Önek varsayılan olarak ürün
-- SKU'sudur; ürün ailesi kodu (ör. MKOS) için elle verilebilir.
-- NN en az 2 haneli (P01..P99, P100+). Numara = mevcut en büyük sonek + 1
-- (boşluklar yeniden kullanılmaz, çakışma olmaz).
--
-- Yarış güvenliği: pg_advisory_xact_lock(hashtext(önek)) — aynı önek için
-- eşzamanlı iki ekleme sıraya girer.
-- Yetki: is_admin_or_engineer() (SECURITY DEFINER; RLS recursion yok).
-- =============================================================

CREATE OR REPLACE FUNCTION public.next_part_code(p_prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text := btrim(coalesce(p_prefix, ''));
  v_len    int;
  v_max    int;
BEGIN
  IF NOT public.is_admin_or_engineer() THEN
    RAISE EXCEPTION 'Yetkisiz erişim';
  END IF;
  IF v_prefix = '' THEN
    RAISE EXCEPTION 'Parça kodu öneki boş olamaz';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('part_code:' || v_prefix));

  v_len := length(v_prefix);

  SELECT COALESCE(MAX(substr(part_id, v_len + 3)::int), 0)
    INTO v_max
    FROM public.all_parts
   WHERE left(part_id, v_len + 2) = v_prefix || '-P'
     AND substr(part_id, v_len + 3) ~ '^[0-9]{1,6}$';

  RETURN v_prefix || '-P' || lpad((v_max + 1)::text, 2, '0');
END;
$$;

REVOKE ALL ON FUNCTION public.next_part_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_part_code(text) TO authenticated;


-- Yeni yarı mamül parça ekler (+ isteğe bağlı plakaya bağlar), yeni part_id döner.
CREATE OR REPLACE FUNCTION public.admin_parca_ekle(
  p_sku         text,
  p_plaka_id    text,
  p_part_adi    text,
  p_part_type   public.part_type DEFAULT 'YARIMAMUL',
  p_default_qty numeric          DEFAULT NULL,
  p_prefix      text             DEFAULT NULL,
  p_tur         text             DEFAULT NULL,
  p_mdf_tipi    text             DEFAULT NULL,
  p_mdf_renk    text             DEFAULT NULL,
  p_kritik      integer          DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix  text := btrim(coalesce(nullif(btrim(p_prefix), ''), p_sku, ''));
  v_part_id text;
  v_ppart   text;
BEGIN
  IF NOT public.is_admin_or_engineer() THEN
    RAISE EXCEPTION 'Yetkisiz erişim';
  END IF;
  IF btrim(coalesce(p_part_adi, '')) = '' THEN
    RAISE EXCEPTION 'Parça adı gereklidir';
  END IF;
  IF v_prefix = '' THEN
    RAISE EXCEPTION 'Ürün (SKU) veya kod öneki gereklidir';
  END IF;
  IF p_sku IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = p_sku) THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', p_sku;
  END IF;
  IF p_plaka_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.plakalar WHERE plaka_id = p_plaka_id) THEN
    RAISE EXCEPTION 'Plaka bulunamadı: %', p_plaka_id;
  END IF;

  -- Kilit bu işlem sonuna kadar tutulur: kod üretimi + insert aynı kilit altında.
  v_part_id := public.next_part_code(v_prefix);

  INSERT INTO public.all_parts (
    part_id, part_adi, part_type, tur, mdf_tipi, mdf_renk,
    hazir_eleman_aktif_stok, hazir_eleman_kritik_stok, yari_mamul_stok
  ) VALUES (
    v_part_id, btrim(p_part_adi), p_part_type, p_tur, p_mdf_tipi, p_mdf_renk,
    0, COALESCE(p_kritik, 0), 0
  );

  IF p_plaka_id IS NOT NULL THEN
    v_ppart := public.next_id('PPart', 4);
    INSERT INTO public.plaka_parts (ppart_id, plaka_id, part_id, default_qty, sku)
    VALUES (v_ppart, p_plaka_id, v_part_id, p_default_qty, p_sku);
  END IF;

  RETURN v_part_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_parca_ekle(text, text, text, public.part_type, numeric, text, text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_parca_ekle(text, text, text, public.part_type, numeric, text, text, text, text, integer) TO authenticated;
