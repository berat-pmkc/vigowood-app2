-- =============================================================
-- STOK DÜZENLEME (mamül, depo bazlı elle düzeltme) — Revizyon 2, madde 33
--
-- Önkoşul: 20260812090000_depolar.sql
--
-- Bir düzeltme = stock_movements'a kaynağı 'Stok Düzeltme' olan işaretli bir
-- hareket (depo_id dolu) + products.stok_aktif güncellemesi (tüm depoların
-- toplamı; depo_transfer / kalite helper'larıyla aynı desen). Gerekçe ve kimin
-- yaptığı stok_duzeltmeleri tablosunda tutulur; stock_movements.source_row_id
-- bu tablonun id'sidir (SDZ-000001).
--
-- Sayım penceresi 'Stok Düzeltme' hareketlerini hariç tutar (bkz. 111).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.stok_duzeltmeleri (
  id          TEXT PRIMARY KEY,                       -- SDZ-000001 (next_id)
  sku         TEXT NOT NULL,
  depo_id     TEXT NOT NULL REFERENCES public.depolar(depo_id),
  qty         NUMERIC NOT NULL CHECK (qty <> 0),      -- işaretli
  onceki      NUMERIC,                                -- düzeltme öncesi depo bakiyesi
  sonraki     NUMERIC,                                -- düzeltme sonrası depo bakiyesi
  neden       TEXT NOT NULL,
  created_by  UUID DEFAULT auth.uid(),
  user_id     TEXT,                                   -- users.user_id (görüntüleme için)
  user_adi    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stok_duzeltme_sku   ON public.stok_duzeltmeleri (sku, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stok_duzeltme_depo  ON public.stok_duzeltmeleri (depo_id);

ALTER TABLE public.stok_duzeltmeleri ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stok duzeltme oku" ON public.stok_duzeltmeleri;
CREATE POLICY "stok duzeltme oku" ON public.stok_duzeltmeleri
  FOR SELECT TO authenticated USING (public.has_stock_access());
-- INSERT/UPDATE/DELETE politikası yok: yalnızca stok_duzelt() (SECURITY DEFINER) yazar.

-- Ürün bazlı toplam düzeltme özeti (tüm zamanlar). security_invoker: stock_movements RLS'ini devralır.
CREATE OR REPLACE VIEW public.urun_stok_duzeltme_ozet
WITH (security_invoker = true) AS
SELECT m.sku,
       COALESCE(sum(m.qty) FILTER (WHERE m.qty > 0), 0)      AS toplam_artis,
       COALESCE(sum(abs(m.qty)) FILTER (WHERE m.qty < 0), 0) AS toplam_azalis,
       max(m.created_at)                                     AS son_duzeltme
FROM public.stock_movements m
WHERE m.source = 'Stok Düzeltme' AND m.sku IS NOT NULL
GROUP BY m.sku;

GRANT SELECT ON public.urun_stok_duzeltme_ozet TO authenticated;

-- ── RPC ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.stok_duzelt(
  p_sku TEXT, p_depo_id TEXT, p_qty NUMERIC, p_neden TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id      TEXT;
  v_onceki  NUMERIC;
  v_uid     TEXT;
  v_ad      TEXT;
BEGIN
  IF NOT public.has_stock_access() THEN RAISE EXCEPTION 'Yetkisiz'; END IF;
  IF p_qty IS NULL OR p_qty = 0 THEN RAISE EXCEPTION 'Düzeltme miktarı 0 olamaz'; END IF;
  IF p_neden IS NULL OR btrim(p_neden) = '' THEN RAISE EXCEPTION 'Düzeltme nedeni yazılmalıdır'; END IF;
  IF NOT EXISTS (SELECT 1 FROM products WHERE sku = p_sku) THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', p_sku;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM depolar WHERE depo_id = p_depo_id) THEN
    RAISE EXCEPTION 'Depo bulunamadı: %', p_depo_id;
  END IF;

  -- Aynı ürün üzerinde eşzamanlı düzeltmeleri sıraya sok
  PERFORM pg_advisory_xact_lock(hashtext('stokduz:' || p_sku));

  SELECT COALESCE(sum(qty), 0) INTO v_onceki
  FROM stock_movements WHERE sku = p_sku AND depo_id = p_depo_id;

  SELECT u.user_id, u.full_name INTO v_uid, v_ad FROM users u WHERE u.auth_id = auth.uid() LIMIT 1;

  v_id := public.next_id('SDZ-', 6);

  INSERT INTO stok_duzeltmeleri (id, sku, depo_id, qty, onceki, sonraki, neden, user_id, user_adi)
  VALUES (v_id, p_sku, p_depo_id, p_qty, v_onceki, v_onceki + p_qty, btrim(p_neden), v_uid, v_ad);

  -- stock_movements + products.stok_aktif (kalite helper'ı aynı işi yapar)
  PERFORM public._klt_urun_hareket(p_sku, p_qty, 'Stok Düzeltme', v_id, p_depo_id);

  RETURN jsonb_build_object('ok', true, 'id', v_id, 'onceki', v_onceki, 'sonraki', v_onceki + p_qty);
END;
$$;

REVOKE ALL ON FUNCTION public.stok_duzelt(TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.stok_duzelt(TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
