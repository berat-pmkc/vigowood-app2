# VigoWood Platform — Proje Hafızası

Her katman tamamlandığında güncellenir. Proje boyunca alınan kararlar, öğrenilenler ve durum burada takip edilir.

---

## AKTİF KATMAN

**Katman 0: Proje İskeleti** — Henüz başlanmadı

---

## TAMAMLANAN KATMANLAR

(henüz yok)

---

## KARARLAR

| Tarih | Karar | Neden |
|-------|-------|-------|
| 2026-02-19 | Supabase Pro ($25/ay) | Otomatik yedekleme, auth dahil, sıfır bakım |
| 2026-02-19 | Vercel Pro ($20/ay) | Ticari lisans, 60sn timeout |
| 2026-02-19 | Hetzner mevcut sunucu korunacak | Python worker, cron, n8n |
| 2026-02-19 | 24+ katmanlı geliştirme | Proje büyük, küçük adımlar |
| 2026-02-19 | Shared hesap desteği gerekli | İstasyon tabletlerinde ortak giriş |
| 2026-02-19 | BOM'da DAG yapısı var | 427 kayıtta adım→adım referansı |
| 2026-02-19 | Mobile-first | 38 operatör tablet kullanıyor |
| 2026-02-19 | Context7 MCP kullanılacak | Güncel API dökümantasyonu |
| 2026-02-19 | Claude-Mem kullanılacak | Oturumlar arası hafıza (sorun çıkarırsa kaldırılır) |
| 2026-02-19 | Superpowers kullanılmayacak | Bu proje için fazla sürtünme |
| 2026-02-19 | Natural Color paleti (ahşap tonları) | Şirketin marka renkleri |
| 2026-02-19 | DB şeması CLAUDE.md'de değil data/ dosyalarında | CLAUDE.md hafif kalsın |
| 2026-02-19 | Veri dosyaları Claude Code ile paylaşılacak | Gerçek veriden migration yapılsın |

---

## BİLİNEN ZORLUKLAR

1. **234K+ yarı mamül stok satırı** — Batch import, pagination gerekli
2. **BOM DAG yapısı** — step_bom.part_id bazen ASM-XXXX, FK karmaşıklığı
3. **Negatif stok değerleri** — Hazır elemanlarda eksi stok var, nedeni araştırılmalı
4. **ID pattern tutarsızlığı** — Sıralı (KES-0001), tarih bazlı (PKT-20251209), UUID karışık
5. **Products.StokAktif formül** — IMPORTRANGE, Supabase'de view/function olacak
6. **Attendance isimle eşleşiyor** — ID yerine ad_soyad, migration'da düzeltilmeli
7. **Çoklu değer alanları** — PackEvents.Personel virgülle ayrık, normalize edilmeli
8. **Shared hesaplar** — Ortak email giriş + form içi operatör seçimi

---

## ARAÇ DURUMU

| Araç | Durum | Not |
|------|-------|-----|
| Context7 MCP | ⏳ Kurulacak | `claude mcp add context7 -- npx -y @upstash/context7-mcp` |
| Claude-Mem | ⏳ Kurulacak | `/plugin marketplace add thedotmack/claude-mem` → install |

---

## MİGRASYON DURUMU

| Tablo | Satır | Durum |
|-------|-------|-------|
| products | 974 | ⏳ |
| users | 56 | ⏳ |
| kesim_makinesi | 3 | ⏳ |
| all_parts | 379 | ⏳ |
| plakalar | 416 | ⏳ |
| plaka_parts | 406 | ⏳ |
| assembly_steps | 523 | ⏳ |
| step_bom | 1651 | ⏳ |
| cut_batches | 760 | ⏳ |
| cut_lines | 1631 | ⏳ |
| clean | 1589 | ⏳ |
| pack_events | 717 | ⏳ |
| stock_movements | 20752 | ⏳ |
| yari_mamul_stok | 234141 | ⏳ |
| hazir_eleman_akis | 106 | ⏳ |
| iade_giris | 128 | ⏳ |
| attendance | 2399 | ⏳ |
| notifications | 2 | ⏳ |

---

## KATMAN NOTLARI

(Her katman tamamlandığında buraya detay eklenir)

---

## BUGLAR VE ÇÖZÜMLER

(Bulunan buglar ve çözümleri buraya yazılır)

---

*Son güncelleme: 2026-02-19*
