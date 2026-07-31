# VigoWood Platform — Project Overview

> Son Güncelleme: 5 Mart 2026

---

## 1. Proje Tanımı

VigoWood, ahşap mobilya firmasının (VigoWood + HAS-MOB) entegre iş yönetim platformudur. Üretim (MES), stok, satış, sevkiyat, muhasebe, analiz, personel ve operasyon yönetimini tek çatıda toplar. Mevcut AppSheet + Google Sheets sisteminin yerini almıştır.

**Firmalar:**
- **VIGO WOOD** — Ana marka (ahşap mobilya üretim ve satış)
- **HAS-MOB** — Kardeş firma (aynı üretim tesisi, ayrı muhasebe)
- **GENEL** — Konsolide raporlama (her iki marka birlikte)

**Hedef:** 56 kullanıcının (38'i tablet kullanan fabrika operatörü) günlük iş akışlarını dijitalleştirmek. Kesimden sevkiyata, stoktan muhasebeye her süreç tek platformda.

---

## 2. Tech Stack

### Ana Framework
| Teknoloji | Versiyon | Görev |
|-----------|----------|-------|
| Next.js (App Router) | 16.1.6 | Full-stack web framework |
| React | 19.2.3 | UI rendering |
| TypeScript | 5.x | Strict mode, tip güvenliği |
| Tailwind CSS | 4.x | Utility-first styling |

### UI & Bileşenler
| Teknoloji | Versiyon | Görev |
|-----------|----------|-------|
| shadcn/ui + Radix UI | 25 bileşen | Erişilebilir UI kit |
| Recharts | 3.7.0 | Grafikler, dashboard kartları |
| TanStack React Table | 8.21.3 | Server-side pagination/sorting/filtering tabloları |
| Lucide React | 0.575.0 | 500+ SVG ikon |
| Sonner | 2.0.7 | Toast bildirimleri |
| next-themes | 0.4.6 | Tema yönetimi |

### Form & Validasyon
| Teknoloji | Versiyon | Görev |
|-----------|----------|-------|
| React Hook Form | 7.71.1 | Form state yönetimi |
| @hookform/resolvers | 5.2.2 | Zod entegrasyonu |
| Zod | 4.3.6 | Schema validasyon |

### Özel Bileşenler
| Teknoloji | Versiyon | Görev |
|-----------|----------|-------|
| @dnd-kit/core + sortable | 6.3 / 10.0 | Drag-drop (Kanban, montaj adımları) |
| @react-pdf/renderer | 4.3.2 | PDF oluşturma (Proforma, Paket Listesi, Raporlar) |
| @xyflow/react | 12.10.1 | Akış diyagramları |
| react-markdown + remark-gfm | 10.1 / 4.0 | Markdown render (Ops chat) |
| cmdk | 1.1.1 | Command palette (Combobox) |
| xlsx | 0.18.5 | Excel import/export |
| SWR | 2.4.0 | Client-side data fetching & cache |

### Backend & Altyapı
| Teknoloji | Görev |
|-----------|-------|
| Supabase Pro ($25/ay) | PostgreSQL, Auth, Realtime, RLS, Storage |
| Vercel Pro ($20/ay) | Hosting, CDN, Edge Functions |
| Hetzner VPS | Python worker, cron, n8n |
| Anthropic SDK (0.78.0) | AI ajan sistemi (Ops Center) |

### Geliştirme Araçları
| Teknoloji | Versiyon | Görev |
|-----------|----------|-------|
| ESLint | 9.x | Kod kalitesi |
| Vitest | 4.0.18 | Unit test |
| shadcn CLI | 3.8.5 | Bileşen yükleme |

---

## 3. Sayısal Özet

| Metrik | Değer |
|--------|-------|
| TypeScript/TSX dosyaları | **598** |
| Sayfa (page.tsx) | **84** |
| Server Action dosyaları (actions.ts) | **47** |
| API Route (route.ts) | **15** |
| Supabase Migration (.sql) | **75** |
| shadcn/ui bileşenleri | **26** |
| Layout bileşenleri | **7** |
| Shared bileşenler | **16** |
| Custom Hook | **18** (10 realtime) |
| Lib dosyaları | **32** |
| Build route sayısı | **90+** |
| Build hata sayısı | **0** |
| Aktif kullanıcı | **56** (10 rol) |
| Ürün SKU | **974** (101 aktif) |

---

## 4. Modüller ve Durum

### 4.1 Tamamlanan Katmanlar

#### Altyapı (Katman 0-2)

| # | Modül | Detay |
|---|-------|-------|
| 0 | **Proje İskeleti** | Next.js 16 + Tailwind 4 + shadcn/ui kurulumu, Supabase bağlantısı (client + server + admin), dosya/klasör yapısı, .env.local, Git init, Vercel deploy |
| 1 | **Auth Sistemi** | Supabase Auth + login sayfası, auth middleware (korumalı route'lar), 56 kullanıcı seed, shared hesap desteği (kesim@, temizlik@, montaj@, montaj2@, paketleme@, kutu@vigowood.com), giriş sonrası operatör seçim sayfası (/select-operator), seçilen operatör user_metadata'da saklanır, rol bazlı yönlendirme, logout |
| 2 | **Layout & Navigasyon** | shadcn Sidebar (collapsible="icon" — masaüstünde icon-only moda küçülür), SidebarProvider + SidebarInset pattern, top navbar (bildirim badge, profil), mobil: Sheet drawer (<md) + MobileBottomNav (max 5 item), navigation.ts'de tüm nav config tek yerde, getFilteredNavGroups(role) ile rol bazlı menü filtreleme, pb-20 md:pb-6 ile bottom nav çakışma önleme |

#### Veritabanı (Katman 3-5)

| # | Modül | Detay |
|---|-------|-------|
| 3 | **DB — Temel Tablolar** | products (974 SKU), users (56 kişi), all_parts (~400 parça), kesim_makinesi — Excel/CSV'den Supabase'e veri aktarımı, RLS policy'leri, database types |
| 4 | **DB — İlişkili Tablolar** | plakalar (~208 plaka), plaka_parts (1:1 ilişki), assembly_steps (~250 adım), step_bom (~427 kayıt) — BOM'daki ASM-XXXX referansları DAG yapısı oluşturur (bir adımın çıktısı başka adımın girdisi), ilişki testleri |
| 5 | **DB — İşlem Tabloları** | cut_batches, cut_lines, clean, pack_events, stock_movements (20K+), yari_mamul_stok (234K satır), hazir_eleman_akis, iade_giris, attendance, notifications — Büyük veri aktarımı (yarı mamül stokta 2 farklı format auto-detect) |

#### Admin Paneli (Katman 6-9)

| # | Modül | Detay |
|---|-------|-------|
| 6 | **Admin — Ürün Yönetimi** | Pattern: Server Component (page.tsx) → Supabase query → Client Component (data table), URL search params ile server-side pagination/sorting/filtering, TanStack Table: manualPagination + manualSorting, ürün CRUD (Sheet formu), toplu aktif/pasif toggle, shared data-table/pagination/column-header bileşenleri |
| 7 | **Admin — Parça Yönetimi** | Katman 6 pattern'ını birebir izler, stok gösterimi: YARIMAMUL → yari_mamul_stok / diğerleri → hazir_eleman_aktif_stok, kritik stok göstergesi: kırmızı (stok < kritik), sarı (stok <= kritik×1.5), yeşil (yeterli), tip filtresi: PART_TYPES + PART_TYPE_LABELS |
| 8 | **Admin — Plaka Yönetimi** | Plaka CRUD, kesim_sureleri JSONB format: {"MAK-1": 20, "MAK-2": 15, "KUTU": null}, PlakaParts ayrı görünüm (Liste/Parçalar toggle), SKU renk sistemi: djb2 hash → 20 pastel renk (deterministik), export: kesim_sureleri → buyuk_dk/kucuk_dk/kutu_dk ayrı kolonlar |
| 9 | **Admin — BOM & Montaj** | TanStack Table YOK (maks 16 adım/ürün), ProductSelector (combobox) → AssemblyStepsList (DnD) → StepBomPanel (inline), @dnd-kit: PointerSensor(distance:8) + KeyboardSensor, reorder: optimistic arrayMove → seq_no batch update, Collapsible kartlar, ASM referansları: GitBranch ikon + mavi badge, DAG güvenliği: deleteStep → bağımlılık kontrolü, reçete ağacı: recursive buildNode + visited Set, iki görünüm: "Adımlar" (DnD) / "Reçete Ağacı" (tree) |

#### Üretim Modülleri (Katman 10-14)

| # | Modül | Detay |
|---|-------|-------|
| 10 | **Üretim — Kesim** | Dashboard UI, makine ID: MAK-1/MAK-2/MAK-3/KUTU, kesim formu (plaka seçimi, makine seçimi), CutLines otomatik oluşturma (plaka_parts'tan), YarıMamulStok'a otomatik IN hareketi, durum akışı: bekliyor → kesiliyor → tamamlandi, tablet uyumlu kart layout |
| 11 | **Üretim — Temizlik** | cut_batches gruplama (kesilen parçaları birleştirme), CLN-XXXX auto-ID, başlat/bitir mekanizması, durum renkleri ile görsel takip |
| 12 | **Üretim — Montaj** | **Seans bazlı sistem** (eski batch MON-XXXX → yeni MNT-YYYYMMDD-HHMMSS), SKU + adım seçilerek seans başlatılır, durum: montajda → tamamlandi (2 durum), stok düşümü: YARIMAMUL → yari_mamul_stok OUT + HAZIR/KUTU/KARTON → all_parts stok azalt, is_final_step: son adım → paketlemeye hazır widget, birim_montaj_dk = süre / (adet × kişi), malzeme yeterliliği kontrolü |
| 13 | **Üretim — Paketleme** | Seans yönetimi (PKT-* ID), pack_events V2, StockMovements'a otomatik IN (mamül stoka giriş) |
| 14 | **Üretim — Kutu-Koli** | Kutu kesim/üretim (KUT-* ID), kutu_uretim tablosu, stok takibi |

#### Stok Modülleri (Katman 15-17)

| # | Modül | Detay |
|---|-------|-------|
| 15 | **Stok — Mamül** | Stok dashboard, TanStack Table + Recharts AreaChart, hareketler listesi (IN/OUT), trend grafik, 20K+ satır |
| 16 | **Stok — Yarı Mamül** | 234K satır yönetimi, parça bazlı stok durumu, IN/OUT yön gösterimi, eksik stok uyarısı |
| 17 | **Stok — Hazır Eleman + İade** | has_stock_access() guard, kritik stok uyarıları (all_parts.hazir_eleman_kritik_stok), stok giriş formu (HA-* auto-ID), iade yönetimi (IAD-* auto-ID) |

#### Sevkiyat (Katman 18, 7 alt katman)

| Alt | Modül | Detay |
|-----|-------|-------|
| 18 | **Sevkiyat — Base** | Sevkiyat listesi, durum akışı: bekliyor → hazirlaniyor → yolda → teslim_edildi → iptal, stok düşümü (sevkiyat onayında mamül stoktan OUT), iade yönetimi |
| 18A | **Ülke Bazlı ID** | Ülke kodu ile ID: DE21, UK29, FR15 vb., lojistik kolonlar (konteyner, dorse, taşıyıcı), sevkiyat_fiyatlar tablosu, Admin Fiyatlar sayfası |
| 18C | **Palet Şablonları** | Admin'de palet şablon tanımlama, sevkiyat oluştururken SKU seç → şablon otomatik dolar |
| 18D | **Planlama & PDF** | Sevkiyat detay sayfası (/sevkiyat/[id]), Proforma Invoice PDF (@react-pdf/renderer), Paket Listesi PDF |
| 18E | **Kapsamlı Revizyon** | 3 yeni tablo: sevkiyat_firmalar, sevkiyat_maliyetler, doviz_kurlari, SVI bug fix, dual tarih (planlanan vs. gerçekleşen) |
| 18F | **10 Madde Revizyon** | Stok kaldırma, iptal, dorse/taşıyıcı, tarih edit, toplamlar, sidebar, fiyatlar/maliyetler sayfaları |
| 18G | **Ayarlar (DB Tabanlı)** | Hardcoded ayarlar → app_settings tablosu (8 key: ülkeler, palet, konteyner, araç, maliyet, firma, durum, kur), server-only split pattern (shipment-settings.ts + shipment-settings-types.ts), admin ayarlar sayfası, 81 dosya refactor |

#### İş Süreçleri (Katman 19-23)

| # | Modül | Detay |
|---|-------|-------|
| 19 | **Satış** | Satış raporları (satis_raporlari tablosu), Excel upload ile toplu veri girişi, satış sonrası stok düşümü, PDF rapor export, kampanya yönetimi, TR pazarlama sayfası, satış ayarları |
| 20 | **Analiz & Dashboard** | 4 sekmeli dashboard (Genel, Üretim, Satış, Stok), 14 paralel Supabase query, 16 KPI kartı, 6 Recharts grafik, dönem filtresi, kolon adı dikkat noktaları (aktif_mi, baslama_zamani, durum, status) |
| 21 | **Personel & Yoklama** | Yoklama giriş formu, yoklama listesi, departman bazlı filtreleme, AreaChart + BarChart grafikleri |
| 22 | **Bildirimler** | notification_reads junction tablosu (okundu takibi), admin CRUD (bildirim oluşturma/düzenleme), Supabase Realtime ile canlı bildirim badge, bildirim kart UI |
| 23 | **Realtime & Polish** | Base hook (use-realtime-subscription.ts), debounce utility, 10 modül-spesifik realtime hook, RealtimeIndicator bileşeni (bağlantı durumu), skeleton loading states, metadata iyileştirmeleri |

#### Muhasebe & Finans (Katman 25-27)

| # | Modül | Detay |
|---|-------|-------|
| 25 | **DB — Muhasebe Tabloları** | 10 tablo: nakit_donemler, nakit_girisler, nakit_cikislar, odemeler, nakit_giris_takip, satis_giris, maliyet_giris, satis_data, maliyet_data, karlilik_data. RLS: is_admin_or_finance() (Yönetici + Muhasebe + E-Ticaret Müdürü). Excel seed |
| 26 | **Muhasebe — Nakit Akış** | **Dönem sistemi:** Her ay 2 dönem — D1 (1-14), D2 (15-son gün), kod: YYYY-M-D#. **Nakit Giriş:** 13 kanal (vigowood.com, Trendyol, Hepsiburada, Amazon TR/Y.Dışı, HAS-MOB, Döviz Satışı, Nakit Kredi — TL + USD). **Nakit Çıkış:** 27 kategori (22 TL + 5 USD). **Dashboard:** KPI kartları (Nakit Pozisyonu, Varlık, Borç, Net), dönem seçici, gelir/gider tabloları, borç yapısı, döviz pozisyonu, trend grafikleri. **Ödemeler:** TanStack Table, 13 tür (renk badge'li), durum güncelleme, yaklaşan ödemeler uyarısı, PDF export |
| 27 | **Muhasebe — Faaliyet Hesapları** | **Satış Girişi:** 20 pazaryeri/kanal, marka (VW/HAS-MOB), TL/USD, kur çevrimi. **Maliyet Girişi:** 12 kategori × 3 grup (VW/HM/ORTAK), ORTAK dağıtım: VW% + HM(100-%). **Kârlılık (P&L):** computeKarlilik engine (~80 satır/dönem), 3 marka raporu (GENEL/VW/HM), satır yapısı: GELİR → FAALİYET GELİRİ → GİDER → FAALİYET GİDERİ → FAVÖK → Marj% → FD Gelir → FD Gider → GENEL KAR → Marj%. Dönem: ay/çeyrek/yarıyıl/yıllık |

#### Pazaryeri Entegrasyonları (Katman 28)

| Alt | Modül | Detay |
|-----|-------|-------|
| 28A | **Trendyol** | REST API (Basic Auth), Base URL: apigw.trendyol.com/integration, Rate: 1000/min. Ürün sync (trendyol_products), sipariş sync (trendyol_orders), mutabakat (trendyol_settlements), claims, finans. Cron job'lar ile otomatik sync. Mock data fallback (401/403). MARKETPLACE_ACCESS_ROLES guard |
| 28B | **İkas (vigowood.com)** | OAuth2 Client Credentials (4 saat token ömrü), GraphQL API. 15.166 sipariş, 17.525 müşteri, 3 stok lokasyonu, 3 fiyat listesi (TR TRY, DE EUR, FR EUR). 3 sayfa: Siparişler, Ürünler, Müşteriler |
| 28C | **İkas Orders DB** | ikas_orders tablosu (ikas_id UNIQUE, line_items JSONB), RLS: SELECT auth / write service_role only |
| 28D | **Genel Dashboard** | Trendyol + İkas birleşik KPI kartları, kanal karşılaştırma, daily/weekly/monthly_summary tabloları |

#### SKU Eşleştirme & Fiyatlama (Katman 31 + Fiyatlama)

| # | Modül | Detay |
|---|-------|-------|
| 31 | **SKU Eşleştirme** | sku_mappings tablosu (master_sku, channel, channel_sku, channel_barcode, match_method, match_status), UNIQUE (channel, channel_barcode), /admin/sku-eslestirme yönetim sayfası, multi-channel summary tablolarına channel + master_sku eklendi |
| — | **Fiyatlama Faz 1** | DB: 7 tablo (marketplaces, shipping_providers, marketplace_shipping, product_target_prices, product_box_dimensions, marketplace_listings, pricing_snapshots) + seed + types + constants |
| — | **Fiyatlama Faz 2** | Yönetim sayfaları: hedef-fiyatlar, kutu-boyutlari, kargo, panel + inline editing + snapshot |
| — | **Fiyatlama Faz 3** | Hesaplama motoru (pricingCalculator.ts), KPI kartları, Excel export |
| — | **Fiyatlama Faz 4** | Geçmiş takibi (/pazaryeri/fiyatlama/gecmis + [donemKodu] detay) + Pazaryerleri arası karşılaştırma (/pazaryeri/fiyatlama/karsilastirma) |

#### Operasyon Merkezi (Katman 30)

| Aşama | Detay |
|-------|-------|
| **Aşama 1 — Görevler** | tasks, task_comments, task_attachments, task_activity tabloları. 5 enum (priority, status). Kanban board (4 kolon: scheduled/queue/in_progress/done). Inbox (/ops/gorevlerim). Supabase Storage dosya ekleri |
| **Aşama 2 — Ajanlar & Onay** | ops_agents (6 sanal ajan), ops_approvals (onay mekanizması), ops_outputs (çıktılar). Onay sayfası (/ops/onaylar), raporlar (/ops/raporlar) |
| **Aşama 3 — Agent System** | agent_memory, agent_actions, agent_messages, job_definitions, job_runs, monitor_definitions, alerts tabloları. Agent chat (/ops/chat) — Anthropic SDK ile Claude API. Kullanım istatistikleri (/ops/kullanim). task_templates, recurring_tasks, task_runs. 3 görünüm: Pano (Kanban), Liste (Tablo), Takvim (Grid). Boolean flags: is_blocked, is_waiting_approval |

#### Güvenlik (Katman 29)

| Kontrol | Detay |
|---------|-------|
| Auth | 47 server action dosyasında requireAuth/requireAdmin guard |
| API Routes | 15 route'da auth kontrolü |
| RLS | Her tabloda SECURITY DEFINER fonksiyonlar |
| Service Key | admin.ts'e "server-only" import, client'a sızma engelli |
| Rate Limit | 8 API route'a rate limiting |
| Headers | CSP + Permissions-Policy |
| Data | password_plain getCurrentUser()'dan kaldırıldı |
| Env | .env.example'da CRON_SECRET |
| Charts | Recharts lazy loading (17 chart, next/dynamic + ssr:false + skeleton) |

### 4.2 Bekleyen Katmanlar

| # | Modül | Açıklama |
|---|-------|----------|
| 28+ | Amazon SP-API | Amazon Türkiye ve yurtdışı pazaryeri entegrasyonu |
| 28+ | Hepsiburada API | Hepsiburada pazaryeri entegrasyonu |
| 28+ | WhatsApp Bildirimleri | Operatörlere WhatsApp üzerinden bildirim |
| 28+ | PPC Dashboard | Reklam harcama takibi ve analizi |
| 28+ | AI Tahmin | Stok ve satış tahminleme |
| 28+ | ERP Entegrasyonu | Fatura import, muhasebe yazılımı bağlantısı |
| 28+ | Otomatik Mail | n8n worker üzerinden periyodik rapor e-postaları |

---

## 5. Üretim Akışı

```
MDF Plaka → KESİM (lazer) → TEMİZLİK → MONTAJ (1-16 adım) → PAKETLEME → SEVKİYAT
               │                │            │                    │
               ▼                ▼            ▼                    ▼
          YarıMamulStok    YarıMamulStok  YarıMamulStok     StockMovements
            IN                 güncelle       OUT                 IN
```

### Stok Katmanları
| Katman | Çeşit | Açıklama |
|--------|-------|----------|
| Yarı Mamül | 269 | Kesilen parçalar (MDF, sunta vb.) |
| Hazır Eleman | 68 | Satın alınan: menteşe, vida, mıknatıs |
| Kutu/Karton | 42 | Ambalaj malzemesi |
| Mamül | 974 (101 aktif) | Bitmiş ürün (paketlenmiş) |

### BOM (Bill of Materials) Yapısı
Montaj adımlarında bir adımın çıktısı başka adımın girdisi olabiliyor (427 kayıt). `step_bom.part_id` bazen `ASM-XXXX` formatında — bu önceki adıma referans. **DAG (Directed Acyclic Graph)** yapısı, basit bir liste değil.

### Auto-ID Formatları
| Modül | Format | Örnek |
|-------|--------|-------|
| Kesim Partisi | KES-XXXX | KES-0042 |
| Temizlik | CLN-XXXX | CLN-0108 |
| Montaj Seansı | MNT-YYYYMMDD-HHMMSS | MNT-20260301-143022 |
| Paketleme | PKT-YYYYMMDD-HHMMSS | PKT-20260228-091500 |
| Kutu Üretim | KUT-XXXX | KUT-0015 |
| Montaj Adımı | ASM-XXXX | ASM-0003 |
| StepBOM | SBOM-XXXX | SBOM-0127 |
| Hazır Eleman Giriş | HA-XXXX | HA-0055 |
| İade | IAD-XXXX | IAD-0012 |
| Sevkiyat | XX## (ülke+sıra) | DE21, UK29 |

---

## 6. Kullanıcılar

### Rol Tablosu
| Rol | Kişi | Cihaz | Erişim Modülleri |
|-----|------|-------|------------------|
| Yönetici | 4 | Web | Tüm modüller |
| Endüstri Mühendisi | 1 | Web | Admin, üretim, stok, analiz |
| E-Ticaret Müdürü | 1 | Web + Tel | Satış, pazaryeri, muhasebe |
| Dış Ticaret Müdürü | 1 | Web + Tel | Sevkiyat, satış |
| Üretim (Operatör) | 38 | Tablet | Üretim modülleri |
| Hat Sorumlusu | 7 | Tablet | Üretim + stok |
| Muhasebe | 1 | Web | Muhasebe modülleri |
| Sevkiyat Sorumlusu | 1 | Web + Tablet | Sevkiyat |
| Pazaryeri Sorumlusu | 1 | Web | Satış, pazaryeri |
| Mimar | 1 | Web | Ürün, analiz |

### Shared (Paylaşımlı) Hesaplar
Fabrikadaki tablet istasyonlarında ortak email ile giriş yapılır:
- `kesim@vigowood.com` — Kesim istasyonu
- `temizlik@vigowood.com` — Temizlik istasyonu
- `montaj@vigowood.com` — Montaj hattı 1
- `montaj2@vigowood.com` — Montaj hattı 2
- `paketleme@vigowood.com` — Paketleme istasyonu
- `kutu@vigowood.com` — Kutu üretim

Giriş sonrası form içinde kişisel operatör seçimi yapılır (VW022 gibi UserID). Seçilen operatör `user_metadata.selected_operator_id/name` olarak Supabase Auth'ta saklanır.

### RLS Erişim Fonksiyonları
| Fonksiyon | Erişim Veren Roller |
|-----------|---------------------|
| `is_admin()` | Yönetici |
| `is_admin_or_engineer()` | Yönetici, Endüstri Mühendisi |
| `has_production_access()` | Yönetici, Endüstri Mühendisi, Üretim, Hat Sorumlusu |
| `has_stock_access()` | Yönetici, Endüstri Mühendisi, Hat Sorumlusu |
| `is_admin_or_finance()` | Yönetici, Muhasebe, E-Ticaret Müdürü |
| `has_personel_access()` | Yönetici, departman müdürleri |

---

## 7. Veritabanı

### Genel Bilgiler
- **75 migration** dosyası uygulandı
- **Supabase Pro** — West EU (Ireland), Project Ref: `mdxaktebpuhlwacqcven`
- **RLS:** Her tabloda SECURITY DEFINER fonksiyonlar (inline subquery YASAK — infinite recursion)
- **Realtime:** Üretim ve stok tablolarında Supabase Realtime subscription
- **Storage:** Ops Center dosya ekleri için Supabase Storage bucket

### Tablo Listesi

#### Master Data (Ana Veriler)
| Tablo | Açıklama | ~Satır | Önemli Kolonlar |
|-------|----------|--------|-----------------|
| products | Ürün kataloğu | 974 | sku, urun_adi, aktif_mi, kategori |
| users | Kullanıcılar | 56 | user_id, email, role, ad_soyad |
| all_parts | Tüm parçalar | ~400 | part_id, part_adi, part_type, hazir_eleman_kritik_stok |
| plakalar | MDF plakalar | ~208 | plaka_id (UNIQUE), plaka_adi, sku, kesim_sureleri (JSONB) |
| plaka_parts | Plaka-parça ilişkisi | ~208 | plaka_id (FK), part_id (FK), default_qty |
| assembly_steps | Montaj adımları | ~250 | step_id, sku, step_no, seq_no, aciklama |
| step_bom | Malzeme listesi (BOM) | ~427 | step_id, part_id (ASM-XXXX olabilir), miktar |
| kesim_makinesi | Kesim makineleri | ~4 | makine_id (MAK-1/2/3/KUTU) |

#### Üretim İşlemleri
| Tablo | Açıklama | ~Satır | Durum Akışı |
|-------|----------|--------|-------------|
| cut_batches | Kesim partileri | ~1K | bekliyor → kesiliyor → tamamlandi |
| cut_lines | Kesim satırları | ~5K | Otomatik oluşturulur |
| clean | Temizlik kayıtları | ~1K | bekliyor → temizleniyor → tamamlandi |
| montaj_sessions | Montaj seansları | Aktif | montajda → tamamlandi |
| pack_events | Paketleme olayları | Aktif | Seans bazlı |
| kutu_uretim | Kutu üretimi | Aktif | KUT-* ID |

#### Stok
| Tablo | Açıklama | ~Satır |
|-------|----------|--------|
| yari_mamul_stok | Yarı mamül stok hareketleri | 234K+ |
| stock_movements | Mamül stok hareketleri | 20K+ |
| hazir_eleman_akis | Hazır eleman giriş/çıkış | Aktif |
| iade_giris | İade kayıtları | Aktif |

#### Sevkiyat
| Tablo | Açıklama |
|-------|----------|
| sevkiyat | Ana sevkiyat kaydı (ülke bazlı ID) |
| sevkiyat_kalemleri | Sevkiyat içi ürünler |
| sevkiyat_firmalar | Lojistik firmaları |
| sevkiyat_maliyetler | Sevkiyat maliyet kalemleri |
| sevkiyat_fiyatlar | Ülke/ürün bazlı fiyatlar |
| doviz_kurlari | Döviz kurları |
| palet_sablonlari / palet_sablon_kalemleri | Palet şablonları |
| app_settings | Sevkiyat ayarları (8 key) |

#### Satış
| Tablo | Açıklama |
|-------|----------|
| satis_raporlari | Satış raporları |
| satis_kampanyalar | Kampanyalar |

#### Muhasebe & Finans
| Tablo | Açıklama | Dönem Formatı |
|-------|----------|---------------|
| nakit_donemler | Dönem yönetimi | YYYY-M-D# (ör. 2026-2-D1) |
| nakit_girisler | Kanal bazlı gelir (13 kanal) | D1/D2 (15'er gün) |
| nakit_cikislar | Kategori bazlı gider (27 kat.) | D1/D2 |
| odemeler | Bireysel ödeme kayıtları | ~293 kayıt, 2028'e kadar |
| nakit_giris_takip | Beklenen alacaklar | — |
| satis_giris | Aylık satış girişi (20 pazaryeri) | YYYY_MM |
| maliyet_giris | Aylık maliyet girişi (12 kat.) | YYYY_MM |
| satis_data | Hesaplanmış satış verileri | — |
| maliyet_data | Hesaplanmış maliyet (ORTAK dağıtımlı) | — |
| karlilik_data | P&L gelir tablosu (~80 satır/dönem) | — |

#### Pazaryeri Entegrasyonları
| Tablo | Açıklama |
|-------|----------|
| trendyol_products | Trendyol ürünleri (sync) |
| trendyol_orders | Trendyol siparişleri (sync) |
| trendyol_settlements | Trendyol mutabakat |
| trendyol_refunds | Trendyol iadeler |
| trendyol_claims | Trendyol talepler |
| ikas_orders | İkas siparişleri (ikas_id UNIQUE, line_items JSONB) |
| sku_mappings | SKU eşleştirme (master_sku, channel, channel_barcode) |
| daily_summary | Günlük kanal bazlı özet |
| weekly_sku_summary | Haftalık SKU bazlı özet |
| monthly_sku_summary | Aylık SKU bazlı özet |

#### Fiyatlama
| Tablo | Açıklama |
|-------|----------|
| marketplaces | Pazaryeri tanımları |
| shipping_providers | Kargo firmaları |
| marketplace_shipping | Pazaryeri-kargo ilişkileri |
| product_target_prices | Ürün hedef fiyatları |
| product_box_dimensions | Ürün kutu boyutları |
| marketplace_listings | Pazaryeri listeleme bilgileri |
| pricing_snapshots | Fiyatlama dönem snapshot'ları |

#### Operasyon Merkezi
| Tablo | Açıklama |
|-------|----------|
| tasks | Görevler (Kanban) |
| task_comments | Görev yorumları |
| task_attachments | Dosya ekleri |
| task_activity | Aktivite logu |
| task_templates | Görev şablonları |
| recurring_tasks | Tekrarlayan görevler |
| task_runs | Görev çalıştırma kayıtları |
| ops_agents | Sanal ajanlar (6 ajan) |
| ops_approvals | Onay kayıtları |
| ops_outputs | Ajan çıktıları |
| agent_memory | Ajan hafızası |
| agent_actions | Ajan aksiyonları |
| agent_messages | Ajan mesajları |
| agent_chats | Chat geçmişi |
| job_definitions | İş tanımları |
| job_runs | İş çalıştırma kayıtları |
| monitor_definitions | Monitör tanımları |
| alerts | Uyarılar |

#### Diğer
| Tablo | Açıklama |
|-------|----------|
| attendance | Yoklama kayıtları |
| notifications | Bildirimler |
| notification_reads | Okundu takibi (junction) |

### Migration Geçmişi (75 dosya)

**Faz 1 — Çekirdek (001-015):** users, products, all_parts, plakalar, assembly_steps, step_bom, işlem tabloları (cut_batches, clean, pack_events, stock_movements, yari_mamul_stok 234K), RLS recursion fix (SECURITY DEFINER), sevkiyat v1

**Faz 2 — Geliştirme (016-022):** Sevkiyat v2/v3, palet şablonları, döviz kurları, satış tabloları

**Faz 3 — İş Özellikleri (023-032):** Paketleme v2, personel/yoklama, bildirimler v2, plaka refactor (kesim_sureleri JSONB), app_settings, makineler, users password, satış ayarları

**Faz 4 — Muhasebe (20260221-20260222):** KDV oranı precision, BOM RLS, muhasebe finans (8 tablo), kârlılık kur precision, MDF eleman, sevkiyat ayarları DB, makine ID rename, karton/plaka ayrımı

**Faz 5 — İleri Özellikler (20260222-20260224):** Montaj sessions, ödemeler kredi grubu, performans composite indexes, Trendyol sync tabloları

**Faz 6 — Ops Center (20260224-20260226):** Tasks v1, agents + approvals, agent system v2, İkas orders, user avatars, Ops Center v3, agents v3

**Faz 7 — Ops & Trendyol (20260226-20260228):** Task queue fix, FK constraint drop, agent chats, Trendyol finans/commission/claims, ops assignee flag

**Faz 8 — SKU & Fiyatlama (20260228-20260305):** SKU mappings, daily/weekly/monthly summary tabloları, fiyatlama tabloları (marketplaces, shipping_providers, marketplace_shipping, product_target_prices, product_box_dimensions, marketplace_listings, pricing_snapshots), seed verileri

---

## 8. Proje Yapısı (Detaylı)

```
vigowood-app/
├── CLAUDE.md                        # Proje rehberi (renk paleti, tech stack, katmanlar)
├── MEMORY.md                        # Geliştirme ilerlemesi ve kararlar
├── PROJECT_OVERVIEW.md              # Bu dosya
├── .env.local                       # Ortam değişkenleri (git-ignored)
├── .env.example                     # Ortam değişkenleri şablonu
├── package.json                     # Bağımlılıklar (v0.1.0)
├── next.config.ts                   # Next.js yapılandırması
├── tsconfig.json                    # TypeScript strict mode
├── components.json                  # shadcn/ui yapılandırması
├── vercel.json                      # Vercel deployment config
├── data/                            # Kaynak Excel/CSV (git-ignored)
├── scripts/                         # Yardımcı scriptler
├── supabase/
│   └── migrations/                  # 60 SQL migration dosyası
│
└── src/
    ├── middleware.ts                 # Next.js middleware (auth session, cookie karşılaştırma)
    │
    ├── app/
    │   ├── (auth)/                  # Auth route grubu
    │   │   ├── login/               # Giriş sayfası + actions
    │   │   └── select-operator/     # Shared hesap operatör seçimi
    │   │
    │   ├── (dashboard)/             # Korumalı dashboard route grubu
    │   │   ├── layout.tsx           # Dashboard shell (Server Component → DashboardShell Client)
    │   │   ├── page.tsx             # Ana sayfa
    │   │   ├── error.tsx            # Error boundary (SİLME!)
    │   │   ├── loading.tsx          # Loading skeleton (SİLME!)
    │   │   │
    │   │   ├── admin/               # Admin paneli (12 alt modül)
    │   │   │   ├── urunler/         #   Ürün CRUD, toplu toggle
    │   │   │   ├── parcalar/        #   Parça CRUD, kritik stok
    │   │   │   ├── plakalar/        #   Plaka CRUD, kesim süreleri, PlakaParts
    │   │   │   ├── bom/             #   Montaj adımları (DnD), StepBOM, reçete ağacı
    │   │   │   ├── kullanicilar/    #   Kullanıcı yönetimi
    │   │   │   ├── makineler/       #   Makine yönetimi
    │   │   │   ├── hazir-eleman/    #   Hazır eleman tanımları
    │   │   │   ├── palet-sablonlari/#   Palet şablonları
    │   │   │   ├── karton-sablonlari/#  Karton şablonları
    │   │   │   ├── firmalar/        #   Firma yönetimi
    │   │   │   ├── fiyatlar/        #   Fiyat yönetimi
    │   │   │   ├── sku-eslestirme/  #   SKU eşleştirme yönetimi
    │   │   │   └── ayarlar/         #   Uygulama ayarları
    │   │   │
    │   │   ├── uretim/              # Üretim akışı (5 istasyon)
    │   │   │   ├── kesim/           #   MAK-1/2/3/KUTU, CutLines
    │   │   │   ├── temizlik/        #   CLN-XXXX, gruplama
    │   │   │   ├── montaj/          #   MNT-* seans, malzeme kontrolü
    │   │   │   ├── paketleme/       #   PKT-* seans, mamül stok IN
    │   │   │   └── kutu/            #   KUT-*, kutu üretim
    │   │   │
    │   │   ├── stok/                # Stok yönetimi (4 katman)
    │   │   │   ├── mamul/           #   Mamül stok dashboard, trend
    │   │   │   ├── yari-mamul/      #   234K satır, IN/OUT
    │   │   │   ├── hazir-eleman/    #   Kritik stok uyarı, giriş
    │   │   │   └── iade/            #   İade yönetimi
    │   │   │
    │   │   ├── sevkiyat/            # Sevkiyat (7 alt modül)
    │   │   │   ├── [id]/            #   Sevkiyat detay/planlama
    │   │   │   ├── yeni/            #   Yeni sevkiyat
    │   │   │   ├── sablonlar/       #   Palet şablonları
    │   │   │   ├── fiyatlar/        #   Ürün fiyatları
    │   │   │   ├── kurlar/          #   Döviz kurları
    │   │   │   ├── maliyetler/      #   Maliyet takibi
    │   │   │   └── ayarlar/         #   Sevkiyat ayarları (DB tabanlı)
    │   │   │
    │   │   ├── satis/               # Satış (4 alt modül)
    │   │   │   ├── raporlar/        #   Satış raporları + Excel upload
    │   │   │   ├── kampanyalar/     #   Kampanya yönetimi
    │   │   │   ├── pazarlama/       #   TR pazarlama
    │   │   │   └── ayarlar/         #   Satış ayarları
    │   │   │
    │   │   ├── pazaryeri/           # Pazaryeri entegrasyonları
    │   │   │   ├── genel/           #   Birleşik KPI dashboard
    │   │   │   ├── trendyol/        #   5 alt sayfa (sipariş, ürün, soru, iade, finans)
    │   │   │   ├── vigowood-com/    #   3 alt sayfa (sipariş, ürün, müşteri)
    │   │   │   └── fiyatlama/      #   Panel, hedef-fiyatlar, kutu-boyutlari, kargo, gecmis, karsilastirma
    │   │   │
    │   │   ├── muhasebe/            # Muhasebe & Finans
    │   │   │   ├── nakit-akis/      #   Dashboard + yeni dönem + düzenleme
    │   │   │   ├── odemeler/        #   Ödeme listesi + CRUD
    │   │   │   └── faaliyet/        #   Satış/maliyet girişi + kârlılık P&L
    │   │   │
    │   │   ├── analiz/              # Analiz (4 sekme: Genel/Üretim/Satış/Stok)
    │   │   ├── personel/            # Yoklama giriş + liste
    │   │   ├── bildirimler/         # Bildirim listesi
    │   │   │
    │   │   └── ops/                 # Operasyon Merkezi (7 sayfa)
    │   │       ├── board/           #   Kanban (4 kolon)
    │   │       ├── gorevlerim/      #   Inbox
    │   │       ├── onaylar/         #   Onay yönetimi
    │   │       ├── raporlar/        #   Raporlar/çıktılar
    │   │       ├── ajanlar/         #   Sanal ajan listesi
    │   │       ├── chat/            #   Agent chat (Claude API)
    │   │       └── kullanim/        #   Kullanım istatistikleri
    │   │
    │   └── api/                     # API Routes (14 dosya)
    │       ├── cron/                #   5 cron job (kritik-stok, kurlar, trendyol×3)
    │       ├── muhasebe/            #   Nakit akış GET + ödeme PDF'leri (2)
    │       ├── ops/                 #   Chat API + output PDF
    │       ├── satis/               #   Satış raporu PDF
    │       ├── sevkiyat/            #   Proforma + paket listesi PDF
    │       └── trendyol-sync/       #   Manuel sync tetikleme
    │
    ├── components/
    │   ├── ui/                      # shadcn/ui (25 bileşen)
    │   │   ├── alert-dialog.tsx     button.tsx       card.tsx
    │   │   ├── avatar.tsx           badge.tsx        checkbox.tsx
    │   │   ├── collapsible.tsx      command.tsx      dialog.tsx
    │   │   ├── dropdown-menu.tsx    input.tsx        label.tsx
    │   │   ├── popover.tsx          scroll-area.tsx  select.tsx
    │   │   ├── separator.tsx        sheet.tsx        sidebar.tsx
    │   │   ├── skeleton.tsx         sonner.tsx       switch.tsx
    │   │   ├── table.tsx            tabs.tsx         textarea.tsx
    │   │   └── tooltip.tsx
    │   │
    │   ├── layout/                  # Layout bileşenleri (7 dosya)
    │   │   ├── app-sidebar.tsx      # Ana sidebar (shadcn Sidebar, collapsible="icon")
    │   │   ├── dashboard-shell.tsx  # Dashboard wrapper (TooltipProvider dahil)
    │   │   ├── top-navbar.tsx       # Üst bar (bildirim badge, profil)
    │   │   ├── mobile-nav.tsx       # Mobil hamburger menü (Sheet drawer)
    │   │   ├── mobile-bottom-nav.tsx # Mobil alt navigasyon (max 5 item)
    │   │   ├── navbar.tsx           # Eski navbar (deprecated)
    │   │   └── sidebar.tsx          # Eski sidebar (deprecated)
    │   │
    │   ├── shared/                  # Ortak bileşenler (15 dosya)
    │   │   ├── data-table.tsx               # TanStack Table wrapper
    │   │   ├── data-table-column-header.tsx  # Sıralama başlıkları
    │   │   ├── data-table-pagination.tsx     # Sayfalama
    │   │   ├── excel-import-dialog.tsx       # Excel import dialog
    │   │   ├── adet-input.tsx               # Miktar input
    │   │   ├── avatar-upload.tsx            # Avatar yükleme
    │   │   ├── chart-skeleton.tsx           # Grafik skeleton
    │   │   ├── skeleton-card.tsx            # Kart skeleton
    │   │   ├── skeleton-table.tsx           # Tablo skeleton
    │   │   ├── last-updated-badge.tsx       # Veri güncellik göstergesi
    │   │   ├── live-timer.tsx               # Canlı sayaç
    │   │   ├── realtime-indicator.tsx       # Bağlantı durumu
    │   │   ├── logout-button.tsx            # Çıkış butonu
    │   │   └── user-avatar.tsx              # Kullanıcı avatarı
    │   │
    │   └── providers/               # Context providers
    │
    ├── hooks/                       # Custom hooks (17 dosya)
    │   ├── use-realtime-subscription.ts     # Base Supabase realtime hook
    │   ├── use-realtime-status.ts           # Genel durum subscription
    │   ├── use-dashboard-realtime.ts        # Dashboard KPI sync
    │   ├── use-kesim-realtime.ts            # Kesim canlı güncelleme
    │   ├── use-temizlik-realtime.ts         # Temizlik canlı güncelleme
    │   ├── use-montaj-session-realtime.ts   # Montaj seans sync
    │   ├── use-paketleme-realtime.ts        # Paketleme sync
    │   ├── use-kutu-realtime.ts             # Kutu üretim sync
    │   ├── use-sevkiyat-realtime.ts         # Sevkiyat sync
    │   ├── use-stok-mamul-realtime.ts       # Mamül stok sync
    │   ├── use-stok-yari-mamul-realtime.ts  # Yarı mamül stok sync
    │   ├── use-stok-hazir-eleman-realtime.ts # Hazır eleman sync
    │   ├── use-notification-realtime.ts     # Bildirim sync
    │   ├── use-unread-count.ts              # Okunmamış bildirim sayısı
    │   ├── use-supabase.ts                  # Supabase client hook
    │   ├── use-mobile.ts                    # Mobil breakpoint algılama
    │   └── use-server-data-cache.ts         # Server data cache
    │
    ├── lib/                         # Yardımcı kütüphaneler (34 dosya)
    │   ├── auth.ts                  # Auth utilities (server-only import!)
    │   ├── constants.ts             # 1238 satır — tüm enum, renk, label, sabitler
    │   ├── navigation.ts            # Menü yapısı, NavGroup/NavItem tipleri, getFilteredNavGroups(role)
    │   ├── validations.ts           # Zod şemaları (ürün, parça, plaka, montaj, ödeme vb.)
    │   ├── utils.ts                 # Genel yardımcı fonksiyonlar
    │   ├── cached-queries.ts        # Sorgu önbellekleme
    │   ├── debounce.ts              # Debounce utility
    │   ├── excel-utils.ts           # Excel import/export
    │   ├── rate-limit.ts            # API rate limiting
    │   ├── sku-colors.ts            # djb2 hash → 20 pastel renk
    │   ├── sales-settings.ts        # Satış ayarları
    │   ├── shipment-settings.ts     # Sevkiyat ayarları (DB, server-only)
    │   ├── shipment-settings-types.ts # Sevkiyat ayar tipleri (client-safe)
    │   │
    │   ├── supabase/                # Supabase entegrasyonu
    │   │   ├── client.ts            # Browser-side Supabase
    │   │   ├── server.ts            # Server-side Supabase (cookies)
    │   │   ├── admin.ts             # Service role (server-only!)
    │   │   ├── middleware.ts        # Auth middleware
    │   │   └── types.ts             # DB types (npx supabase gen types)
    │   │
    │   ├── trendyol/                # Trendyol API (8 dosya)
    │   │   ├── client.ts            # Basic Auth, 1000 req/min
    │   │   ├── types.ts             # TypeScript tanımları
    │   │   ├── queries.ts           # Veri çekme
    │   │   ├── sync.ts              # Sipariş/ürün sync
    │   │   ├── helpers.ts           # Yardımcı fonksiyonlar
    │   │   ├── mock-data.ts         # Fallback mock (401/403)
    │   │   └── __tests__/           # Unit testler (2 dosya)
    │   │
    │   ├── ikas/                    # İkas API (6 dosya)
    │   │   ├── client.ts            # OAuth2 GraphQL (4 saat token)
    │   │   ├── types.ts             # TypeScript tanımları
    │   │   ├── queries.ts           # Veri çekme
    │   │   ├── helpers.ts           # Yardımcı fonksiyonlar
    │   │   └── mock-data.ts         # Fallback mock
    │   │
    │   └── pdf/
    │       └── pdf-utils.ts         # PDF ortak fonksiyonlar
    │
    └── types/
        └── index.ts                 # Global TypeScript tipleri
```

---

## 9. Mimari Kararlar ve Tasarım Kalıpları

### 9.1 Veri Akışı Pattern'ı
```
Server Component (page.tsx)
  → Supabase query (server-side)
  → Client Component (data table / form)
  → URL search params ile pagination/sorting/filtering
  → Server action (actions.ts) ile mutation
  → revalidatePath ile yenileme
```

### 9.2 RLS (Row-Level Security)
- **ASLA** inline subquery yazma (`USING (EXISTS (SELECT FROM users ...))` → infinite recursion)
- Her zaman SECURITY DEFINER fonksiyon kullan
- Migration: `009_fix_rls_recursion.sql`

### 9.3 Auth & Middleware
- `src/lib/auth.ts`: `server-only` import — client component'lerde kullanılamaz
- `src/lib/constants.ts`: `isStationEmail()` — client+server güvenli
- Middleware'deki cookie karşılaştırma kodu (existingCookies Map) KALDIRILMAMALI — Next.js 16 sonsuz re-render önler
- Station hesapları: login → `/select-operator` → operatör seç → dashboard

### 9.4 TanStack Table Pattern
- `manualPagination + manualSorting` (server-driven)
- URL search params ile state yönetimi (sayfa yenilemeli)
- Shared bileşenler: data-table.tsx, data-table-pagination.tsx, data-table-column-header.tsx
- pageSize fallback: `Number(params.pageSize || "25")` (NaN bug fix)

### 9.5 Realtime Subscription Pattern
```
use-realtime-subscription.ts (base hook)
  → use-kesim-realtime.ts (feature-specific)
  → debounce ile gereksiz re-render önleme
  → Otomatik cleanup on unmount
```

### 9.6 Chart Lazy Loading
- `next/dynamic` + `ssr: false` + `ChartSkeleton` loading
- 17 chart bileşeni bu pattern ile yüklenir
- Hydration mismatch önlenir

### 9.7 Server-Only Split Pattern (Sevkiyat Ayarları)
```
shipment-settings.ts (DB okuma, server-only)
  → Sadece server component/action'larda import edilir
shipment-settings-types.ts (type tanımları, client-safe)
  → Hem client hem server'da import edilebilir
```

### 9.8 Form Validation
- Zod v4 + @hookform/resolvers
- `z.coerce.number()` + zodResolver uyumsuz → `z.number()` + `register({valueAsNumber:true})` kullan
- Tüm şemalar `src/lib/validations.ts`'de merkezi

### 9.9 Auto-ID Oluşturma
- Son kaydı sorgula → +1 ile yeni ID
- Format: ASM-XXXX, SBOM-XXXX, KES-XXXX, CLN-XXXX vb.
- Sevkiyat: Ülke kodu + sıra no (DE21, UK29)

### 9.10 PDF Oluşturma
- `@react-pdf/renderer` ile server-side PDF
- API route'lar: /api/sevkiyat/[id]/proforma, /api/sevkiyat/[id]/packing-list
- Ortak fonksiyonlar: `src/lib/pdf/pdf-utils.ts`

---

## 10. Renk Paleti

### Ana Tema (Natural Color)
| Token | Hex | Kullanım |
|-------|-----|----------|
| Primary | `#cdbd9d` | Header, ana butonlar, sidebar |
| Light | `#f0ede1` | Sayfa arka planı |
| Side | `#a99c7d` | Border, ikincil elemanlar |
| Deep | `#5e5747` | Hover, aktif state |
| Dark | `#474237` | Metin, başlıklar, sidebar dark |

### Fonksiyonel Renkler
| Token | Hex | Kullanım |
|-------|-----|----------|
| Success | `#70c1aa` | Tamamlandı, onay |
| Warning | `#f28a19` | Devam ediyor, dikkat |
| Error | `#ee7683` | Hata, kritik stok |
| Info | `#3368b1` | Bilgi, link |

### CSS Kullanımı
- shadcn token'lar: `bg-primary`, `text-foreground`, `bg-destructive` (VigoWood renklerine map'li)
- Custom token'lar: `bg-vw-primary`, `text-vw-dark`, `bg-vw-success` (doğrudan erişim)
- Sidebar: `--sidebar` = dark wood (#474237), `--sidebar-primary` = ahşap (#cdbd9d)

---

## 11. Ortam Değişkenleri

| Değişken | Açıklama | Zorunlu |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase instance URL | Evet |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key | Evet |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only!) | Evet |
| `CRON_SECRET` | Cron job kimlik doğrulama | Evet |
| `TRENDYOL_API_KEY` | Trendyol API key | Trendyol modülü için |
| `TRENDYOL_API_SECRET` | Trendyol API secret | Trendyol modülü için |
| `TRENDYOL_SELLER_ID` | Trendyol satıcı ID (tırnaksız!) | Trendyol modülü için |
| `IKAS_CLIENT_ID` | İkas OAuth client ID | İkas modülü için |
| `IKAS_CLIENT_SECRET` | İkas OAuth client secret | İkas modülü için |
| `IKAS_STORE_NAME` | İkas mağaza adı | İkas modülü için |
| `ANTHROPIC_API_KEY` | Claude API key | Ops Center chat için |

---

## 12. Deployment & Altyapı

### Vercel (Frontend)
- **Plan:** Pro ($20/ay)
- **Deploy:** Git push → otomatik build & deploy
- **Routes:** 90+ route (sıfır hata)

### Supabase (Backend)
- **Plan:** Pro ($25/ay)
- **Region:** West EU (Ireland)
- **Project Ref:** `mdxaktebpuhlwacqcven`
- **Özellikler:** PostgreSQL, Auth, Realtime, RLS, Storage

### Hetzner VPS (Worker)
- **Görev:** n8n workflow engine, Python worker, cron job'lar
- **Cron'lar:** Trendyol sync (ürün, sipariş, mutabakat), kritik stok kontrolü, döviz kuru güncelleme

---

## 13. Geliştirme Komutları

```bash
# Geliştirme sunucusu
npm run dev

# Production build (87 route, 0 hata)
npm run build

# Lint kontrolü
npm run lint

# Test çalıştırma
npm run test
npm run test:watch

# Supabase migration uygula
npx supabase db push

# Supabase migration listesi (local vs remote)
npx supabase migration list

# Supabase types regenerate
npx supabase gen types typescript --project-id mdxaktebpuhlwacqcven > src/lib/supabase/types.ts
# DİKKAT: Sonuna custom alias'ları eklemeyi unutma!

# shadcn/ui bileşen ekle
npx shadcn@latest add [bileşen-adı]
```

### Bilinen Sorunlar (Windows)
- `echo`, `pwd`, `ls` bazen exit code 1/2 verir (Git Bash on Windows)
- Workaround: `node -e "..."` ile JS üzerinden dosya işlemleri
- Git add'de parantezli yolları tırnak içinde yaz: `"src/app/(auth)/..."`
- `npx`, `npm`, `git` komutları genelde sorunsuz

---

## 14. Kodlama Standartları

| Kural | Detay |
|-------|-------|
| **DB kolonları** | snake_case (ör. `plaka_adi`, `created_at`) |
| **Frontend değişkenler** | camelCase (ör. `plakaAdi`, `createdAt`) |
| **Bileşen isimleri** | PascalCase (ör. `ProductEditSheet`) |
| **Tarih gösterimi** | GG.AA.YYYY (arayüz), ISO 8601 (DB) |
| **Para birimi** | ₺ (TL) ve $ (USD) |
| **Arayüz dili** | Türkçe (label, placeholder, hata mesajları, butonlar) |
| **Responsive** | Mobile-first: Mobile (<640px), Tablet (640-1024px), Desktop (>1024px) |
| **TypeScript** | Strict mode, Supabase `.select("*")` → `as Type[]` cast gerekli |
| **Form validation** | Zod şemaları validations.ts'de merkezi |
| **Toast** | Sonner — `<Toaster richColors position="top-right" />` root layout'ta |

---

> Bu dosya proje ilerledikçe güncellenecektir. Son güncelleme tarihi başlıkta belirtilmiştir.
