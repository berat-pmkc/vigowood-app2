-- =============================================================
-- Maliyet analizi temeli: HP/malzeme birim fiyatları + işçilik ücreti
--
-- Ürün birim maliyeti = malzeme (reçete × birim fiyat) + işçilik.
-- Bu migration temeli atıyor: all_parts'a fiyat kolonu ekliyor, kullanıcının
-- Excel'inden (MALZEME KULLANIM ÇALIŞMASI) 108 HP fiyatını yüklüyor, ve
-- işçilik saat ücretini app_settings'e koyuyor. Hepsi ekrandan düzenlenebilir.
-- =============================================================

ALTER TABLE public.all_parts
  ADD COLUMN IF NOT EXISTS birim_fiyat NUMERIC;

COMMENT ON COLUMN public.all_parts.birim_fiyat IS
  'Malzeme birim satın alma fiyatı (TL). Maliyet analizinde reçete × bu fiyat. Excel HP TANIMLARI''ndan yüklendi, admin''den güncellenir.';

-- 108 HP fiyatı (yalnızca fiyatı olanlar; boş kalanlar NULL kalır)
UPDATE public.all_parts a SET birim_fiyat = v.fiyat
FROM (VALUES
  ('HP0001',5.63),
  ('HP0002',0.21),
  ('HP0003',0.272),
  ('HP0004',0.279),
  ('HP0005',0.205),
  ('HP0008',55.0),
  ('HP0009',7.5),
  ('HP0011',0.0085),
  ('HP0012',13.8565),
  ('HP0013',2.04),
  ('HP0014',0.2214),
  ('HP0015',1358.33),
  ('HP0016',1212.5),
  ('HP0017',1493.33),
  ('HP0018',390.73),
  ('HP0019',612.54),
  ('HP0020',5.25),
  ('HP0021',56.0493),
  ('HP0022',0.272),
  ('HP0023',7.5),
  ('HP0024',0.41),
  ('HP0025',38.0175),
  ('HP0026',34.6875),
  ('HP0027',11.8585),
  ('HP0028',0.49),
  ('HP0029',11.4885),
  ('HP0030',22.38),
  ('HP0031',21.5),
  ('HP0032',11.88),
  ('HP0033',10.73),
  ('HP0034',15.6),
  ('HP0035',125.0),
  ('HP0036',0.22),
  ('HP0037',1.1),
  ('HP0038',29.0),
  ('HP0039',23.75),
  ('HP0040',27.0),
  ('HP0042',61.4286),
  ('HP0044',61.4286),
  ('HP0045',81.1111),
  ('HP0047',81.1111),
  ('HP0049',14.911),
  ('HP0050',33.9475),
  ('HP0051',17.0385),
  ('HP0052',35.9825),
  ('HP0053',0.45),
  ('HP0054',0.42),
  ('HP0055',20.424),
  ('HP0056',24.716),
  ('HP0057',12.395),
  ('HP0060',55.0),
  ('HP0062',15.836),
  ('HP0063',9.435),
  ('HP0064',5.92),
  ('HP0065',19.9615),
  ('HP0066',10.73),
  ('HP0067',47.5616),
  ('HP0068',10.175),
  ('HP0069',47.5616),
  ('HP0070',27.0),
  ('HP0071',26.0),
  ('HP0072',16.391),
  ('HP0073',37.8325),
  ('HP0074',4.1),
  ('HP0075',0.98),
  ('HP0076',0.228),
  ('HP0077',2.35),
  ('HP0078',0.41),
  ('HP0079',12.4135),
  ('HP0080',15.54),
  ('HP0081',0.2),
  ('HP0082',15.28),
  ('HP0083',15.28),
  ('HP0084',15.28),
  ('HP0085',15.28),
  ('HP0086',15.28),
  ('HP0087',15.28),
  ('HP0088',15.28),
  ('HP0089',15.28),
  ('HP0090',15.28),
  ('HP0091',15.28),
  ('HP0092',15.28),
  ('HP0093',15.28),
  ('HP0094',23.5),
  ('HP0095',0.21),
  ('HP0097',81.1111),
  ('HP0098',81.1111),
  ('HP0099',47.885),
  ('HP0100',47.885),
  ('HP0101',47.885),
  ('HP0102',47.885),
  ('HP0103',21.0),
  ('HP0104',61.4286),
  ('HP0105',61.4286),
  ('HP0107',1.2),
  ('HP0108',8.325),
  ('HP0109',1.75),
  ('HP0110',47.5616),
  ('HP0111',47.5616),
  ('HP0112',29.97),
  ('HP0113',22.015),
  ('HP0114',31.635),
  ('HP0115',42.55),
  ('HP0116',33.3),
  ('HP0117',21.645),
  ('HP0118',0.15),
  ('HP0120',1.6),
  ('HP0122',42.55)
) AS v(part_id, fiyat)
WHERE a.part_id = v.part_id;

-- İşçilik saat ücreti (kişi-saat başı TL). Excel'de montaj ve paketleme
-- ~174 TL/kişi-saat çıkıyordu (toplam ücret / toplam kişi-saat).
INSERT INTO public.app_settings (key, value)
VALUES ('maliyet_ayarlari', jsonb_build_object(
  'montaj_saat_ucreti', 174,
  'paketleme_saat_ucreti', 174,
  'guncelleme', '2026-08 Excel referansı'
))
ON CONFLICT (key) DO NOTHING;
