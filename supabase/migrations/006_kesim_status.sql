-- VigoWood Platform — Katman 10: Kesim Durum Takibi
-- cut_batches tablosuna durum yönetimi eklenir
-- Üretim rolleri için INSERT/UPDATE RLS policy'leri eklenir

---------------------------------------------------
-- 1. cut_batches durum kolonları
---------------------------------------------------
ALTER TABLE public.cut_batches
  ADD COLUMN durum TEXT NOT NULL DEFAULT 'bekliyor',
  ADD COLUMN baslama_zamani TIMESTAMPTZ,
  ADD COLUMN bitis_zamani TIMESTAMPTZ;

-- Mevcut 748 kaydı tamamlandi olarak işaretle
UPDATE public.cut_batches SET durum = 'tamamlandi' WHERE durum = 'bekliyor';

-- Composite index: durum + tarih (sık filtreleme)
CREATE INDEX idx_cut_batches_durum_tarih ON public.cut_batches(durum, tarih);

---------------------------------------------------
-- 2. Üretim rolleri için RLS policy'leri
---------------------------------------------------

-- cut_batches: Üretim + Hat rolleri INSERT yapabilir
CREATE POLICY "Üretim rolleri can insert cut_batches"
  ON public.cut_batches FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('Üretim', 'Hat', 'Endüstri Mühendisi')
    )
  );

-- cut_batches: Üretim + Hat rolleri UPDATE yapabilir (durum geçişleri)
CREATE POLICY "Üretim rolleri can update cut_batches"
  ON public.cut_batches FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('Üretim', 'Hat', 'Yönetici', 'Endüstri Mühendisi')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('Üretim', 'Hat', 'Yönetici', 'Endüstri Mühendisi')
    )
  );

-- cut_lines: Üretim + Hat rolleri INSERT yapabilir
CREATE POLICY "Üretim rolleri can insert cut_lines"
  ON public.cut_lines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('Üretim', 'Hat', 'Yönetici', 'Endüstri Mühendisi')
    )
  );

-- yari_mamul_stok: Üretim + Hat rolleri INSERT yapabilir
CREATE POLICY "Üretim rolleri can insert yari_mamul_stok"
  ON public.yari_mamul_stok FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('Üretim', 'Hat', 'Yönetici', 'Endüstri Mühendisi')
    )
  );
