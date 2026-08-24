-- =============================================================
-- Yurtdışı depo — BT301A sayımı 138 -> 162 düzeltmesi
--
-- 2026_08 yurtdışı sayımında BT301A 138 girilmişti; kullanıcı 162 olarak
-- güncelledi. Depo bakiyesi stock_movements toplamından geldiği için
-- ilgili sayım hareketinin miktarı doğrudan güncelleniyor (yeni bir
-- düzeltme hareketi eklemek yerine — tek kalemlik ilk sayım, temiz kalsın).
-- =============================================================

UPDATE stock_movements
SET qty = 162
WHERE batch_id = 'YDS-SAYIM-2026_08'
  AND sku = 'BT301A'
  AND depo_id = 'YURTDISI';
