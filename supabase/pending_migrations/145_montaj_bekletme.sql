-- =============================================================
-- Montaj "Seansı Beklet" (duraklatma)
--
-- Paketlemedeki duraklatma mantığının (20260902120000_paketleme_duraklatma.sql) aynısı:
--   duraklama_dk          : seans boyunca biriken toplam bekleme (dk)
--   duraklatma_baslangic  : şu an beklemedeyse bekleme başlangıcı, çalışıyorsa NULL
-- "Beklemede" = durum 'montajda' + duraklatma_baslangic IS NOT NULL.
-- durum CHECK kısıtı ('montajda','tamamlandi') bilerek DEĞİŞTİRİLMEDİ: açık seans sorgularının
-- (durum='montajda') hepsi beklemedeki seansı da görmeye devam eder.
-- Net süre = brüt − mola − duraklama (closeMontajSession / updateCompletedMontajSession).
-- =============================================================
ALTER TABLE public.montaj_sessions
  ADD COLUMN IF NOT EXISTS duraklama_dk numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duraklatma_baslangic timestamptz;

COMMENT ON COLUMN public.montaj_sessions.duraklama_dk IS
  'Seansın toplam bekleme süresi (dk) — net_sure_dk bundan düşülür';
COMMENT ON COLUMN public.montaj_sessions.duraklatma_baslangic IS
  'Seans şu an beklemedeyse beklemenin başladığı an; çalışıyorsa NULL';
