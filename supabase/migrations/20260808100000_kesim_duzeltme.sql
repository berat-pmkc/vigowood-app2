-- Kesim kaydı düzeltme/silme yetkileri.
--
-- cut_batches, cut_lines ve yari_mamul_stok tablolarında DELETE için
-- yalnızca "Yönetici can manage" politikası vardı. Personel yanlış kesim
-- girdiğinde düzeltemiyordu; uygulama katmanı izin verse bile PostgREST
-- hata döndürmeden 0 satır siliyordu.
--
-- Kesim kaydı silmek beş yerde iz bırakır: cut_lines, yari_mamul_stok IN
-- kayıtları, MDF stok düşümü, hazir_eleman_akis hareketi ve kesim talebine
-- işlenen adet. Uygulama tarafındaki deleteCutBatch hepsini geri alır;
-- burada sadece izin veriliyor.

DROP POLICY IF EXISTS "Production can delete cut_batches" ON public.cut_batches;
CREATE POLICY "Production can delete cut_batches"
  ON public.cut_batches FOR DELETE TO authenticated
  USING (public.has_production_access());

DROP POLICY IF EXISTS "Production can delete cut_lines" ON public.cut_lines;
CREATE POLICY "Production can delete cut_lines"
  ON public.cut_lines FOR DELETE TO authenticated
  USING (public.has_production_access());

-- Yarı mamül hareketleri yalnızca kesim kaynaklıysa silinebilir; montaj
-- veya paketleme hareketlerine bu yolla dokunulamaz.
DROP POLICY IF EXISTS "Production can delete kesim yms" ON public.yari_mamul_stok;
CREATE POLICY "Production can delete kesim yms"
  ON public.yari_mamul_stok FOR DELETE TO authenticated
  USING (public.has_production_access() AND source = 'Kesim');

DROP POLICY IF EXISTS "Production can update yms" ON public.yari_mamul_stok;
CREATE POLICY "Production can update yms"
  ON public.yari_mamul_stok FOR UPDATE TO authenticated
  USING (public.has_production_access() AND source = 'Kesim');

DROP POLICY IF EXISTS "Production insert hazir_eleman_akis" ON public.hazir_eleman_akis;
CREATE POLICY "Production insert hazir_eleman_akis"
  ON public.hazir_eleman_akis FOR INSERT TO authenticated
  WITH CHECK (public.has_production_access());

-- ─── Talep geri alma ────────────────────────────────────────
-- Kesim silinince talebe işlenen adet geri alınır. Talep tamamlanmışsa
-- yeniden açılır — INSERT trigger'ının tersi.
CREATE OR REPLACE FUNCTION public.kesim_talebi_geri_al()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.talep_id IS NULL THEN RETURN OLD; END IF;

  UPDATE kesim_talepleri
  SET kesilen_adet = GREATEST(0, kesilen_adet - OLD.adet::integer),
      durum = CASE
                WHEN durum = 'iptal' THEN 'iptal'
                WHEN GREATEST(0, kesilen_adet - OLD.adet::integer) = 0 THEN 'bekliyor'
                WHEN GREATEST(0, kesilen_adet - OLD.adet::integer) < talep_adet THEN 'kesimde'
                ELSE durum
              END,
      tamamlanma_zamani = CASE
                WHEN GREATEST(0, kesilen_adet - OLD.adet::integer) < talep_adet THEN NULL
                ELSE tamamlanma_zamani
              END,
      updated_at = now()
  WHERE talep_id = OLD.talep_id;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_kesim_talebi_geri_al ON public.cut_batches;
CREATE TRIGGER trg_kesim_talebi_geri_al
  AFTER DELETE ON public.cut_batches
  FOR EACH ROW EXECUTE FUNCTION public.kesim_talebi_geri_al();

-- Adet değişirse talepteki fark güncellenir
CREATE OR REPLACE FUNCTION public.kesim_talebi_adet_duzelt()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  fark INTEGER;
BEGIN
  IF NEW.talep_id IS NULL OR NEW.adet = OLD.adet THEN RETURN NEW; END IF;
  fark := NEW.adet::integer - OLD.adet::integer;

  UPDATE kesim_talepleri
  SET kesilen_adet = GREATEST(0, kesilen_adet + fark),
      durum = CASE
                WHEN durum = 'iptal' THEN 'iptal'
                WHEN GREATEST(0, kesilen_adet + fark) >= talep_adet THEN 'tamamlandi'
                WHEN GREATEST(0, kesilen_adet + fark) = 0 THEN 'bekliyor'
                ELSE 'kesimde'
              END,
      updated_at = now()
  WHERE talep_id = NEW.talep_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_kesim_talebi_adet_duzelt ON public.cut_batches;
CREATE TRIGGER trg_kesim_talebi_adet_duzelt
  AFTER UPDATE OF adet ON public.cut_batches
  FOR EACH ROW EXECUTE FUNCTION public.kesim_talebi_adet_duzelt();
