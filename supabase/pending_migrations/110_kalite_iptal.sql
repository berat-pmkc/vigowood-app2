-- =============================================================
-- KALİTE: kayıt iptali (Uygunsuz giriş / Kontrol kararı / Fire)  — Revizyon 2, madde 32
--
-- Önkoşul: 100_kalite_hareketleri.sql, 103_sokum_sadece_yari_mamul.sql
--
-- Tasarım:
--  * Defter SİLİNMEZ. İptal edilen satırlar iptal_edildi = true işaretlenir;
--    bakiye görünümü (kalite_bakiye) ve _klt_bakiye() bu satırları yok sayar.
--  * Stok yan etkileri (stock_movements / yari_mamul_stok / hazir_eleman_akis /
--    products.stok_aktif) silinmez; TERS HAREKET ('Kalite-İptal' kaynağı) yazılarak
--    geri alınır. Böylece geçmiş izlenebilir.
--  * Hangi stok satırının hangi defter satırından doğduğu mevcut referanslardan
--    bulunur (100'deki yardımcılar bunları zaten yazıyor):
--      stock_movements.source_row_id   = defter id   (Uygunsuz / Kontrol-Uygun / Fire)
--      yari_mamul_stok.source_id       = defter id   (Uygunsuz / Kontrol-Uygun / Fire /
--                                                     Söküm / Dönüşüm)
--      hazir_eleman_akis.not_text      = '... <defter id>' ile biter
--      yari_mamul_stok 'Montaj-Fire'   : source_id = seans, part_id + qty + aynı işlem
--    Ek güvenlik: stok satırının created_at'i defter satırıyla AYNI olmalı
--    (aynı işlem/transaction içinde yazıldıkları için now() aynıdır).
--  * İptal birimi ("grup"): seçilen satır + onunla birlikte doğan satırlar
--      - söküm / dönüşüm kaynağı : kendisi + parent_id = kendisi olan çocuklar
--      - çocuk satır seçilirse    : ebeveyni üzerinden aynı grup
--      - uygunsuzdan fire çifti   : UYGUNSUZ(-q) + FIRE(+q) birlikte
--      - diğerleri                : tek satır
--  * Yetki: is_admin_or_engineer() VEYA kaydı oluşturan (created_by = auth.uid())
--    ve kayıt 24 saatten genç.
--  * Koruma: iptal sonrası ilgili kalemin UYGUNSUZ bakiyesi eksiye düşecekse
--    (bakiye sonraki kontrol/söküm ile tüketilmişse) iptal reddedilir.
-- =============================================================

-- ── 1. Kolonlar ──────────────────────────────────────────────
ALTER TABLE public.kalite_hareketleri
  ADD COLUMN IF NOT EXISTS iptal_edildi  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS iptal_nedeni  TEXT,
  ADD COLUMN IF NOT EXISTS iptal_eden    UUID,
  ADD COLUMN IF NOT EXISTS iptal_tarihi  TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_kalite_iptal      ON public.kalite_hareketleri (iptal_edildi) WHERE iptal_edildi;
CREATE INDEX IF NOT EXISTS idx_kalite_created_by ON public.kalite_hareketleri (created_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kalite_parent     ON public.kalite_hareketleri (parent_id) WHERE parent_id IS NOT NULL;

-- ── 2. İptal edilmemiş hareketler görünümü ───────────────────
-- Analiz / raporlar kalite_hareketleri yerine bunu okumalıdır.
CREATE OR REPLACE VIEW public.kalite_hareketleri_aktif
WITH (security_invoker = true) AS
SELECT * FROM public.kalite_hareketleri WHERE NOT iptal_edildi;

GRANT SELECT ON public.kalite_hareketleri_aktif TO authenticated;

-- ── 3. Bakiye görünümü ve yardımcı: iptal satırlarını yok say ─
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
WHERE NOT k.iptal_edildi
GROUP BY k.item_tipi, k.item_id;

GRANT SELECT ON public.kalite_bakiye TO authenticated;

CREATE OR REPLACE FUNCTION public._klt_bakiye(p_tipi TEXT, p_id TEXT)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(sum(qty), 0) FROM kalite_hareketleri
  WHERE item_tipi = p_tipi AND item_id = p_id AND stok_turu = 'UYGUNSUZ' AND NOT iptal_edildi;
$$;

REVOKE ALL ON FUNCTION public._klt_bakiye(TEXT, TEXT) FROM PUBLIC;

-- ── 4. RPC: kalite_iptal ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.kalite_iptal(
  p_id TEXT, p_neden TEXT,
  p_operator_id TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_row     public.kalite_hareketleri%ROWTYPE;
  v_root    public.kalite_hareketleri%ROWTYPE;
  v_ids     TEXT[];
  v_ts      TIMESTAMPTZ;
  v_lock    RECORD;
  v_chk     RECORD;
  v_bal     NUMERIC;
  l         public.kalite_hareketleri%ROWTYPE;
  s         RECORD;
  v_n_stok  INT := 0;
  v_n_ym    INT := 0;
  v_n_haz   INT := 0;
  v_op      TEXT;
BEGIN
  PERFORM public._klt_auth();

  IF p_neden IS NULL OR btrim(p_neden) = '' THEN
    RAISE EXCEPTION 'İptal nedeni yazılmalıdır';
  END IF;

  SELECT * INTO v_row FROM kalite_hareketleri WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Kayıt bulunamadı: %', p_id; END IF;
  IF v_row.iptal_edildi THEN RAISE EXCEPTION 'Bu kayıt zaten iptal edilmiş'; END IF;

  -- Yetki
  IF NOT public.is_admin_or_engineer() THEN
    IF v_row.created_by IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'Yalnızca kendi oluşturduğunuz kaydı iptal edebilirsiniz';
    END IF;
    IF v_row.created_at < now() - interval '24 hours' THEN
      RAISE EXCEPTION '24 saatten eski kayıtları yalnızca yönetici veya mühendis iptal edebilir';
    END IF;
  END IF;

  -- Grubu belirle
  v_root := v_row;
  IF v_row.parent_id IS NOT NULL AND v_row.parent_id LIKE 'KLT-%' THEN
    SELECT * INTO v_root FROM kalite_hareketleri WHERE id = v_row.parent_id;
    IF NOT FOUND THEN v_root := v_row; END IF;
  END IF;

  v_ts := v_root.created_at;

  IF v_root.islem IN ('sokum', 'donusum_kaynak') OR v_root.id <> v_row.id THEN
    SELECT array_agg(k.id ORDER BY k.id) INTO v_ids
    FROM kalite_hareketleri k
    WHERE (k.id = v_root.id OR k.parent_id = v_root.id) AND NOT k.iptal_edildi;
  ELSIF v_row.islem = 'fire_giris' AND v_row.kaynak = 'kontrol' AND v_row.stok_turu IN ('UYGUNSUZ','FIRE') THEN
    -- Uygunsuzdan fire: aynı işlemde yazılan karşı satır
    SELECT array_agg(k.id ORDER BY k.id) INTO v_ids
    FROM kalite_hareketleri k
    WHERE NOT k.iptal_edildi
      AND (k.id = v_row.id OR (
            k.created_at = v_row.created_at
        AND k.created_by IS NOT DISTINCT FROM v_row.created_by
        AND k.item_tipi = v_row.item_tipi AND k.item_id = v_row.item_id
        AND k.islem = 'fire_giris' AND k.kaynak = 'kontrol'
        AND k.stok_turu <> v_row.stok_turu
        AND k.qty = -v_row.qty));
  ELSE
    v_ids := ARRAY[v_row.id];
  END IF;

  -- Aynı kalemler üzerinde eşzamanlı işlemleri sıraya sok (deadlock'u önlemek için sıralı)
  FOR v_lock IN
    SELECT DISTINCT k.item_tipi, k.item_id FROM kalite_hareketleri k
    WHERE k.id = ANY (v_ids) ORDER BY 1, 2
  LOOP
    PERFORM pg_advisory_xact_lock(hashtext('klt:' || v_lock.item_tipi || ':' || v_lock.item_id));
  END LOOP;

  -- Koruma: iptal sonrası uygunsuz bakiye eksiye düşmemeli
  FOR v_chk IN
    SELECT k.item_tipi, k.item_id, sum(k.qty) AS grup_net
    FROM kalite_hareketleri k
    WHERE k.id = ANY (v_ids) AND k.stok_turu = 'UYGUNSUZ'
    GROUP BY k.item_tipi, k.item_id
  LOOP
    v_bal := public._klt_bakiye(v_chk.item_tipi, v_chk.item_id);
    IF v_bal - v_chk.grup_net < 0 THEN
      RAISE EXCEPTION 'Bu kayıt iptal edilemez: % kaleminin uygunsuz bakiyesi sonraki kontrol/söküm/fire işlemlerinde kullanılmış (mevcut bakiye %, geri alınması gereken %). Önce o kontrol kayıtlarını iptal edin.',
        v_chk.item_id, v_bal, v_chk.grup_net;
    END IF;
  END LOOP;

  v_op := COALESCE(p_operator_id, v_row.operator_id);

  -- Ters stok hareketleri
  FOR l IN SELECT * FROM kalite_hareketleri k WHERE k.id = ANY (v_ids) ORDER BY k.id LOOP

    -- Mamül (stock_movements) — products.stok_aktif _klt_urun_hareket içinde düzelir
    FOR s IN
      SELECT m.sku, m.qty, m.depo_id
      FROM stock_movements m
      WHERE m.created_at = l.created_at
        AND m.source IN ('Uygunsuz', 'Kontrol-Uygun', 'Fire', 'Söküm')
        AND (m.source_row_id = l.id
             OR (l.source_id IS NOT NULL AND m.source_row_id = l.source_id AND m.sku = l.item_id))
    LOOP
      PERFORM public._klt_urun_hareket(s.sku, -s.qty, 'Kalite-İptal', v_row.id, s.depo_id);
      v_n_stok := v_n_stok + 1;
    END LOOP;

    -- Yarı mamul (yari_mamul_stok) — bakiye tetikleyicisi all_parts'ı günceller
    FOR s IN
      SELECT y.part_id, abs(y.qty) AS qty, y.direction
      FROM yari_mamul_stok y
      WHERE y.created_at = l.created_at
        AND y.source IN ('Uygunsuz', 'Kontrol-Uygun', 'Fire', 'Söküm', 'Dönüşüm')
        AND y.source_id = l.id
    LOOP
      PERFORM public._klt_ym_hareket(s.part_id, s.qty,
                CASE WHEN s.direction = 'IN' THEN 'OUT' ELSE 'IN' END,
                'Kalite-İptal', v_row.id, v_op);
      v_n_ym := v_n_ym + 1;
    END LOOP;

    -- Montaj fire (seans bazlı referans: parça + miktar + aynı işlem)
    IF l.kaynak = 'montaj' AND l.islem = 'fire_giris' AND l.stok_turu = 'FIRE' THEN
      FOR s IN
        SELECT y.part_id, abs(y.qty) AS qty, y.direction
        FROM yari_mamul_stok y
        WHERE y.created_at = l.created_at
          AND y.source = 'Montaj-Fire'
          AND y.source_id IS NOT DISTINCT FROM l.source_id
          AND y.part_id = l.item_id
          AND abs(y.qty) = abs(l.qty)
        LIMIT 1
      LOOP
        PERFORM public._klt_ym_hareket(s.part_id, s.qty,
                  CASE WHEN s.direction = 'IN' THEN 'OUT' ELSE 'IN' END,
                  'Kalite-İptal', v_row.id, v_op);
        v_n_ym := v_n_ym + 1;
      END LOOP;
    END IF;

    -- Hazır eleman / MDF (hazir_eleman_akis) — not_text defter id ile biter
    FOR s IN
      SELECT h.part_id, h.qty
      FROM hazir_eleman_akis h
      WHERE h.created_at = l.created_at
        AND h.not_text IS NOT NULL
        AND right(h.not_text, length(l.id)) = l.id
        AND (h.not_text LIKE 'Fire — %' OR h.not_text LIKE 'Plaka Fire — %' OR h.not_text LIKE 'Söküm — %')
    LOOP
      PERFORM public._klt_hazir_hareket(s.part_id, -s.qty, v_op, 'Kalite-İptal — ' || v_row.id);
      v_n_haz := v_n_haz + 1;
    END LOOP;
  END LOOP;

  -- Defter satırlarını iptal işaretle
  UPDATE kalite_hareketleri
  SET iptal_edildi = TRUE,
      iptal_nedeni = btrim(p_neden),
      iptal_eden   = v_uid,
      iptal_tarihi = now()
  WHERE id = ANY (v_ids);

  RETURN jsonb_build_object(
    'ok', true, 'id', v_row.id, 'iptal_edilen', v_ids,
    'ters_stok_hareketi', v_n_stok, 'ters_yarimamul_hareketi', v_n_ym, 'ters_hazir_hareketi', v_n_haz
  );
END;
$$;

REVOKE ALL ON FUNCTION public.kalite_iptal(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kalite_iptal(TEXT, TEXT, TEXT, TEXT) TO authenticated;
