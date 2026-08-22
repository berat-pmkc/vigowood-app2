-- =============================================================
-- BT201 paketleme reçetesindeki HP0058 satırının kaldırılması
--
-- HP0058 all_parts'ta tanımlı değil; yalnızca BT201 / Paketleme
-- (ASM-0347) adımının reçetesinde x4 olarak geçiyordu. Tanımsız
-- olduğu için zaten stoktan bir şey düşmüyordu — satır sadece
-- reçeteyi kirletiyor ve "eksik malzeme var mı" kontrollerinde
-- gürültü üretiyordu.
--
-- Kontrol edildi: step_bom dışında hiçbir tabloda kullanılmıyor
-- (all_parts, plaka_parts, yari_mamul_stok, hazir_eleman_akis: 0 kayıt).
--
-- BT201'in paketlemesinde iç kutu (HP0072), dış kutu (HP0073) ve
-- şilte (HP0013) zaten tanımlı; kaldırılan satır bunlardan biri değil.
-- İleride bu dördüncü kalemin ne olduğu netleşirse parça açılıp
-- reçeteye yeniden eklenmeli.
-- =============================================================

DELETE FROM step_bom
WHERE part_id = 'HP0058'
  AND NOT EXISTS (SELECT 1 FROM all_parts WHERE part_id = 'HP0058');
