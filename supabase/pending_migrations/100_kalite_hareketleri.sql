-- =============================================================
-- KALİTE: uygunsuz / fire defteri + iade kolonları + bakiye görünümü
--
-- kalite_hareketleri bir HAREKET DEFTERİ'dir (imzalı qty). Bakiyeler
-- saklanmaz, kalite_bakiye görünümünden türetilir (depolar migrasyonuyla
-- aynı yaklaşım: hareket ile bakiye arasında kopukluk olamaz).
--
-- stok_turu anlamları:
--   UYGUNSUZ : uygunsuz stok. +qty = uygunsuza girdi, -qty = kontrolle çıktı
--              (uygun / söküm / fire / dönüşüm kaynağı). Bakiye = SUM(qty).
--   FIRE     : fire (hurda). +qty = fire kaydı. Toplam = SUM(qty).
--   SAGLAM   : SADECE bilgi amaçlı denetim satırı (söküm sonrası sağlam
--              olarak iyi stoğa dönen parça). Hiçbir bakiyede toplanmaz.
-- =============================================================

-- ── 1. Defter tablosu ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kalite_hareketleri (
  id             TEXT PRIMARY KEY,                      -- KLT-000001 (next_id)
  tarih          DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Istanbul')::date,
  item_tipi      TEXT NOT NULL CHECK (item_tipi IN ('URUN','YARI_MAMUL','PLAKA')),
  item_id        TEXT NOT NULL,                         -- products.sku veya all_parts.part_id
  item_adi       TEXT,
  stok_turu      TEXT NOT NULL CHECK (stok_turu IN ('UYGUNSUZ','FIRE','SAGLAM')),
  qty            NUMERIC NOT NULL,                      -- işaretli
  islem          TEXT NOT NULL CHECK (islem IN (
                   'giris','kontrol_uygun','sokum','sokum_saglam','sokum_fire',
                   'donusum_kaynak','donusum_hedef','fire_giris')),
  kaynak         TEXT CHECK (kaynak IN ('iade','paketleme','montaj','kesim','stok','kontrol')),
  source_id      TEXT,
  parent_id      TEXT,
  step_id        TEXT,
  depo_id        TEXT,
  operator_id    TEXT,
  operator_name  TEXT,
  kargo_firmasi  TEXT,
  musteri        TEXT,
  not_text       TEXT,
  created_by     UUID DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kalite_item    ON public.kalite_hareketleri (item_tipi, item_id);
CREATE INDEX IF NOT EXISTS idx_kalite_tarih   ON public.kalite_hareketleri (tarih);
CREATE INDEX IF NOT EXISTS idx_kalite_kaynak  ON public.kalite_hareketleri (kaynak);
CREATE INDEX IF NOT EXISTS idx_kalite_islem   ON public.kalite_hareketleri (islem);

ALTER TABLE public.kalite_hareketleri ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kalite oku"   ON public.kalite_hareketleri;
DROP POLICY IF EXISTS "kalite yaz"   ON public.kalite_hareketleri;
DROP POLICY IF EXISTS "kalite duzelt" ON public.kalite_hareketleri;
DROP POLICY IF EXISTS "kalite sil"   ON public.kalite_hareketleri;

CREATE POLICY "kalite oku" ON public.kalite_hareketleri
  FOR SELECT TO authenticated
  USING (public.has_production_access() OR public.has_stock_access());
CREATE POLICY "kalite yaz" ON public.kalite_hareketleri
  FOR INSERT TO authenticated
  WITH CHECK (public.has_production_access() OR public.has_stock_access());
CREATE POLICY "kalite duzelt" ON public.kalite_hareketleri
  FOR UPDATE TO authenticated
  USING (public.is_admin_or_engineer()) WITH CHECK (public.is_admin_or_engineer());
CREATE POLICY "kalite sil" ON public.kalite_hareketleri
  FOR DELETE TO authenticated
  USING (public.is_admin_or_engineer());

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.kalite_hareketleri;
EXCEPTION WHEN OTHERS THEN
  NULL; -- publication yok / tablo zaten ekli
END $$;

-- ── 2. İade girişi yeni kolonlar ─────────────────────────────
ALTER TABLE public.iade_giris
  ADD COLUMN IF NOT EXISTS kargo_firmasi  TEXT,
  ADD COLUMN IF NOT EXISTS siparis_no     TEXT,
  ADD COLUMN IF NOT EXISTS kontrol_durumu TEXT;

-- ── 3. Bakiye görünümü ───────────────────────────────────────
-- SAGLAM satırları hiçbir toplamda yer almaz.
CREATE OR REPLACE VIEW public.kalite_bakiye
WITH (security_invoker = true) AS
SELECT
  k.item_tipi,
  k.item_id,
  (array_agg(k.item_adi ORDER BY k.created_at DESC) FILTER (WHERE k.item_adi IS NOT NULL))[1] AS item_adi,
  COALESCE(sum(k.qty) FILTER (WHERE k.stok_turu = 'UYGUNSUZ'), 0)            AS uygunsuz_bakiye,
  COALESCE(sum(k.qty) FILTER (WHERE k.stok_turu = 'FIRE'), 0)                AS fire_toplam,
  COALESCE(sum(abs(k.qty)) FILTER (WHERE k.stok_turu = 'UYGUNSUZ' AND k.qty < 0), 0) AS kontrol_edilen_toplam
FROM public.kalite_hareketleri k
GROUP BY k.item_tipi, k.item_id;

GRANT SELECT ON public.kalite_bakiye TO authenticated;

-- ── 4. Ürünün yarı mamul / hazır eleman dökümü ───────────────
-- BOM DAG semantiği: step_bom.part_id 'ASM-…' ise başka bir adımın çıktısıdır.
-- Bir ürünün adımları genelde zincir oluşturur (son adım önceki adımların
-- ASM çıktılarını tüketir). Her adımın doğrudan parçalarını toplamak
-- ASM çıktısı birden fazla adet tüketildiğinde (qty_per > 1) yanlış olur,
-- zincir kökünden çarpanla inmek ise her durumda doğrudur. Bu yüzden:
--   * kökler = ürünün KENDİ adımlarından, aynı ürünün başka bir adımı
--     tarafından ASM referansıyla tüketilmeyenler (genelde son adım;
--     zincir olmayan bağımsız adımlar da kök sayılır, hepsi toplanır),
--   * kökten aşağı ASM referansları çarpan (qty_per) ile özyinelemeli
--     açılır; referans başka bir ürünün adımına işaret ediyorsa o adımın
--     alt ağacı da aynı kurala göre açılır,
--   * yalnızca ASM olmayan, all_parts'ta bulunan YARIMAMUL ve HAZIR
--     parçalar döner (kutu/karton söküme konu değil),
--   * derinlik koruması 12 (döngüye karşı).
CREATE OR REPLACE FUNCTION public.urun_yari_mamul_listesi(p_sku TEXT)
RETURNS TABLE (part_id TEXT, part_adi TEXT, part_type TEXT, qty_per NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE roots AS (
    SELECT s.step_id
    FROM assembly_steps s
    WHERE s.sku = p_sku
      AND NOT EXISTS (
        SELECT 1
        FROM step_bom b
        JOIN assembly_steps s2 ON s2.step_id = b.step_id
        WHERE b.part_id = s.step_id
          AND s2.sku = p_sku
          AND s2.step_id <> s.step_id
      )
  ),
  tree (step_id, mult, depth) AS (
    SELECT r.step_id, 1::numeric, 0 FROM roots r
    UNION ALL
    SELECT b.part_id, t.mult * b.qty_per, t.depth + 1
    FROM tree t
    JOIN step_bom b ON b.step_id = t.step_id
    WHERE b.part_id LIKE 'ASM-%' AND t.depth < 12
  )
  SELECT p.part_id,
         p.part_adi,
         p.part_type::text,
         sum(t.mult * b.qty_per) AS qty_per
  FROM tree t
  JOIN step_bom b ON b.step_id = t.step_id AND b.part_id NOT LIKE 'ASM-%'
  JOIN all_parts p ON p.part_id = b.part_id
  WHERE p.part_type IN ('YARIMAMUL','HAZIR')
  GROUP BY p.part_id, p.part_adi, p.part_type
  ORDER BY p.part_type DESC, p.part_id;
$$;

GRANT EXECUTE ON FUNCTION public.urun_yari_mamul_listesi(TEXT) TO authenticated;

-- ── 5. İç yardımcılar (istemciye açılmaz) ────────────────────
CREATE OR REPLACE FUNCTION public._klt_auth()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_production_access() OR public.has_stock_access()) THEN
    RAISE EXCEPTION 'Yetkisiz';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._klt_item_adi(p_tipi TEXT, p_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v TEXT;
BEGIN
  IF p_tipi = 'URUN' THEN
    SELECT urun_adi INTO v FROM products WHERE sku = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Ürün bulunamadı: %', p_id; END IF;
  ELSE
    SELECT part_adi INTO v FROM all_parts WHERE part_id = p_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Parça bulunamadı: %', p_id; END IF;
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public._klt_bakiye(p_tipi TEXT, p_id TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(sum(qty), 0) FROM kalite_hareketleri
  WHERE item_tipi = p_tipi AND item_id = p_id AND stok_turu = 'UYGUNSUZ';
$$;

-- Aynı kalem için eşzamanlı kontrol işlemlerini sıraya sokar, sonra bakiyeyi doğrular
CREATE OR REPLACE FUNCTION public._klt_bakiye_kontrol(p_tipi TEXT, p_id TEXT, p_qty NUMERIC)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v NUMERIC;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('klt:' || p_tipi || ':' || p_id));
  v := public._klt_bakiye(p_tipi, p_id);
  IF v < p_qty THEN
    RAISE EXCEPTION 'Uygunsuz bakiye yetersiz (% mevcut, % isteniyor)', v, p_qty;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._klt_ledger(
  p_tipi TEXT, p_id TEXT, p_adi TEXT, p_stok_turu TEXT, p_qty NUMERIC, p_islem TEXT,
  p_kaynak TEXT, p_source_id TEXT, p_parent_id TEXT, p_step_id TEXT, p_depo_id TEXT,
  p_op_id TEXT, p_op_name TEXT, p_kargo TEXT, p_musteri TEXT, p_not TEXT
) RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_id TEXT;
BEGIN
  v_id := public.next_id('KLT-', 6);
  INSERT INTO kalite_hareketleri (
    id, item_tipi, item_id, item_adi, stok_turu, qty, islem, kaynak, source_id, parent_id,
    step_id, depo_id, operator_id, operator_name, kargo_firmasi, musteri, not_text
  ) VALUES (
    v_id, p_tipi, p_id, p_adi, p_stok_turu, p_qty, p_islem, p_kaynak, p_source_id, p_parent_id,
    p_step_id, p_depo_id, p_op_id, p_op_name, p_kargo, p_musteri, p_not
  );
  RETURN v_id;
END;
$$;

-- Mamül stok hareketi (+ products.stok_aktif). p_qty işaretli.
CREATE OR REPLACE FUNCTION public._klt_urun_hareket(
  p_sku TEXT, p_qty NUMERIC, p_source TEXT, p_source_row_id TEXT, p_depo_id TEXT
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO stock_movements (mov_id, tarih, sku, qty, source, source_row_id, batch_id, depo_id)
  VALUES (public.next_id('SM-', 6), now(), p_sku, p_qty, p_source, p_source_row_id, p_source_row_id,
          NULLIF(p_depo_id, ''));
  UPDATE products SET stok_aktif = COALESCE(stok_aktif, 0) + round(p_qty)::int WHERE sku = p_sku;
END;
$$;

-- Yarı mamul stok hareketi (bakiye tetikleyicisi all_parts'ı günceller)
CREATE OR REPLACE FUNCTION public._klt_ym_hareket(
  p_part_id TEXT, p_qty NUMERIC, p_direction TEXT, p_source TEXT, p_source_id TEXT, p_operator TEXT
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO yari_mamul_stok (yms_id, tarih, part_id, part_adi, qty, direction, source, source_id, operator)
  VALUES (public.next_id('YMS-', 6), now(), p_part_id,
          (SELECT part_adi FROM all_parts WHERE part_id = p_part_id),
          abs(p_qty), p_direction, p_source, p_source_id, p_operator);
END;
$$;

-- Hazır eleman / MDF stok hareketi. p_delta işaretli.
CREATE OR REPLACE FUNCTION public._klt_hazir_hareket(
  p_part_id TEXT, p_delta NUMERIC, p_operator TEXT, p_not TEXT
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  UPDATE all_parts SET hazir_eleman_aktif_stok = COALESCE(hazir_eleman_aktif_stok, 0) + p_delta
  WHERE part_id = p_part_id;
  INSERT INTO hazir_eleman_akis (hakis_id, tarih, part_id, qty, operator, not_text)
  VALUES (public.next_id('HAK-', 6), now(), p_part_id, p_delta, p_operator, p_not);
END;
$$;

REVOKE ALL ON FUNCTION public._klt_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public._klt_item_adi(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._klt_bakiye(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._klt_bakiye_kontrol(TEXT, TEXT, NUMERIC) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._klt_ledger(TEXT,TEXT,TEXT,TEXT,NUMERIC,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._klt_urun_hareket(TEXT, NUMERIC, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._klt_ym_hareket(TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._klt_hazir_hareket(TEXT, NUMERIC, TEXT, TEXT) FROM PUBLIC;
-- İç fonksiyonlar yalnızca SECURITY DEFINER RPC'ler (postgres sahibi) içinden çağrılır.
-- _klt_auth hariç hepsi SECURITY INVOKER; RPC'ler definer olduğundan RLS'i aşarlar.

-- ── 6. RPC: uygunsuz giriş ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.kalite_uygunsuz_giris(
  p_item_tipi TEXT, p_item_id TEXT, p_qty NUMERIC, p_kaynak TEXT,
  p_stoktan_dus BOOLEAN DEFAULT FALSE, p_depo_id TEXT DEFAULT NULL, p_source_id TEXT DEFAULT NULL,
  p_operator_id TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL,
  p_kargo TEXT DEFAULT NULL, p_musteri TEXT DEFAULT NULL, p_not TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adi TEXT;
  v_id  TEXT;
  v_ref TEXT;
BEGIN
  PERFORM public._klt_auth();
  IF p_item_tipi NOT IN ('URUN','YARI_MAMUL') THEN RAISE EXCEPTION 'Geçersiz kalem tipi'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Miktar 0''dan büyük olmalı'; END IF;
  v_adi := public._klt_item_adi(p_item_tipi, p_item_id);

  v_id := public.next_id('KLT-', 6);
  v_ref := COALESCE(p_source_id, v_id);

  IF p_stoktan_dus THEN
    IF p_item_tipi = 'URUN' THEN
      PERFORM public._klt_urun_hareket(p_item_id, -p_qty, 'Uygunsuz', v_ref, p_depo_id);
    ELSE
      PERFORM public._klt_ym_hareket(p_item_id, p_qty, 'OUT', 'Uygunsuz', v_ref, p_operator_id);
    END IF;
  END IF;

  INSERT INTO kalite_hareketleri (
    id, item_tipi, item_id, item_adi, stok_turu, qty, islem, kaynak, source_id,
    depo_id, operator_id, operator_name, kargo_firmasi, musteri, not_text
  ) VALUES (
    v_id, p_item_tipi, p_item_id, v_adi, 'UYGUNSUZ', p_qty, 'giris', p_kaynak, p_source_id,
    p_depo_id, p_operator_id, p_operator_name, p_kargo, p_musteri, p_not
  );

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ── 7. RPC: kontrol → uygun ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.kalite_kontrol_uygun(
  p_item_tipi TEXT, p_item_id TEXT, p_qty NUMERIC, p_depo_id TEXT DEFAULT NULL,
  p_operator_id TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL, p_not TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adi TEXT;
  v_id  TEXT;
BEGIN
  PERFORM public._klt_auth();
  IF p_item_tipi NOT IN ('URUN','YARI_MAMUL') THEN RAISE EXCEPTION 'Geçersiz kalem tipi'; END IF;
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Miktar 0''dan büyük olmalı'; END IF;
  v_adi := public._klt_item_adi(p_item_tipi, p_item_id);
  PERFORM public._klt_bakiye_kontrol(p_item_tipi, p_item_id, p_qty);

  v_id := public._klt_ledger(p_item_tipi, p_item_id, v_adi, 'UYGUNSUZ', -p_qty, 'kontrol_uygun',
                             'kontrol', NULL, NULL, NULL, p_depo_id, p_operator_id, p_operator_name,
                             NULL, NULL, p_not);

  IF p_item_tipi = 'URUN' THEN
    PERFORM public._klt_urun_hareket(p_item_id, p_qty, 'Kontrol-Uygun', v_id, p_depo_id);
  ELSE
    PERFORM public._klt_ym_hareket(p_item_id, p_qty, 'IN', 'Kontrol-Uygun', v_id, p_operator_id);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ── 8. RPC: söküm ────────────────────────────────────────────
-- p_parts: [{"part_id": "...", "saglam": n, "fire": n}, ...]
-- Beklenen = qty_per * p_qty. Kalan = beklenen - sağlam - fire:
--   YARIMAMUL kalan -> UYGUNSUZ yarı mamul,
--   HAZIR kalan     -> fire sayılır (hazır elemanın uygunsuz stoğu yok).
CREATE OR REPLACE FUNCTION public.kalite_sokum(
  p_sku TEXT, p_qty NUMERIC, p_parts JSONB DEFAULT '[]'::jsonb,
  p_operator_id TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL, p_not TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adi    TEXT;
  v_parent TEXT;
  r        RECORD;
  e        JSONB;
  v_exp    NUMERIC;
  v_sag    NUMERIC;
  v_fire   NUMERIC;
  v_kalan  NUMERIC;
  v_known  TEXT[];
BEGIN
  PERFORM public._klt_auth();
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Miktar 0''dan büyük olmalı'; END IF;
  v_adi := public._klt_item_adi('URUN', p_sku);
  PERFORM public._klt_bakiye_kontrol('URUN', p_sku, p_qty);

  SELECT array_agg(x.part_id) INTO v_known FROM public.urun_yari_mamul_listesi(p_sku) x;
  IF v_known IS NULL THEN RAISE EXCEPTION 'Ürünün sökülebilir parça listesi boş'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_parts, '[]'::jsonb)) LOOP
    IF NOT ((e->>'part_id') = ANY (v_known)) THEN
      RAISE EXCEPTION 'Parça ürünün reçetesinde yok: %', e->>'part_id';
    END IF;
  END LOOP;

  v_parent := public._klt_ledger('URUN', p_sku, v_adi, 'UYGUNSUZ', -p_qty, 'sokum', 'kontrol',
                                 NULL, NULL, NULL, NULL, p_operator_id, p_operator_name, NULL, NULL, p_not);

  FOR r IN SELECT * FROM public.urun_yari_mamul_listesi(p_sku) LOOP
    v_exp  := r.qty_per * p_qty;
    v_sag  := 0;
    v_fire := 0;
    SELECT COALESCE(sum(COALESCE((x->>'saglam')::numeric, 0)), 0),
           COALESCE(sum(COALESCE((x->>'fire')::numeric, 0)), 0)
      INTO v_sag, v_fire
      FROM jsonb_array_elements(COALESCE(p_parts, '[]'::jsonb)) x
      WHERE x->>'part_id' = r.part_id;
    IF v_sag < 0 OR v_fire < 0 THEN RAISE EXCEPTION 'Negatif miktar girilemez (%)', r.part_id; END IF;
    IF v_sag + v_fire > v_exp THEN
      RAISE EXCEPTION 'Sağlam + fire beklenenden fazla (%: beklenen %, girilen %)', r.part_id, v_exp, v_sag + v_fire;
    END IF;
    v_kalan := greatest(v_exp - v_sag - v_fire, 0);

    IF v_sag > 0 THEN
      IF r.part_type = 'YARIMAMUL' THEN
        PERFORM public._klt_ym_hareket(r.part_id, v_sag, 'IN', 'Söküm', v_parent, p_operator_id);
      ELSE
        PERFORM public._klt_hazir_hareket(r.part_id, v_sag, p_operator_id, 'Söküm — ' || p_sku || ' ' || v_parent);
      END IF;
      PERFORM public._klt_ledger('YARI_MAMUL', r.part_id, r.part_adi, 'SAGLAM', v_sag, 'sokum_saglam',
                                 'kontrol', v_parent, v_parent, NULL, NULL, p_operator_id, p_operator_name,
                                 NULL, NULL, 'Söküm: ' || p_sku);
    END IF;

    IF v_fire > 0 THEN
      PERFORM public._klt_ledger('YARI_MAMUL', r.part_id, r.part_adi, 'FIRE', v_fire, 'sokum_fire',
                                 'kontrol', v_parent, v_parent, NULL, NULL, p_operator_id, p_operator_name,
                                 NULL, NULL, 'Söküm: ' || p_sku);
    END IF;

    IF v_kalan > 0 THEN
      IF r.part_type = 'YARIMAMUL' THEN
        PERFORM public._klt_ledger('YARI_MAMUL', r.part_id, r.part_adi, 'UYGUNSUZ', v_kalan, 'giris',
                                   'kontrol', v_parent, v_parent, NULL, NULL, p_operator_id, p_operator_name,
                                   NULL, NULL, 'Söküm kalanı: ' || p_sku);
      ELSE
        PERFORM public._klt_ledger('YARI_MAMUL', r.part_id, r.part_adi, 'FIRE', v_kalan, 'sokum_fire',
                                   'kontrol', v_parent, v_parent, NULL, NULL, p_operator_id, p_operator_name,
                                   NULL, NULL, 'Söküm kalanı (hazır eleman) fire sayıldı: ' || p_sku);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_parent);
END;
$$;

-- ── 9. RPC: fire girişi ──────────────────────────────────────
-- URUN + p_parts [{part_id, qty}] : ürünün parçaları ayrı ayrı fire (p_qty yok sayılır)
-- URUN (parçasız) / YARI_MAMUL    : tek kalem fire
-- PLAKA                            : item_id = MDF part_id; hazir_eleman stoktan düşer
-- p_from_uygunsuz = true           : uygunsuz bakiyeden fire'a (kontrolden fire)
CREATE OR REPLACE FUNCTION public.kalite_fire_giris(
  p_item_tipi TEXT, p_item_id TEXT, p_qty NUMERIC DEFAULT NULL, p_kaynak TEXT DEFAULT 'stok',
  p_stoktan_dus BOOLEAN DEFAULT TRUE, p_depo_id TEXT DEFAULT NULL, p_parts JSONB DEFAULT NULL,
  p_from_uygunsuz BOOLEAN DEFAULT FALSE,
  p_operator_id TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL, p_not TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adi  TEXT;
  v_id   TEXT;
  e      JSONB;
  v_pid  TEXT;
  v_pq   NUMERIC;
  v_ptip TEXT;
  v_n    INT := 0;
BEGIN
  PERFORM public._klt_auth();
  IF p_item_tipi NOT IN ('URUN','YARI_MAMUL','PLAKA') THEN RAISE EXCEPTION 'Geçersiz kalem tipi'; END IF;
  v_adi := public._klt_item_adi(p_item_tipi, p_item_id);

  -- Ürün + parça listesi
  IF p_item_tipi = 'URUN' AND p_parts IS NOT NULL AND jsonb_array_length(p_parts) > 0 THEN
    IF p_from_uygunsuz THEN RAISE EXCEPTION 'Uygunsuzdan fire parçasız girilmelidir'; END IF;
    FOR e IN SELECT * FROM jsonb_array_elements(p_parts) LOOP
      v_pid := e->>'part_id';
      v_pq  := COALESCE((e->>'qty')::numeric, 0);
      IF v_pq < 0 THEN RAISE EXCEPTION 'Negatif miktar girilemez'; END IF;
      CONTINUE WHEN v_pq = 0;
      SELECT part_type::text INTO v_ptip FROM all_parts WHERE part_id = v_pid;
      IF NOT FOUND THEN RAISE EXCEPTION 'Parça bulunamadı: %', v_pid; END IF;
      v_id := public._klt_ledger('YARI_MAMUL', v_pid, (SELECT part_adi FROM all_parts WHERE part_id = v_pid),
                                 'FIRE', v_pq, 'fire_giris', p_kaynak, NULL, p_item_id, NULL, p_depo_id,
                                 p_operator_id, p_operator_name, NULL, NULL,
                                 COALESCE(p_not, '') || ' [Ürün: ' || p_item_id || ']');
      IF p_stoktan_dus THEN
        IF v_ptip = 'YARIMAMUL' THEN
          PERFORM public._klt_ym_hareket(v_pid, v_pq, 'OUT', 'Fire', v_id, p_operator_id);
        ELSE
          PERFORM public._klt_hazir_hareket(v_pid, -v_pq, p_operator_id, 'Fire — ' || p_item_id || ' ' || v_id);
        END IF;
      END IF;
      v_n := v_n + 1;
    END LOOP;
    IF v_n = 0 THEN RAISE EXCEPTION 'En az bir parçaya fire miktarı girin'; END IF;
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Miktar 0''dan büyük olmalı'; END IF;

  IF p_from_uygunsuz THEN
    IF p_item_tipi = 'PLAKA' THEN RAISE EXCEPTION 'Plaka uygunsuz stoğa alınamaz'; END IF;
    PERFORM public._klt_bakiye_kontrol(p_item_tipi, p_item_id, p_qty);
    PERFORM public._klt_ledger(p_item_tipi, p_item_id, v_adi, 'UYGUNSUZ', -p_qty, 'fire_giris', 'kontrol',
                               NULL, NULL, NULL, NULL, p_operator_id, p_operator_name, NULL, NULL, p_not);
    v_id := public._klt_ledger(p_item_tipi, p_item_id, v_adi, 'FIRE', p_qty, 'fire_giris', 'kontrol',
                               NULL, NULL, NULL, NULL, p_operator_id, p_operator_name, NULL, NULL, p_not);
    RETURN jsonb_build_object('ok', true, 'id', v_id);
  END IF;

  v_id := public._klt_ledger(p_item_tipi, p_item_id, v_adi, 'FIRE', p_qty, 'fire_giris', p_kaynak,
                             NULL, NULL, NULL, p_depo_id, p_operator_id, p_operator_name, NULL, NULL, p_not);
  IF p_stoktan_dus THEN
    IF p_item_tipi = 'URUN' THEN
      PERFORM public._klt_urun_hareket(p_item_id, -p_qty, 'Fire', v_id, p_depo_id);
    ELSIF p_item_tipi = 'YARI_MAMUL' THEN
      PERFORM public._klt_ym_hareket(p_item_id, p_qty, 'OUT', 'Fire', v_id, p_operator_id);
    ELSE
      PERFORM public._klt_hazir_hareket(p_item_id, -p_qty, p_operator_id, 'Plaka Fire — ' || v_id);
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ── 10. RPC: yarı mamul dönüştürme (kesim) ───────────────────
CREATE OR REPLACE FUNCTION public.kalite_donusum(
  p_kaynak_part TEXT, p_kaynak_qty NUMERIC, p_hedef_part TEXT,
  p_uygun_qty NUMERIC DEFAULT 0, p_uygunsuz_qty NUMERIC DEFAULT 0,
  p_operator_id TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL, p_not TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kadi TEXT;
  v_hadi TEXT;
  v_id   TEXT;
BEGIN
  PERFORM public._klt_auth();
  IF p_kaynak_qty IS NULL OR p_kaynak_qty <= 0 THEN RAISE EXCEPTION 'Kaynak miktarı 0''dan büyük olmalı'; END IF;
  IF COALESCE(p_uygun_qty, 0) < 0 OR COALESCE(p_uygunsuz_qty, 0) < 0 THEN RAISE EXCEPTION 'Negatif miktar girilemez'; END IF;
  IF COALESCE(p_uygun_qty, 0) + COALESCE(p_uygunsuz_qty, 0) <= 0 THEN
    RAISE EXCEPTION 'Üretilen uygun veya uygunsuz miktar girin';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM all_parts WHERE part_id = p_kaynak_part AND part_type = 'YARIMAMUL') THEN
    RAISE EXCEPTION 'Kaynak yarı mamul bulunamadı';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM all_parts WHERE part_id = p_hedef_part AND part_type = 'YARIMAMUL') THEN
    RAISE EXCEPTION 'Hedef yarı mamul bulunamadı';
  END IF;
  v_kadi := public._klt_item_adi('YARI_MAMUL', p_kaynak_part);
  v_hadi := public._klt_item_adi('YARI_MAMUL', p_hedef_part);
  PERFORM public._klt_bakiye_kontrol('YARI_MAMUL', p_kaynak_part, p_kaynak_qty);

  v_id := public._klt_ledger('YARI_MAMUL', p_kaynak_part, v_kadi, 'UYGUNSUZ', -p_kaynak_qty, 'donusum_kaynak',
                             'kesim', NULL, NULL, NULL, NULL, p_operator_id, p_operator_name, NULL, NULL,
                             COALESCE(p_not, '') || ' → ' || p_hedef_part);

  IF COALESCE(p_uygun_qty, 0) > 0 THEN
    PERFORM public._klt_ym_hareket(p_hedef_part, p_uygun_qty, 'IN', 'Dönüşüm', v_id, p_operator_id);
  END IF;
  IF COALESCE(p_uygunsuz_qty, 0) > 0 THEN
    PERFORM public._klt_ledger('YARI_MAMUL', p_hedef_part, v_hadi, 'UYGUNSUZ', p_uygunsuz_qty, 'donusum_hedef',
                               'kesim', v_id, v_id, NULL, NULL, p_operator_id, p_operator_name, NULL, NULL,
                               COALESCE(p_not, '') || ' ← ' || p_kaynak_part);
  END IF;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- ── 11. RPC: montaj seans kapanışı fire ──────────────────────
-- p_parts: [{"part_id": "...", "qty": n}] — ek tüketim (fire), yalnızca YARIMAMUL
CREATE OR REPLACE FUNCTION public.kalite_montaj_fire(
  p_session_id TEXT, p_step_id TEXT, p_parts JSONB,
  p_operator_id TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  e      JSONB;
  v_pid  TEXT;
  v_pq   NUMERIC;
  v_sku  TEXT;
  v_id   TEXT;
  v_n    INT := 0;
BEGIN
  PERFORM public._klt_auth();
  SELECT sku INTO v_sku FROM assembly_steps WHERE step_id = p_step_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Montaj adımı bulunamadı'; END IF;

  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_parts, '[]'::jsonb)) LOOP
    v_pid := e->>'part_id';
    v_pq  := COALESCE((e->>'qty')::numeric, 0);
    IF v_pq < 0 THEN RAISE EXCEPTION 'Negatif miktar girilemez'; END IF;
    CONTINUE WHEN v_pq = 0;
    IF NOT EXISTS (
      SELECT 1 FROM step_bom b JOIN all_parts p ON p.part_id = b.part_id
      WHERE b.step_id = p_step_id AND b.part_id = v_pid AND p.part_type = 'YARIMAMUL'
    ) THEN
      RAISE EXCEPTION 'Parça bu adımın yarı mamulü değil: %', v_pid;
    END IF;
    v_id := public._klt_ledger('YARI_MAMUL', v_pid, (SELECT part_adi FROM all_parts WHERE part_id = v_pid),
                               'FIRE', v_pq, 'fire_giris', 'montaj', p_session_id, NULL, p_step_id, NULL,
                               p_operator_id, p_operator_name, NULL, NULL, 'Montaj fire — ' || COALESCE(v_sku, ''));
    INSERT INTO yari_mamul_stok (yms_id, tarih, part_id, part_adi, sku, qty, direction, source, source_id, operator)
    VALUES (public.next_id('YMS-', 6), now(), v_pid,
            (SELECT part_adi FROM all_parts WHERE part_id = v_pid),
            v_sku, v_pq, 'OUT', 'Montaj-Fire', p_session_id, p_operator_id);
    v_n := v_n + 1;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'adet', v_n);
END;
$$;

GRANT EXECUTE ON FUNCTION public.kalite_uygunsuz_giris(TEXT,TEXT,NUMERIC,TEXT,BOOLEAN,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kalite_kontrol_uygun(TEXT,TEXT,NUMERIC,TEXT,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kalite_sokum(TEXT,NUMERIC,JSONB,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kalite_fire_giris(TEXT,TEXT,NUMERIC,TEXT,BOOLEAN,TEXT,JSONB,BOOLEAN,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kalite_donusum(TEXT,NUMERIC,TEXT,NUMERIC,NUMERIC,TEXT,TEXT,TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.kalite_montaj_fire(TEXT,TEXT,JSONB,TEXT,TEXT) TO authenticated;
