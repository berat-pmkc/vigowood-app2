-- Paketleme seanslarına duraklatma (bekletme) desteği
-- duraklama_dk: seans boyunca biriken toplam bekleme süresi (dakika)
-- duraklatma_baslangic: şu an duraklatılmışsa duraklamanın başladığı an; çalışıyorsa NULL
ALTER TABLE public.pack_events
  ADD COLUMN IF NOT EXISTS duraklama_dk numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duraklatma_baslangic timestamptz;
