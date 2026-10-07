-- =============================================================
-- 156: İş talimatı üretimi, talimatın VERİLDİĞİ andan itibaren sayılır
-- Önceden sayaç (sayac_baslangic NULL ise) plan haftasının başından başlıyordu;
-- hafta içinde sonradan verilen bir talimat, talimattan önce yapılmış üretimi de
-- sayıp anında "tamamlandı" olabiliyordu.
-- Kural:
--   * Yeni satır: sayac_baslangic = now() (haftadan önce oluşturulan kopyalarda
--     görünüm zaten greatest(hafta başı, sayac_baslangic) kullanır).
--   * Ürün (sku) veya plaka değişince sayaç yeniden başlar (farklı iş).
--   * Mevcut satırlar: sayac_baslangic boşsa oluşturulma zamanı yazılır.
-- talimat_satir_yeniden_aktif zaten sayac_baslangic = now() yazar.
-- =============================================================

CREATE OR REPLACE FUNCTION public.talimat_satir_sayac_ayarla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sayac_baslangic IS NULL THEN
      NEW.sayac_baslangic := now();
    END IF;
  ELSIF (NEW.sku IS DISTINCT FROM OLD.sku OR NEW.plaka_id IS DISTINCT FROM OLD.plaka_id)
        AND NEW.sayac_baslangic IS NOT DISTINCT FROM OLD.sayac_baslangic THEN
    NEW.sayac_baslangic := now();
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.talimat_satir_sayac_ayarla() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_talimat_satir_sayac ON public.talimat_satirlar;
CREATE TRIGGER trg_talimat_satir_sayac
  BEFORE INSERT OR UPDATE ON public.talimat_satirlar
  FOR EACH ROW EXECUTE FUNCTION public.talimat_satir_sayac_ayarla();

UPDATE public.talimat_satirlar
SET sayac_baslangic = created_at
WHERE sayac_baslangic IS NULL;
