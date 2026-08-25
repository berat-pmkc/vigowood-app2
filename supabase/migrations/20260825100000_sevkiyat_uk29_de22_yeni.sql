-- =============================================================
-- İki yeni sevkiyat (UK + DE) + numara düzenlemesi
--
-- Kullanıcı kararı:
--   1) Mevcut UK29 (teslim edilmiş) → UK28'e taşınıyor (UK'de 28 boştu).
--   2) Mevcut DE22 (teslim edilmiş) siliniyor.
--   3) Google Sheet planları yükleniyor: UK29 (14 ürün, 100x120) ve
--      DE22 (21 ürün, 80x120). İkisi de durum: bekliyor.
--   'BT301' → BT301A (sistemde BT301 diye ürün yok).
--
-- Türetilen alanlar: toplam_koli = palette_koli × palet_sayisi,
-- qty = koli_adedi × toplam_koli, agirlik = koli_agirlik × toplam_koli.
-- Doğrulandı: UK 720 koli/40 palet/2964 adet, DE 822/66/4692.
--
-- sevkiyat_id FK'leri NO ACTION olduğu için rename şu sırayla: UK28
-- kaydı açılır, çocuk kayıtlar UK28'e taşınır, UK29 silinir (artık
-- referansı yok, cascade tetiklenmez).
-- =============================================================

DO $$
BEGIN
  -- ── 1) UK29 → UK28 ────────────────────────────────────────
  IF EXISTS (SELECT 1 FROM sevkiyat WHERE sevkiyat_id='UK29')
     AND NOT EXISTS (SELECT 1 FROM sevkiyat WHERE sevkiyat_id='UK28') THEN

    INSERT INTO sevkiyat (
      sevkiyat_id, shipment_number, sevkiyat_adi,
      ulke, durum, email, liman, musteri, not_text, arac_tipi, tir_plaka,
      created_at, updated_at, dorse_plaka, operator_id, sevk_tarihi,
      country_code, konteyner_no, operator_name, teslim_zamani, teslimat_tipi,
      alici_firma_id, banka_firma_id, konteyner_tipi, tasiyici_firma,
      gonderim_zamani, hazirlama_zamani, ihracatci_firma_id,
      planlanan_sevk_tarihi, gerceklesen_sevk_tarihi)
    SELECT
      'UK28', 28, 'İngilitere 28',
      ulke, durum, email, liman, musteri, not_text, arac_tipi, tir_plaka,
      created_at, updated_at, dorse_plaka, operator_id, sevk_tarihi,
      country_code, konteyner_no, operator_name, teslim_zamani, teslimat_tipi,
      alici_firma_id, banka_firma_id, konteyner_tipi, tasiyici_firma,
      gonderim_zamani, hazirlama_zamani, ihracatci_firma_id,
      planlanan_sevk_tarihi, gerceklesen_sevk_tarihi
    FROM sevkiyat WHERE sevkiyat_id='UK29';

    UPDATE sevkiyat_items      SET sevkiyat_id='UK28', item_id=replace(item_id,'UK29','UK28') WHERE sevkiyat_id='UK29';
    UPDATE sevkiyat_maliyetler SET sevkiyat_id='UK28' WHERE sevkiyat_id='UK29';
    UPDATE yukleme_planlari    SET sevkiyat_id='UK28' WHERE sevkiyat_id='UK29';

    DELETE FROM sevkiyat WHERE sevkiyat_id='UK29';
  END IF;

  -- ── 2) Mevcut DE22'yi sil ─────────────────────────────────
  DELETE FROM sevkiyat WHERE sevkiyat_id='DE22' AND durum='teslim_edildi';

  -- ── 3a) Yeni UK29 başlığı (bekliyor) ──────────────────────
  IF NOT EXISTS (SELECT 1 FROM sevkiyat WHERE sevkiyat_id='UK29') THEN
    INSERT INTO sevkiyat (sevkiyat_id, shipment_number, sevkiyat_adi, ulke,
      musteri, country_code, durum, arac_tipi, teslimat_tipi,
      alici_firma_id, banka_firma_id, ihracatci_firma_id)
    VALUES ('UK29', 29, 'İngilitere 29', 'İngiltere',
      'HAS-MOB İngiltere', 'UK', 'bekliyor', 'konteyner', 'DAP', 3, 6, 1);

    INSERT INTO sevkiyat_items
      (item_id, sevkiyat_id, sku, urun_adi, qty, palet_boyut, palet_yukseklik,
       en, boy, yuk, koli_adedi, palette_koli, toplam_koli, hacim, desi,
       koli_agirlik, agirlik, grup, palet_sayisi)
    VALUES
