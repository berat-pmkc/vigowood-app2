-- 027: app_settings tablosu — kritik stok otomatik hesaplama sistemi
-- Key-value yapısı (JSONB), uygulama geneli ayarlar için

CREATE TABLE IF NOT EXISTS public.app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL DEFAULT '{}',
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.app_settings IS 'Uygulama geneli ayarlar (key-value, JSONB)';

-- Trigger: updated_at otomatik güncelleme
CREATE TRIGGER set_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Herkes okuyabilir (ayarlar public bilgi)
CREATE POLICY "app_settings_select_all"
  ON public.app_settings FOR SELECT
  USING (true);

-- Sadece admin güncelleyebilir
CREATE POLICY "app_settings_update_admin"
  ON public.app_settings FOR UPDATE
  USING (is_admin());

CREATE POLICY "app_settings_insert_admin"
  ON public.app_settings FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "app_settings_delete_admin"
  ON public.app_settings FOR DELETE
  USING (is_admin());

-- Varsayılan değerler
INSERT INTO public.app_settings (key, value, description) VALUES
  ('kritik_stok_gun', '30', 'Kritik stok eşiği gün sayısı (günlük satış × bu gün = kritik stok)'),
  ('kritik_stok_lookback_days', '90', 'Satış hızı hesaplamasında geriye bakılacak gün sayısı'),
  ('kritik_stok_last_calculated', 'null', 'Son kritik stok hesaplama tarihi (ISO 8601)'),
  ('kritik_stok_last_summary', 'null', 'Son hesaplama özeti (JSON)')
ON CONFLICT (key) DO NOTHING;
