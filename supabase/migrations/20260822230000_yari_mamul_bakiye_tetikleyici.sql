-- =============================================================
-- Yarı mamül bakiyesi defterle senkron tutulsun
--
-- SORUN: yari_mamul_stok bir HAREKET DEFTERİ (IN/OUT satırları), buna
-- karşılık all_parts.yari_mamul_stok bir BAKİYE kolonu. Ekranlar ve
-- stok sayımı bakiye kolonunu okuyor ama bu kolonu güncelleyen hiçbir
-- şey yoktu: kesim IN yazıyor, montaj OUT yazıyor, bakiye 0'da kalıyordu.
--
-- Ölçüldü: defterin neti 493, bakiye kolonunun toplamı 0. Yani "Yarı
-- Mamül" ekranındaki bütün kalemler sıfır görünüyordu ve stok sayımı da
-- sistem miktarını sıfır alıyordu.
--
-- ÇÖZÜM: deftere her dokunuşta ilgili parçanın bakiyesi yeniden
-- hesaplanıyor. Artımlı toplama yerine yeniden hesap tercih edildi;
-- silme/güncelleme/geri alma durumlarında da kendini toparlar, kayma
-- birikmez.
--
-- qty her zaman pozitif, yön direction kolonunda tutuluyor. Yine de
-- abs() kullanılıyor: ileride negatif qty ile OUT yazan bir kod
-- eklenirse işaret iki kez uygulanıp bakiye ters dönmesin.
-- =============================================================

CREATE OR REPLACE FUNCTION public.yari_mamul_bakiye_hesapla(p_part_id TEXT)
RETURNS VOID
LANGUAGE sql
SET search_path = public
AS $$
  UPDATE all_parts a
  SET yari_mamul_stok = COALESCE((
        SELECT sum(CASE WHEN y.direction = 'IN' THEN abs(y.qty) ELSE -abs(y.qty) END)
        FROM yari_mamul_stok y
        WHERE y.part_id = p_part_id), 0)
  WHERE a.part_id = p_part_id;
$$;

CREATE OR REPLACE FUNCTION public.yari_mamul_bakiye_tetik()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP <> 'INSERT' AND OLD.part_id IS NOT NULL THEN
    PERFORM public.yari_mamul_bakiye_hesapla(OLD.part_id);
  END IF;
  IF TG_OP <> 'DELETE' AND NEW.part_id IS NOT NULL THEN
    PERFORM public.yari_mamul_bakiye_hesapla(NEW.part_id);
  END IF;
  RETURN NULL;   -- AFTER trigger
END;
$$;

DROP TRIGGER IF EXISTS trg_yari_mamul_bakiye ON public.yari_mamul_stok;
CREATE TRIGGER trg_yari_mamul_bakiye
  AFTER INSERT OR UPDATE OR DELETE ON public.yari_mamul_stok
  FOR EACH ROW EXECUTE FUNCTION public.yari_mamul_bakiye_tetik();

-- ── Mevcut defterden bakiyeleri bir kerelik doldur ───────────
UPDATE all_parts a
SET yari_mamul_stok = COALESCE(d.net, 0)
FROM (
  SELECT part_id,
         sum(CASE WHEN direction = 'IN' THEN abs(qty) ELSE -abs(qty) END) AS net
  FROM yari_mamul_stok WHERE part_id IS NOT NULL GROUP BY part_id
) d
WHERE a.part_id = d.part_id
  AND a.yari_mamul_stok IS DISTINCT FROM COALESCE(d.net, 0);
