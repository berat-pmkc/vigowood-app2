-- VigoWood Platform — Katman 11: Temizlik Durum Takibi
-- clean tablosuna 3-durumlu akis eklenir (bekliyor → temizleniyor → tamamlandi)
-- Uretim rolleri icin INSERT/UPDATE RLS policy'leri eklenir

---------------------------------------------------
-- 1. Mevcut status degerlerini guncelle
---------------------------------------------------
-- Closed → tamamlandi
UPDATE public.clean SET status = 'tamamlandi' WHERE status = 'Closed';
-- Open with end_time → tamamlandi (eski veride temizlenmis ama status guncellenmemis)
UPDATE public.clean SET status = 'tamamlandi' WHERE status = 'Open' AND end_time IS NOT NULL;
-- Open with start_time but no end_time → temizleniyor
UPDATE public.clean SET status = 'temizleniyor' WHERE status = 'Open' AND start_time IS NOT NULL AND end_time IS NULL;
-- Remaining Open → bekliyor
UPDATE public.clean SET status = 'bekliyor' WHERE status = 'Open';

---------------------------------------------------
-- 2. Operator takip kolonlari
---------------------------------------------------
ALTER TABLE public.clean ADD COLUMN IF NOT EXISTS operator_id TEXT;
ALTER TABLE public.clean ADD COLUMN IF NOT EXISTS operator_name TEXT;

-- Indeks
CREATE INDEX IF NOT EXISTS idx_clean_operator ON public.clean(operator_id);
CREATE INDEX IF NOT EXISTS idx_clean_status_start ON public.clean(status, start_time);

---------------------------------------------------
-- 3. Uretim rolleri icin RLS policy'leri
---------------------------------------------------

-- clean: Uretim + Hat rolleri INSERT yapabilir
CREATE POLICY "Uretim rolleri can insert clean"
  ON public.clean FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.auth_id = auth.uid()
        AND u.role IN ('Üretim', 'Hat', 'Yönetici', 'Endüstri Mühendisi')
    )
  );

-- clean: Uretim + Hat rolleri UPDATE yapabilir (durum gecisleri)
CREATE POLICY "Uretim rolleri can update clean"
  ON public.clean FOR UPDATE TO authenticated
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