('UK29-001','UK29','MKOS41','MKOS41',192,'100x120',125,40,30,57,6,16,32,2.2,730,11.75,376.0,'A',2),
('UK29-002','UK29','MKOS45','MKOS45',192,'100x120',125,40,30,57,6,16,32,2.2,730,11.75,376.0,'A',2),
('UK29-003','UK29','KOSCEVİZ','KOSCEVİZ',432,'100x120',125,40,30,54,12,18,36,2.3,778,12.9,464.4,'A',2),
('UK29-004','UK29','KOSMEŞE','KOSMEŞE',216,'100x120',125,40,30,54,12,18,18,1.2,389,12.9,232.2,'A',1),
('UK29-005','UK29','LS051','LS051',384,'100x120',125,40,30,57,6,16,64,4.4,1459,13.55,867.2,'A',4),
('UK29-006','UK29','LS057','LS057',384,'100x120',125,40,30,57,6,16,64,4.4,1459,13.55,867.2,'A',4),
('UK29-007','UK29','LS021','LS021',240,'100x120',125,60,37,38,4,15,60,5.1,1687,9,540,'B',4),
('UK29-008','UK29','LS023','LS023',180,'100x120',125,60,37,38,4,15,45,3.8,1265,9,405,'B',3),
('UK29-009','UK29','LS024','LS024',120,'100x120',125,60,37,38,4,15,30,2.5,844,9,270,'B',2),
('UK29-010','UK29','LS025','LS025',60,'100x120',125,60,37,38,4,15,15,1.3,422,9,135,'B',1),
('UK29-011','UK29','LS027','LS027',120,'100x120',125,60,37,38,4,15,30,2.5,844,9,270,'B',2),
('UK29-012','UK29','KD50C','KD50C',144,'100x120',125,44,44,18,1,24,144,5.0,1673,14,2016,'B',6),
('UK29-013','UK29','KD50M','KD50M',120,'100x120',125,44,44,18,1,24,120,4.2,1394,14,1680,'B',5),
('UK29-014','UK29','BT301A','BT301A',180,'100x120',125,60,37,38,6,15,30,2.5,844,18.5,555.0,'B',2)    ;
  END IF;

  -- ── 3b) Yeni DE22 başlığı (bekliyor) ──────────────────────
  IF NOT EXISTS (SELECT 1 FROM sevkiyat WHERE sevkiyat_id='DE22') THEN
    INSERT INTO sevkiyat (sevkiyat_id, shipment_number, sevkiyat_adi, ulke,
      musteri, country_code, durum, arac_tipi, teslimat_tipi,
      alici_firma_id, banka_firma_id, ihracatci_firma_id)
    VALUES ('DE22', 22, 'Almanya 22', 'Almanya',
      'HAS-MOB Almanya', 'DE', 'bekliyor', 'konteyner', 'DAP', 2, 5, 1);

    INSERT INTO sevkiyat_items
      (item_id, sevkiyat_id, sku, urun_adi, qty, palet_boyut, palet_yukseklik,
       en, boy, yuk, koli_adedi, palette_koli, toplam_koli, hacim, desi,
       koli_agirlik, agirlik, grup, palet_sayisi)
    VALUES
('DE22-001','DE22','LS051','LS051',648,'80x120',130,40,30,57,6,12,108,7.4,2462,12.8,1382.4,'A',9),
('DE22-002','DE22','LS057','LS057',648,'80x120',130,40,30,57,6,12,108,7.4,2462,12.8,1382.4,'A',9),
('DE22-003','DE22','MKOS41','MKOS41',288,'80x120',130,40,30,57,6,12,48,3.3,1094,11.6,556.8,'A',4),
('DE22-004','DE22','MKOS45','MKOS45',288,'80x120',130,40,30,57,6,12,48,3.3,1094,11.6,556.8,'A',4),
('DE22-005','DE22','KOSCEVİZ','KOSCEVİZ',648,'80x120',125,34,25,57,12,18,54,2.6,872,13.4,723.6,'A',3),
('DE22-006','DE22','KOSMEŞE','KOSMEŞE',432,'80x120',125,34,25,57,12,18,36,1.7,581,13.4,482.4,'A',2),
('DE22-007','DE22','DYKOS','DYKOS',384,'80x120',125,60,38,38,12,8,32,2.8,924,18,576,'A',4),
('DE22-008','DE22','BT201','BT201',180,'80x120',125,60,38,38,5,12,36,3.1,1040,18.5,666.0,'B',3),
('DE22-009','DE22','BT301A','BT301A',216,'80x120',125,60,38,38,6,12,36,3.1,1040,18.5,666.0,'B',3),
('DE22-010','DE22','KD50C','KD50C',72,'80x120',125,44,44,18,1,18,72,2.5,836,14,1008,'B',4),
('DE22-011','DE22','KD50M','KD50M',72,'80x120',125,44,44,18,1,18,72,2.5,836,14,1008,'B',4),
('DE22-012','DE22','LS011','LS011',144,'80x120',125,45,34,57,6,8,24,2.1,698,9.8,235.2,'B',3),
('DE22-013','DE22','LS019','LS019',48,'80x120',125,45,34,57,6,8,8,0.7,233,9.8,78.4,'B',1),
('DE22-014','DE22','LS017','LS017',48,'80x120',125,45,34,57,6,8,8,0.7,233,9.8,78.4,'B',1),
('DE22-015','DE22','LS016','LS016',96,'80x120',125,45,34,57,6,8,16,1.4,465,9.8,156.8,'B',2),
('DE22-016','DE22','LS014','LS014',48,'80x120',125,45,34,57,6,8,8,0.7,233,9.8,78.4,'B',1),
('DE22-017','DE22','LS021','LS021',144,'80x120',125,60,37,38,4,12,36,3.0,1012,11,396,'B',3),
('DE22-018','DE22','LS027','LS027',48,'80x120',125,60,37,38,4,12,12,1.0,337,11,132,'B',1),
('DE22-019','DE22','LS023','LS023',144,'80x120',125,60,37,38,4,12,36,3.0,1012,11,396,'B',3),
('DE22-020','DE22','LS024','LS024',48,'80x120',125,60,37,38,4,12,12,1.0,337,11,132,'B',1),
('DE22-021','DE22','LS025','LS025',48,'80x120',125,60,37,38,4,12,12,1.0,337,11,132,'B',1)    ;
  END IF;
END $$;
