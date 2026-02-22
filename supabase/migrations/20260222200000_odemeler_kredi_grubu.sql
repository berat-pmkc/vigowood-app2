-- Odemeler tablosuna kredi_grubu kolonu ekle
-- Sadece tür=KREDİ olduğunda kullanılır (ör: "Garanti Bankası", "QNB Finansbank")
ALTER TABLE public.odemeler ADD COLUMN IF NOT EXISTS kredi_grubu text;
