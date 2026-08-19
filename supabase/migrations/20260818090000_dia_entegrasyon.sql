-- =============================================================
-- DİA ENTEGRASYONU — senkronizasyon günlüğü
--
-- Satışlar artık DİA'dan Excel indirilip yüklenerek değil, web servis
-- üzerinden her gün otomatik çekiliyor. Otomatik çalışan bir işin
-- sessizce bozulması en kötü senaryo olduğu için her çalışma —
-- başarılı ya da başarısız — buraya yazılıyor; ekranda son çalışma
-- ve hata mesajı görünüyor.
--
-- Excel yükleme akışı KALDIRILMIYOR: DİA erişimi kesildiğinde ya da
-- geçmiş bir dönem elle düzeltileceğinde yedek yol olarak duruyor.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.dia_sync_log (
  id                BIGSERIAL PRIMARY KEY,
  tur               TEXT NOT NULL DEFAULT 'satis',
  baslangic_tarihi  DATE,
  bitis_tarihi      DATE,
  rapor_id          TEXT,
  cekilen           INTEGER NOT NULL DEFAULT 0,
  yazilan           INTEGER NOT NULL DEFAULT 0,
  atlanan           INTEGER NOT NULL DEFAULT 0,
  durum             TEXT NOT NULL DEFAULT 'basarili',  -- basarili | uyari | hata
  mesaj             TEXT,
  sure_ms           INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.dia_sync_log IS
  'DİA web servis senkronizasyon geçmişi. Cron ve elle çekimlerin ikisi de buraya yazar.';
COMMENT ON COLUMN public.dia_sync_log.atlanan IS
  'Fatura no sistemde zaten bulunduğu için yazılmayan satır sayısı (mükerrer koruması).';

CREATE INDEX IF NOT EXISTS idx_dia_sync_log_created
  ON public.dia_sync_log (created_at DESC);

ALTER TABLE public.dia_sync_log ENABLE ROW LEVEL SECURITY;

-- Okuma: satış ekranını görebilenler. Yazma yalnızca service_role
-- (cron ve sunucu tarafı) — kullanıcı eliyle log uydurulamasın.
DROP POLICY IF EXISTS "dia log oku" ON public.dia_sync_log;
CREATE POLICY "dia log oku" ON public.dia_sync_log
  FOR SELECT TO authenticated
  USING (true);

-- =============================================================
-- Alan eşleştirme ayarı
--
-- DİA'nın fatura listesi kolon adları kurulumdan kuruluma değişebiliyor.
-- Kod içinde aday listesi var; buradaki değer yalnızca aday listesi
-- yetmediğinde devreye giriyor. Böylece yanlış eşleşme deploy beklemeden
-- ekrandan düzeltilebiliyor.
-- =============================================================

INSERT INTO public.app_settings (key, value)
VALUES (
  'dia_satis_ayarlari',
  '{
    "servis": "scf_fatura_listele_ayrintili",
    "sabitFiltreler": [{"field": "turu", "operator": "=", "value": "S"}],
    "alanEslesme": {},
    "tarihFiltreAlani": "tarih"
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
