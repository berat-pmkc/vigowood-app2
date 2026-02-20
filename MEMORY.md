# VigoWood Platform — Proje Hafızası

Her katman tamamlandığında güncellenir. Proje boyunca alınan kararlar, öğrenilenler ve durum burada takip edilir.

---

## AKTİF KATMAN

**Katman 16: Stok — Yarı Mamül** — Sırada

---

## TAMAMLANAN KATMANLAR

### Katman 0: Proje İskeleti ✅ (2026-02-18)
- Next.js 16.1.6 (App Router) + TypeScript strict + Tailwind CSS v4
- shadcn/ui (new-york, lucide icons) — Button, Card, Badge kuruldu
- Supabase SSR bağlantısı: client.ts, server.ts, admin.ts, middleware.ts
- VigoWood renk paleti globals.css'e entegre (Natural, Functional, Recycle, Ekstra)
- Tailwind custom renkler: `bg-vw-primary`, `bg-vw-success` vb. kullanılabilir
- CLAUDE.md yapısına uygun klasör iskeleti (11 route, layout grupları)
- Ana sayfa: Logo + Hoş geldiniz + Renk paleti kartları + Komponent testi
- .env.local Supabase key'leri hazır, .gitignore'da korunuyor
- Build başarılı, tüm sayfalar statik generate edildi
- Not: Next.js 16'da "middleware" → "proxy" deprecation uyarısı var (çalışıyor)

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
| products | 101 | ✅ |
| users | 56 | ✅ |
| kesim_makinesi | 3 | ✅ |
| all_parts | 369/379 | ✅ (10 duplicate, decimal fix yapıldı) |
| plakalar | 414/416 | ✅ (2 duplicate, 16 SKU null) |
| plaka_parts | 392/406 | ✅ (14 atlandı — part_id Excel'de yok) |
| assembly_steps | 522/523 | ✅ (1 duplicate) |
| step_bom | 1651 | ✅ (427 DAG ref) |
| cut_batches | 748 | ✅ |
| cut_lines | 1575 | ✅ |
| clean | 1515/1538 | ✅ (23 FK mismatch atlandı) |
| pack_events | 712 | ✅ |
| stock_movements | 20752 | ✅ (UUID PK, mixed date format) |
| yari_mamul_stok | 234141 | ✅ (2 format: A normal, B shifted cols) |
| hazir_eleman_akis | 105 | ✅ |
| iade_giris | 128 | ✅ |
| attendance | 1891 | ✅ |
| notifications | 2 | ✅ |

---

## KATMAN NOTLARI

### Katman 0
- create-next-app@latest Next.js 16 kurdu (CLAUDE.md'de 14 yazıyor ama 16 en güncel, App Router aynı)
- Tailwind v4 geldi, shadcn/ui v4 uyumlu çalışıyor
- Bash shell'de echo/pwd gibi basit komutlar bazen exit code 1 veriyor (Windows Git Bash sorunu), node -e ile workaround yapıldı
- Renk paleti hex olarak CSS variables'a yazıldı (oklch yerine), Tailwind @theme ile custom renk token'ları eklendi

### Katman 1 ✅ (2026-02-20)
- Login sayfası (email/password, Zod validation, VigoWood tema)
- Operatör seçim ekranı (station hesapları)
- Auth middleware (login redirect, station operator redirect)
- Users tablosu migration (56 kullanıcı, 10 rol, RLS)
- Seed script (18 email kullanıcı Supabase Auth kaydı)
- server-only auth helpers, DB types

### Katman 2 ✅ (2026-02-20)
- shadcn/ui Sidebar: collapsible="icon", dark wood tema
- SidebarProvider + SidebarInset wrapper pattern
- TopNavbar: SidebarTrigger, bildirim ikonu, kullanıcı adı/rol
- MobileBottomNav: max 5 item, < md breakpoint
- Rol bazlı menü filtreleme: getFilteredNavGroups(role)
- navigation.ts: Tüm menü yapısı ve roller merkezi config'de

### Katman 3 ✅ (2026-02-20)
- Migration: products (101 SKU, 10 kategori), all_parts (379, 4 tip), kesim_makinesi (3)
- Seed script: Excel → Supabase (upsert, batch 100, duplicate dedup)
- AllParts'ta 10 duplicate row var (5 PartID), seed'de first-occurrence alınır
- Products'ta İlkSatısTarihi Excel serial date formatında — ISO'ya çevrilir
- RLS: Authenticated read, Yönetici full CRUD
- product_category ve part_type enum'ları eklendi
- Geçici analiz dosyaları temizlendi (read-users.js vb.)

### Katman 4 ✅ (2026-02-20)
- Migration: plakalar (414), plaka_parts (362), assembly_steps (522), step_bom (1651)
- step_bom.part_id FK yok — DAG yapısı (all_parts VEYA assembly_steps referansı)
- 427 satırda ASM-XXXX referansı (önceki adım çıktısı = sonraki adım girdisi)
- Plakalar 2 duplicate PlakalarID, AssemblySteps 1 duplicate StepID — seed'de dedup
- PlakaParts'ta 44 satır atlandı (part_id all_parts'ta yok — AllParts batch hatası kaynaklı)
- Plakalar'da 16 SKU null yapıldı (products tablosunda yok — pasif ürünler)
- Seed script Supabase'den mevcut referansları çekip doğruluyor (robust FK handling)
- Excel kolon adları: StepBOMID (not StepBomID), KODU (not Kodu) — case-sensitive dikkat

---

## BUGLAR VE ÇÖZÜMLER

- AllParts duplicate PartID'ler: LS051-P09, LS051-P11, MKOS-P02, LS011-P04, LS051-P08 — seed'de ilk kayıt alınır
- AllParts decimal fix: hazir_eleman_aktif_stok ve yari_mamul_stok INTEGER→NUMERIC (004_fix_allparts_decimal.sql)
- Products'ta negatif stok_aktif değerleri var (normal, iade/satış farkı)
- PlakaParts 9 part_id Excel'de AllParts'ta yok: LS051-P12, LS051-P07, LS051-P10, MKOS-P01, LS011-P03, MKOS-P02-M, KOSC-P02, KOSM-P02, KOSA-P02
- StockMovements mixed date format: M.D.YYYY (236 row) + D.M.YYYY (11357 row), smart detection ile çözüldü
- YarıMamulStok 2 format: A (185207 normal DD/MM), B (48934 shifted cols, JS Date string)
- YarıMamulStok MM/DD/YYYY (US format), DD/MM değil — smart detection eklendi
- Clean 23 CutlineID cut_lines'ta yok — FK validated, atlandı
- HazırElemanAkıs kolon adı: HAkısID (Turkish ı), HAkisID değil
- CutBatches MakineID: BUYUK→BÜYÜK, KUCUK→KÜÇÜK mapping gerekli

---

### Katman 5 ✅ (2026-02-20)
- Migration: 005_transaction_tables.sql — 10 tablo
- Seed: seed-transaction-tables.ts (8 Excel) + seed-large-csv.ts (2 CSV)
- CutBatches→CutLines→Clean FK zinciri (CASCADE)
- Clean PK: cutline_id (1:1 with cut_lines), clean_batch_id ayrı kolon
- stock_movements: UUID surrogate PK (MovID'de 2 duplicate var)
- yari_mamul_stok: 234K satır, 2 format handling (Format A/B auto-detect)
- StockMovements tarih: M.D.YYYY ve D.M.YYYY karışık — smart detection
- PackEvents.Personel: virgülle ayrık VW### — TEXT olarak saklanıyor (ileride normalize)
- Notifications.TargetUser: aynı pattern, TEXT
- Attendance.Employee: isim bazlı, VW### değil — user mapping ileride yapılacak

---

### Katman 12 ✅ (2026-02-20)
- Migration: 010_montaj_tables.sql — montaj_batches tablosu
- Durum akışı: bekliyor → montajda → tamamlandi (cancelMontaj ile geri alınabilir)
- current_step_no ile adım bazlı ilerleme (0=başlamadı, 1..N=aktif adım)
- Tamamlandığında YARIMAMUL parçalar için yari_mamul_stok OUT kayıtları
- ASM referanslar (Alt Montaj) stok düşüşünden atlanır — internal DAG
- HAZIR/KUTU/KARTON parçalar stok düşüşünden atlanır (Katman 17'de ele alınacak)
- Idempotency: source_id kontrolü ile çift stok girişi önlenir
- Auto-ID: MON-XXXX (montaj_batches), YMS-XXXXXX (yari_mamul_stok)
- 3 adımlı yeni montaj wizard: SKU Seç → Malzeme Kontrolü → Oluştur
- Malzeme yeterliliği: YARIMAMUL → SUM(IN-OUT) from yari_mamul_stok, HAZIR → all_parts.hazir_eleman_aktif_stok
- Detay sheet: Adım listesi (tamamlanan=yeşil, aktif=mavi, bekleyen=gri) + aktif adım BOM paneli
- RLS: has_production_access() (SECURITY DEFINER), is_admin() delete
- Realtime: use-montaj-realtime.ts — montaj_batches tablosunu dinler
- Constants: MONTAJ_STATUS, labels, colors, border colors
- Validations: montajBatchCreateSchema
- Yeni shadcn: textarea
- Dosya yapısı: uretim/montaj/{page.tsx, actions.ts, yeni/page.tsx, components/7-dosya}

### Katman 15: Stok — Mamül ✅ (2026-02-20)
- Admin pattern'ını izler: Server Component → Client Component → URL params
- Sayfa yapısı: KPI Cards (4 kart) + Tabs (Stok Özeti | Hareketler)
- Stok Özeti tab: Trend chart (Recharts AreaChart) + TanStack Table
- Hareketler tab: stock_movements TanStack Table + source filtre
- Migration: 013_mamul_stok_kritik.sql — products tablosuna mamul_stok_kritik kolonu
- Aktif ürünlerde varsayılan kritik stok = 5
- Kritik stok göstergesi: Kırmızı (stok < kritik), Sarı (stok <= kritik*1.5), Yeşil (yeterli)
- KPI kartları: Toplam stok, kritik sayısı, bugünkü üretim, bugünkü hareket sayısı
- Recharts v3.7.0: TooltipProps tipi değişti — custom interface kullan (TooltipProps<> artık payload içermiyor)
- Chart: AreaChart with dual series (Giriş=yeşil, Çıkış=kırmızı), 30 gün gradient fill
- Stok tablosu: son hareket tarihi stock_movements'tan lookup
- Hareketler tablosu: SKU adı products'tan lookup, source badge renkleri
- Server action: updateKritikStok (STOCK_ACCESS_ROLES guard)
- URL params: tab, page/pageSize/search/kategori/sortBy/sortOrder (stok), mPage/mPageSize/mSearch/mSource/mSortBy/mSortOrder (hareketler)
- Yeni bağımlılık: recharts ^3.7.0
- Dosya yapısı: stok/mamul/{page.tsx, actions.ts, components/5-dosya}

---

*Son güncelleme: 2026-02-20*
