-- Mola planı atamaları.
--
-- Plan B (öğle 12:45-13:30, çay 15:40-16:00) Paketleme ve Temizlik
-- ekibindeki mevcut personele atanıyor. Bu bir kural değil, tek seferlik
-- veri ataması — yeni işe girenler Plan A ile başlar, gerekiyorsa
-- kullanıcı yönetimi ekranından değiştirilir.

UPDATE public.users
SET mola_plani_id = (SELECT id FROM public.mola_planlari WHERE ad = 'Plan B'),
    updated_at = now()
WHERE station::text IN ('Paketleme', 'Temizlik')
  AND role::text = 'Üretim';
