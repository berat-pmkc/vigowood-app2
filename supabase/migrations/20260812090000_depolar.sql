-- =============================================================
-- DEPOLAR — mamül (bitmiş ürün) stoğu depo bazında
--
-- Üç fiziksel depo var: Amazon yurtiçi, yurtiçi stok, yurtdışı stok.
-- "Ana depo" ayrı bir kayıt DEĞİL; üçünün toplamı olan görünüm.
-- Ayrı bir satır açılsaydı hem depolara hem ana depoya yazmak gerekir,
-- ikisi er geç birbirinden kopardı.
--
-- Bakiye nerede tutuluyor:
-- Depo bazlı miktar SAKLANMIYOR, stock_movements'tan türetiliyor
-- (urun_depo_stok görünümü). Böylece hareketlerle bakiye arasında
-- tutarsızlık matematiksel olarak imkânsız. Yarı mamül tarafında tam
-- tersi yapılmıştı — bakiye ayrı kolonda tutuluyordu ve hareketlerle
-- uyuşmayıp eksiye düşmüştü.
--
-- products.stok_aktif korunuyor: tüm depoların toplamı anlamında,
-- mevcut ekranlar bozulmasın diye.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.depolar (
  depo_id    TEXT PRIMARY KEY,
  ad         TEXT NOT NULL,
  aciklama   TEXT,
  -- Listelerde ve seçim ekranlarında görünme sırası
  sira       SMALLINT NOT NULL DEFAULT 0,
  aktif      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.depolar (depo_id, ad, aciklama, sira) VALUES
  ('AMAZON-TR', 'Amazon Yurtiçi Depo', 'Amazon TR fulfillment için ayrılan ürünler', 1),
  ('YURTICI',   'Yurtiçi Stok',        'Yurtiçi satış ve pazaryerleri', 2),
  ('YURTDISI',  'Yurtdışı Ürün Stoğu', 'İhracat ve konteyner sevkiyatı', 3)
ON CONFLICT (depo_id) DO NOTHING;

DROP TRIGGER IF EXISTS set_depolar_updated_at ON public.depolar;
CREATE TRIGGER set_depolar_updated_at
  BEFORE UPDATE ON public.depolar
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ── Hareketlere depo bilgisi ─────────────────────────────────
-- NULL = depo seçilmemiş (eski kayıtlar ve depo öncesi hareketler).
-- Zorunlu yapılmadı: geçmiş veride depo bilgisi yok ve uydurmak
-- yanlış olurdu.
ALTER TABLE public.stock_movements
  ADD COLUMN IF NOT EXISTS depo_id TEXT REFERENCES public.depolar(depo_id);

CREATE INDEX IF NOT EXISTS idx_stock_movements_depo
  ON public.stock_movements (depo_id, sku);
CREATE INDEX IF NOT EXISTS idx_stock_movements_sku_tarih
  ON public.stock_movements (sku, tarih DESC);

-- Paketleme seansı hangi depoya girdi
ALTER TABLE public.pack_events
  ADD COLUMN IF NOT EXISTS depo_id TEXT REFERENCES public.depolar(depo_id);

-- ── Türetilmiş bakiyeler ─────────────────────────────────────
-- Depo bazlı: sku x depo
CREATE OR REPLACE VIEW public.urun_depo_stok AS
SELECT m.sku,
       m.depo_id,
       d.ad         AS depo_adi,
       d.sira       AS depo_sira,
       sum(m.qty)   AS miktar,
       max(m.tarih) AS son_hareket
FROM public.stock_movements m
LEFT JOIN public.depolar d ON d.depo_id = m.depo_id
WHERE m.sku IS NOT NULL
GROUP BY m.sku, m.depo_id, d.ad, d.sira;

-- Ana depo: tüm depoların toplamı (depo_id NULL olanlar dahil)
CREATE OR REPLACE VIEW public.urun_toplam_stok AS
SELECT m.sku,
       sum(m.qty)   AS miktar,
       max(m.tarih) AS son_hareket
FROM public.stock_movements m
WHERE m.sku IS NOT NULL
GROUP BY m.sku;

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.depolar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "depo oku"  ON public.depolar;
DROP POLICY IF EXISTS "depo yaz"  ON public.depolar;
DROP POLICY IF EXISTS "depo sil"  ON public.depolar;
CREATE POLICY "depo oku" ON public.depolar
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "depo yaz" ON public.depolar
  FOR ALL TO authenticated USING (public.is_admin_or_engineer())
  WITH CHECK (public.is_admin_or_engineer());

-- Görünümler tabloların RLS'ini devralsın (tanımlayanın değil)
ALTER VIEW public.urun_depo_stok   SET (security_invoker = true);
ALTER VIEW public.urun_toplam_stok SET (security_invoker = true);

GRANT SELECT ON public.urun_depo_stok   TO authenticated;
GRANT SELECT ON public.urun_toplam_stok TO authenticated;

-- ── Depolar arası transfer ───────────────────────────────────
-- Transfer iki harekettir: çıkış deposundan eksi, giriş deposuna artı.
-- Tek fonksiyonda yapılıyor ki yarım kalmasın.
CREATE OR REPLACE FUNCTION public.depo_transfer(
  p_sku TEXT, p_kaynak TEXT, p_hedef TEXT, p_miktar NUMERIC, p_not TEXT DEFAULT NULL
) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_mevcut NUMERIC;
  v_id TEXT;
BEGIN
  IF p_miktar IS NULL OR p_miktar <= 0 THEN
    RAISE EXCEPTION 'Transfer miktarı sıfırdan büyük olmalı';
  END IF;
  IF p_kaynak = p_hedef THEN
    RAISE EXCEPTION 'Kaynak ve hedef depo aynı olamaz';
  END IF;

  SELECT COALESCE(sum(qty),0) INTO v_mevcut
  FROM stock_movements WHERE sku = p_sku AND depo_id = p_kaynak;

  IF v_mevcut < p_miktar THEN
    RAISE EXCEPTION 'Kaynak depoda yeterli stok yok (mevcut: %, istenen: %)',
      v_mevcut, p_miktar;
  END IF;

  v_id := 'TRF-' || to_char(now(),'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text),1,6);

  INSERT INTO stock_movements (mov_id, tarih, sku, qty, source, source_row_id, depo_id)
  VALUES (v_id || '-C', now(), p_sku, -p_miktar, 'Transfer', COALESCE(p_not, v_id), p_kaynak),
         (v_id || '-G', now(), p_sku,  p_miktar, 'Transfer', COALESCE(p_not, v_id), p_hedef);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.depo_transfer(TEXT,TEXT,TEXT,NUMERIC,TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.depo_transfer(TEXT,TEXT,TEXT,NUMERIC,TEXT) TO authenticated;
