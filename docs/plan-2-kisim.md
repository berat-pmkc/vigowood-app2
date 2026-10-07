# Revizyon 2. Kısım — Uygulama Planı

Kaynak: kullanıcının "2 KISIM" 33 maddelik listesi (2026-10-07). Tüm DB değişiklikleri
`supabase/pending_migrations/` altına yazılır, önce prova schema'sına (`vigowood_prova`) uygulanır,
canlıya DB geçişiyle birlikte gider. Canlı DB'ye dokunulmaz.

## Kararlar (soru-cevap)
- Beyaz Yaka butonu: şimdilik boş (yer tutucu). Mevcut Kanban/Liste/Takvim görev panosu korunur, Beyaz Yaka içinden erişilir.
- Kesim talimatında "Bitirdi" → plaka+adet önceden dolu Yeni Kesim kaydı (stok IN) + talimat ilerlemesi.
- Sayım: sayım BAŞLATILDIĞI andan BİTİRİLENE kadar o ürüne giren/çıkan üretim-kalite hareketleri sayılan rakama eklenir.
- Talep açma: ofis rolleri; talimata alma: admin-eşdeğer roller + Endüstri Mühendisi.
- Madde 29: talimat seans kısıtlaması YOK (madde 10–13'teki kısıtlar iptal); talimattan hızlı "Seans Başlat" kalır. Yeni personel = 1 satır (kolayca artırılır).

## Paketler (Sonnet ajanları)
| Paket | Maddeler | Sahip olduğu alan | Migration no |
|---|---|---|---|
| P1 Analiz | 1, yan malzeme kartı (2. madde sonu) | analiz/** | 150-159 |
| P2 Admin Plaka/Parça ağacı | 2 | admin/plakalar/**, admin/parcalar/** | 120-129 |
| P3 Ops temizlik + Stok + Kalite iptal | 30, 31, 32, 33 | ops/ajanlar, ops/kullanim, stok/sayim/**, stok/mamul (stok düzenleme), lib/kalite, components/shared/kalite | 110-119 |
| P4a İş Talimatı + Talep DB/çekirdek | 3–28 (DB, RPC, cron, server actions) | lib/talimat/**, lib/talep/** | 130-149 |
| P4b Yönetim ekranları | 3–8, 15–27 (planlama, yayınla, talepler) | ops/board/**, talepler/** | — |
| P4c Tablet ekranları | 8–9, 13–16, 28 + montaj seans bekletme | uretim/** tablet, components/shared/talimat | — |

Sıra: P1 ‖ P2 ‖ P3 ‖ P4a → P4b ‖ P4c → derleme + prova DB'ye uygulama + localhost.

## Doğrulama
`npm run build` sıfır hata; pending migration'lar `build-schema --start N` ile prova'ya; RPC duman testleri;
localhost'ta sunucu hata kaydı kontrolü.
