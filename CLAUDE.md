# VigoWood Platform

Ahşap mobilya firmasının (VigoWood) entegre iş yönetim platformu. Üretim (MES), stok, satış, sevkiyat, analiz ve personel yönetimini tek çatıda toplar. Mevcut AppSheet + Google Sheets sisteminin yerini alacak.

---

## DOSYA GÜNCELLEMELERİ

- Her katman veya büyük bir iş tamamlandığında bu dosyadaki ilgili katmanı ✅ işaretle
- MEMORY.md'ye yapılan işi, alınan kararları ve öğrenilenleri not et
- Claude-Mem varsa önemli mimari kararları `save_memory` ile kaydet

---

## VERİ DOSYALARI

Mevcut sistemdeki tüm veriler `/data/` klasöründe:

```
/data/
├── VIGO_WOOD_APP_DATA__1_.xlsx    # 21 sheet: Products, Users, Plakalar, AssemblySteps,
│                                    StepBOM, CutBatches, CutLines, Clean, PackEvents,
│                                    AllParts, PlakaParts, KesimMakinesi, HazırElemanAkıs,
│                                    iadeGiris, Attendance, Notifications, HomeMenu,
│                                    StokMenu, AnalizMenu, SatisMenu, UretimMenu
├── StockMovements_-_StockMovements.csv   # Mamül stok hareketleri (20.752 satır)
└── YarıMamulStok3_-_YarıMamulStok.csv   # Yarı mamül stok (234.141 satır)
```

Veritabanı yapısını, kolon isimlerini, ilişkileri ve veri tiplerini bu dosyalardan çıkar. Migration ve form tasarımında gerçek veriyi referans al.

---

## TECH STACK

| Teknoloji | Görev |
|-----------|-------|
| Next.js 16 (App Router) | Frontend |
| Supabase Pro ($25/ay) | PostgreSQL, Auth, Realtime, RLS, Storage |
| Vercel Pro ($20/ay) | Hosting, CDN |
| Tailwind CSS + shadcn/ui | Styling + UI |
| Tremor | Dashboard kartları, KPI |
| Recharts | Grafikler |
| TanStack Table | Veri tabloları |
| Lucide React | İkonlar |
| Hetzner VPS | Python worker, cron, n8n (mevcut) |

---

## PROJE YAPISI

```
vigowood-app/
├── CLAUDE.md
├── MEMORY.md
├── data/                        # Kaynak Excel + CSV
├── src/
│   ├── app/
│   │   ├── (auth)/login/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx       # Responsive shell
│   │   │   ├── page.tsx         # Ana dashboard
│   │   │   ├── uretim/          # Kesim, Temizlik, Montaj, Paketleme, Kutu-Koli
│   │   │   ├── stok/            # Ürün, Yarı mamül, Hazır eleman, İade
│   │   │   ├── satis/
│   │   │   ├── sevkiyat/
│   │   │   ├── analiz/
│   │   │   ├── personel/
│   │   │   ├── admin/           # Ürün, Plaka, Parça, BOM, Kullanıcı yönetimi
│   │   │   └── bildirimler/
│   │   └── api/
│   ├── components/
│   │   ├── ui/                  # shadcn/ui
│   │   ├── layout/              # Sidebar, Navbar, MobileNav
│   │   └── shared/
│   ├── lib/
│   │   ├── supabase/            # client.ts, server.ts, admin.ts, types.ts
│   │   ├── utils.ts
│   │   ├── constants.ts
│   │   └── validations.ts
│   ├── hooks/
│   └── types/
├── supabase/migrations/
└── public/
```

---

## KULLANICILAR

10 rol, 56 kullanıcı. Detaylar Users sheet'inde.

| Rol | Kişi | Cihaz |
|-----|------|-------|
| Yönetici | 4 | Web |
| Endüstri Mühendisi | 1 | Web |
| E-Ticaret Müdürü | 1 | Web + Tel |
| Dış Ticaret Müdürü | 1 | Web + Tel |
| Üretim (Operatör) | 38 | Tablet |
| Hat (Sorumlu) | 7 | Tablet |
| Muhasebe | 1 | Web |
| Sevkiyat Sorumlusu | 1 | Web + Tablet |
| Pazaryeri Sorumlusu | 1 | Web |
| Mimar | 1 | Web |

**Shared hesaplar:** İstasyon tabletlerinde ortak email ile giriş yapılıyor (`kesim@`, `temizlik@`, `montaj@`, `montaj2@`, `paketleme@`, `kutu@vigowood.com`). Giriş sonrası form içinde kişisel operatör seçimi (VW022 gibi UserID). Auth tasarımında bunu hesaba al.

---

## ÜRETİM AKIŞI

```
MDF Plaka → KESİM (lazer) → TEMİZLİK → MONTAJ (1-16 adım) → PAKETLEME → SEVKİYAT
               │                │            │                    │
               ▼                ▼            ▼                    ▼
          YarıMamulStok    YarıMamulStok  YarıMamulStok     StockMovements
            IN                 güncelle       OUT                 IN
```

### Stok Katmanları
1. **Yarı Mamül** — Kesilen parçalar (269 çeşit)
2. **Hazır Eleman** — Satın alınan: menteşe, vida, mıknatıs (68 çeşit)
3. **Kutu/Karton** — Ambalaj (42 çeşit)
4. **Mamül** — Bitmiş ürün (974 SKU, 101 aktif)

### BOM Yapısı — Önemli
Montaj adımlarında bir adımın çıktısı başka adımın girdisi olabiliyor (427 kayıt). `step_bom.part_id` bazen `ASM-XXXX` formatında — bu önceki adıma referans. DAG (Directed Acyclic Graph) yapısı, basit liste değil. BOM editörü ve montaj modülü tasarlarken buna dikkat.

---

## RENK PALETİ

### Natural Color (Ana Tema)
```
Primary:    #cdbd9d  (Ahşap tonu — header, ana butonlar, sidebar)
Light:      #f0ede1  (Açık krem — sayfa arka planı)
Side:       #a99c7d  (Orta ton — border, ikincil elemanlar)
Deep:       #5e5747  (Koyu — hover, aktif state)
Dark:       #474237  (En koyu — metin, başlıklar)
```

### Functional Color
```
Success:    #70c1aa  (Yeşil — tamamlandı, onay)
Warning:    #f28a19  (Turuncu — devam ediyor, dikkat)
Error:      #ee7683  (Pembe-kırmızı — hata, kritik stok)
Info:       #3368b1  (Mavi — bilgi, link)
```

### Recycle Color (Üretim durumları için)
```
#e3ecd2  (Açık yeşil)  →  #b1d286  (Orta)  →  #8d9d70  (Koyu)  →  #3caa35  (Canlı)
```

### Ekstra
```
DeepNavy:    #0c1c2d    HotWalnuts:  #6f4c37    IceBlue:  #adb5be    Black: #000000
```

---

## KODLAMA REHBERİ

- TypeScript strict mode
- snake_case: DB kolonları — camelCase: frontend — PascalCase: komponentler
- Tarih: GG.AA.YYYY (gösterim), ISO 8601 (DB)
- Para: $ ve ₺
- Türkçe arayüz (label, placeholder, hata mesajları, butonlar)
- Mobile-first: 38 operatör tablet kullanıyor
- Responsive: Mobile (<640px), Tablet (640-1024px), Desktop (>1024px)
- RLS policy her tabloda
- Realtime subscription üretim ve stok tablolarında
- Server-side pagination büyük tablolarda
- Zod ile form validation

### RLS Policy Kuralları — KRİTİK
RLS policy yazarken **asla** aynı tabloyu veya users tablosunu doğrudan sorgulamayın. PostgreSQL infinite recursion hatası verir.

**YANLIŞ — YAPMA:**
```sql
CREATE POLICY "admin manage" ON public.users
  USING (EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND role = 'Yönetici'));
```

**DOĞRU — HER ZAMAN BU PATTERNİ KULLAN:**
```sql
-- SECURITY DEFINER fonksiyon kullan (RLS bypass eder)
CREATE POLICY "admin manage" ON public.users
  USING (is_admin());
```

Mevcut SECURITY DEFINER fonksiyonlar (`009_fix_rls_recursion.sql`):
- `is_admin()` → Yönetici rolü kontrolü
- `is_admin_or_engineer()` → Yönetici veya Endüstri Mühendisi
- `has_production_access()` → Yönetici, Endüstri Mühendisi, Üretim, Hat

Yeni tablo eklerken RLS policy'de **mutlaka bu fonksiyonları kullan**, inline subquery YAZMA.

### Supabase SSR Middleware Kuralları — KRİTİK
Next.js 16 + Supabase SSR'da `setAll` callback'i her istekte cookie set eder. Next.js 16 cookie değişikliğini algılayıp re-render tetikler → sonsuz döngü.

**Çözüm**: `middleware.ts`'de cookie karşılaştırma mevcut (`existingCookies` Map). Bu kodu değiştirme/kaldırma.

### Migration Kuralları — KRİTİK
- Migration'ları **kullanıcıya SQL yapıştırmasını İSTEME** — `npx supabase db push` ile uygula
- Supabase CLI zaten login'li ve linked (proje ref: `qqoojonxpaufcyyzvfpo`)
- Trigger fonksiyon adı: `handle_updated_at()` — `set_updated_at()` YAZMA
- Migration listesi kontrol: `npx supabase migration list`
- Dosya formatı: `supabase/migrations/NNN_isim.sql` (sıralı numara)

---

## ARAÇLAR

### Supabase CLI
Migration uygulama ve veritabanı yönetimi. Zaten login'li, doğrudan kullan.

```bash
npx supabase db push          # Bekleyen migration'ları uygula
npx supabase migration list   # Local vs remote durum
npx supabase migration new xyz  # Yeni migration dosyası oluştur
```

### Context7 MCP
Güncel kütüphane dokümantasyonu çeker. API'den emin olmadığında kullan.

```bash
claude mcp add context7 -- npx -y @upstash/context7-mcp
```

Sık kullanılacaklar:
```
use library /vercel/next.js
use library /supabase/supabase-js
use library /shadcn-ui/ui
use library /tanstack/table
use library /recharts/recharts
use library /colinhacks/zod
```

### Claude-Mem
Oturumlar arası hafıza. Önceki oturumlardan context yükler.

```
/plugin marketplace add thedotmack/claude-mem
/plugin install claude-mem
```

---

## GELİŞTİRME KATMANLARI

### KATMAN 0: Proje İskeleti ✅
- [x] Next.js 16 + Tailwind v4 + shadcn/ui kurulumu
- [x] Supabase bağlantısı (client + server + admin + middleware)
- [x] Dosya/klasör yapısı
- [x] .env.example → .env.local kopyala, key'leri gir
- [x] .gitignore'da .env.local olduğundan emin ol
- [x] Git init, ilk commit
- [ ] Vercel deploy

### KATMAN 1: Auth Sistemi ✅
- [x] Supabase Auth + Login sayfası
- [x] Auth middleware (korumalı route'lar)
- [x] users tablosu + 56 kullanıcı migration
- [x] Shared hesap desteği (kesim@, paketleme@ vs.)
- [x] Rol bazlı yönlendirme + Logout

### KATMAN 2: Ana Layout ve Navigasyon ✅
- [x] Sidebar (web), Bottom nav (mobil), Hamburger menü
- [x] Üst navbar (bildirim, profil)
- [x] Rol bazlı menü filtreleme
- [x] Responsive test

### KATMAN 3: DB Migration — Temel Tablolar ✅
- [x] products, users, kesim_makinesi, all_parts
- [x] Veri aktarımı (Excel/CSV → Supabase)
- [x] RLS policy'leri + database types

### KATMAN 4: DB Migration — İlişkili Tablolar ✅
- [x] plakalar, plaka_parts, assembly_steps, step_bom
- [x] BOM'daki ASM referansları (DAG)
- [x] İlişki testleri

### KATMAN 5: DB Migration — İşlem Tabloları ✅
- [x] cut_batches, cut_lines, clean, pack_events
- [x] stock_movements, yari_mamul_stok (234K satır)
- [x] hazir_eleman_akis, iade_giris, attendance, notifications

### KATMAN 6: Admin — Ürün Yönetimi ✅
- [x] Ürün listesi, arama, filtre
- [x] Ürün CRUD
- [x] Toplu aktif/pasif
- [x] Excel Export / Import

### KATMAN 7: Admin — Parça Yönetimi ✅
- [x] Parça listesi (tip bazlı filtre)
- [x] Parça CRUD + kritik stok seviyesi
- [x] Parça oluşturma (create) + silme (delete, referans kontrolü)
- [x] Excel Export / Import

### KATMAN 8: Admin — Plaka Yönetimi ✅
- [x] Plaka listesi + CRUD
- [x] PlakaParts yönetimi
- [x] Makine bazlı kesim süresi
- [x] Plaka oluşturma (create, auto-ID) + silme (delete, referans kontrolü)
- [x] SKU bazlı arama
- [x] Excel Export / Import

### KATMAN 9: Admin — BOM ve Montaj ✅
- [x] Montaj adımları (sıralama, drag-drop)
- [x] StepBOM + ASM referans desteği
- [x] Reçete ağaç görünümü
- [x] Reçete ağacı inline miktar düzenleme
- [x] BOM Excel Export

### KATMAN 10: Üretim — Kesim ✅
- [x] Kesim listesi + yeni kesim formu
- [x] CutLines otomatik oluşturma
- [x] YarıMamulStok'a otomatik IN

### KATMAN 11: Üretim — Temizlik ✅
- [x] Bekleyen işler listesi
- [x] Başlat/bitir + durum renkleri

### KATMAN 12: Üretim — Montaj ✅
- [x] Montaj giriş formu
- [x] Adım bazlı malzeme listesi
- [x] Malzeme yeterliliği kontrolü
- [x] YarıMamulStok'a otomatik OUT

### KATMAN 13: Üretim — Paketleme ✅
- [x] Seans yönetimi
- [x] StockMovements'a otomatik IN

### KATMAN 14: Üretim — Kutu-Koli ✅
- [x] Kutu kesim/üretim + stok takibi

### KATMAN 15: Stok — Mamül ✅
- [x] Stok dashboard + hareketler + trend grafik

### KATMAN 16: Stok — Yarı Mamül ✅
- [x] Parça bazlı stok + eksik uyarısı

### KATMAN 17: Stok — Hazır Eleman + İade ✅
- [x] Kritik stok uyarıları + stok giriş + iade

### KATMAN 18: Sevkiyat ✅
- [x] Sevkiyat listesi + konteyner yönetimi
- [x] 18A: Ülke bazlı ID (DE21/UK29), lojistik kolonlar, sevkiyat_fiyatlar, Admin Fiyatlar, seed
- [x] 18C: Palet şablon sistemi, Admin Şablonlar sayfası
- [x] 18D: Planlama sayfası (/sevkiyat/[id]), Proforma PDF, Paket Listesi PDF
- [x] 18G: Sevkiyat Ayarları — hardcoded sabitler DB'ye taşındı, admin ayarlar sayfası (/sevkiyat/ayarlar)

### KATMAN 19: Satış ✅
- [x] Satış dashboard + Excel upload + stok düşümü
- [x] Raporlar sayfası + PDF rapor (@react-pdf/renderer)
- [x] TR Pazarlama CRUD
- [x] Kampanyalar CRUD

### KATMAN 20: Analiz & Dashboard ✅
- [x] 4 sekmeli dashboard (Genel Özet, Üretim, Satış, Stok)
- [x] Dönem filtresi (Bugün/Hafta/Ay/Tüm Zamanlar) URL params ile
- [x] 16 KPI kartı (4 per tab)
- [x] 6 grafik (ComposedChart, AreaChart, BarChart, stacked BarChart, horizontal BarChart)
- [x] 2 veri tablosu (en çok satan ürünler, kritik stok)
- [x] 14 paralel Supabase sorgusu (server-side)

### KATMAN 21: Personel & Yoklama ✅
- [x] DB Migration: updated_at + has_personel_access() RLS
- [x] Yoklama listesi (TanStack Table, server-side pagination/sorting/filtering)
- [x] KPI kartları (bugün toplam, ort. mesai, aktif dept, geç gelenler)
- [x] Yeni kayıt / düzenleme (Sheet + Combobox çalışan seçimi)
- [x] Departman filtre, tarih aralığı, çalışan arama
- [x] Özet tab: 30 gün trend AreaChart + departman dağılım BarChart

### KATMAN 22: Bildirimler ✅
- [x] notification_reads junction tablosu + migration (025_bildirimler_v2.sql)
- [x] Admin bildirim oluşturma/silme (hedefli veya herkese)
- [x] Kişiye özel okundu takibi (markAsRead, markAllAsRead)
- [x] Navbar badge (realtime unread count)
- [x] Bildirimler sayfası: kart listesi, filtre tabs, arama
- [x] Supabase Realtime (notifications + notification_reads)

### KATMAN 23: Realtime & Polish ✅
- [x] Supabase Realtime + performans + UX iyileştirmeleri

### KATMAN 25: DB Migration — Muhasebe ve Finans Tabloları ✅
- [x] is_admin_or_finance() RLS fonksiyonu
- [x] 6 enum: odeme_turu, odeme_durumu, para_birimi, maliyet_grubu, faaliyet_turu, kalem_turu
- [x] Alt Sistem A: nakit_donemler, nakit_girisler, nakit_cikislar, odemeler, nakit_giris_takip
- [x] Alt Sistem B: faaliyet_donemler, satis_giris, maliyet_giris, karlilik_data
- [x] RLS policy'leri (SELECT/INSERT/UPDATE: is_admin_or_finance, DELETE: is_admin)
- [x] Realtime: odemeler + nakit_donemler
- [x] Seed: HASMOB xlsx + FALİYET xlsx → 9 tablo (3+3+3+293+7+1+20+48+80 satır)
- [x] Supabase types regenerated + custom aliases
- [x] Navigation: Muhasebe grubu (Nakit Akış, Ödemeler, Faaliyet Hesapları, Kârlılık)
- [x] Constants: FINANCE_ROLES, ODEME_TURLERI, ODEME_TURU_COLORS, MALIYET_KATEGORILERI

### KATMAN 26: Muhasebe — Nakit Akış Yönetimi ✅
- [x] Nakit Akış Dashboard (KPI, dönem seçici, genel bakış, gelir yapısı, gider dağılımı, borç yapısı)
- [x] Dönem oluşturma formu (15 günlük D1/D2)
- [x] Nakit giriş/çıkış girişi (13 kanal TL + USD, 27 kategori gider)
- [x] Ödemeler sayfası (TanStack Table, 13 tür, renk badge, takvim görünümü)
- [x] Nakit Giriş Takip (beklenen alacaklar)
- [x] Trend grafikleri (Recharts)

### KATMAN 27: Muhasebe — Faaliyet Hesapları (Gelir Tablosu) ✅
- [x] Faaliyet Hesapları ana sayfası (/muhasebe/faaliyet) — 3 tab (Özet|Satış|Maliyet)
- [x] Dönem seçici (aylık) + yeni dönem oluşturma dialog
- [x] Özet tab: KPI kartları (Gelir, Gider, FAVÖK, Net Kâr) + veri durumu badge'leri
- [x] Satış Girişi tab: Dinamik satır tablosu, pazaryeri DB'den + serbest giriş, auto-calc hesaplanan TL/USD
- [x] Maliyet Girişi tab: 12 Collapsible kategori, VW direkt + HM direkt + ORTAK paylaşımlı, dağıtım audit trail
- [x] P&L hesaplama motoru (computeKarlilik): ~80 satır/dönem, 3 marka (GENEL/VW/HM)
- [x] Kârlılık sayfası (/muhasebe/faaliyet/karlilik) — 4 tab (GENEL|VW|HM|Karşılaştırma)
- [x] Gelir tablosu P&L: kalem_turu stilizasyonu, önceki dönem karşılaştırma (% fark)
- [x] Marka karşılaştırma: VW vs HM yan yana (Gelir, Gider, FAVÖK, Marj, Net Kâr)
- [x] 3 Recharts grafik: PieChart (gelir dağılımı), LineChart (FAVÖK+Net Kâr trend), BarChart (gider dağılımı)
- [x] Dönem tipleri: Aylık, Çeyrek (Q1-Q4), Yarıyıl (H1-H2), Yıllık — SUM aggregation
- [x] Constants: FAALIYET_MARKALAR, FAALIYET_KANALLARI, AY_LABELS, MALIYET_KATEGORI_TURLERI
- [x] Validations: satisGirisBatchSchema, maliyetGirisBatchSchema
- [x] Type aliases: FaaliyetDonem, SatisGiris, MaliyetGiris, KarlilikData

### KATMAN 28A: Pazaryeri Entegrasyonu — Trendyol ✅
- [x] lib/trendyol/ altyapı: client.ts (Basic Auth, rate limiting, mock data fallback), types.ts, helpers.ts, mock-data.ts
- [x] .env.local: TRENDYOL_API_KEY, TRENDYOL_API_SECRET, TRENDYOL_SELLER_ID
- [x] Sidebar: Pazaryeri menü grubu (E-Ticaret Müdürü, Dış Ticaret Müdürü, Yönetici, Pazaryeri Sorumlusu)
- [x] /pazaryeri/genel: KPI kartları (sipariş, ciro, iade, stok), kanal kartları, 7 gün trend (Recharts)
- [x] /pazaryeri/trendyol/siparisler: TanStack Table, tab filtreleri, tarih aralığı, arama, sipariş detay Sheet, kargo gönderme
- [x] /pazaryeri/trendyol/urunler: Ürün listesi, stok/fiyat güncelleme, filtreler (satışta/beklemede/stok yok)
- [x] /pazaryeri/trendyol/sorular: Müşteri soruları, cevap yazma, durum filtreleri
- [x] /pazaryeri/trendyol/finans: Satış/komisyon/iade/net ödeme KPI, aylık özet tablo, işlem geçmişi, bar chart
- [x] Trendyol tab navigasyonu (layout.tsx + TrendyolNav)
- [x] Auth guard: MARKETPLACE_ACCESS_ROLES, tüm sayfalar ve server action'larda kontrol
- [x] Mock data: API credentials invalid olduğunda otomatik mock data fallback (gerçekçi VigoWood ürünleri)

### KATMAN 28B: Pazaryeri Entegrasyonu — İkas (vigowood.com) ✅
- [x] lib/ikas/ altyapı: client.ts (OAuth2 GraphQL, token caching, mock fallback), types.ts, queries.ts, helpers.ts, mock-data.ts
- [x] .env.local: IKAS_CLIENT_ID, IKAS_CLIENT_SECRET, IKAS_STORE_NAME
- [x] Sidebar: vigowood.com navigasyonu (Globe icon, Pazaryeri grubu altında)
- [x] /pazaryeri/vigowood-com/siparisler: TanStack Table, tab filtreleri, tarih aralığı, arama, sipariş detay Sheet
- [x] /pazaryeri/vigowood-com/urunler: Ürün listesi, stok güncelleme, filtreler (aktif/stok yok)
- [x] /pazaryeri/vigowood-com/musteriler: Müşteri listesi, müşteri detay Sheet, VIP/Sadık/Aktif badge
- [x] VigowoodNav tab navigasyonu (layout.tsx + vigowood-nav.tsx)
- [x] /pazaryeri/genel güncelleme: Trendyol + İkas birleşik KPI, kanal kartları, stacked bar trend chart
- [x] Auth guard: MARKETPLACE_ACCESS_ROLES, tüm sayfa ve server action'larda kontrol
- [x] Gerçek İkas API bağlantısı: 15.166 sipariş, 17.525 müşteri, 3 stok lokasyonu
- [x] Build: 72 route, sıfır TypeScript hatası

### KATMAN 28C: İkas Sipariş Sync — DB Altyapısı ✅
- [x] ikas_orders tablosu (ikas_id UNIQUE, order_number, status, total_price, currency, city, country, line_items JSONB, ikas_created_at)
- [x] RLS: SELECT authenticated, INSERT/UPDATE service_role only
- [x] Indexes: ikas_id (unique), order_number, ikas_created_at DESC, status
- [x] Types: IkasOrder alias

### KATMAN 28+: İleri Özellikler
- [ ] Amazon SP-API, Hepsiburada API
- [ ] Trendyol API gerçek credentials bağlantısı (mevcut: 401 auth hatası, mock data aktif)
- [ ] Trendyol Ads verisi (API yok — manuel CSV upload ile)
- [ ] WhatsApp bildirimler
- [ ] PPC dashboard, AI tahmin

### KATMAN 30: Ops Center — Task Management ✅
- [x] **Aşama 1**: DB: tasks, task_comments, task_attachments, task_activity tabloları + 5 enum + RLS + realtime
- [x] Sidebar: Ops Center menü grubu (Genel Bakış, Board, Görevlerim, Onaylar, Raporlar, Ajanlar, Kullanım)
- [x] /ops: KPI kartları (7 adet: görev + approval + ajan + çıktı), geciken görevler, bekleyen onaylar, bugün tamamlanan, son aktiviteler
- [x] /ops/board: 4 kolonlu Kanban board (scheduled/queue/in_progress/done), @dnd-kit DnD, Durum/Kişi görünüm toggle
- [x] Task kartları: başlık, assignee (Bot ikonu agent ise), öncelik+departman badge, is_blocked/is_waiting_approval badge'leri
- [x] Hızlı + detaylı görev oluşturma, Çalışanlar/Ajanlar tab'lı assignee picker
- [x] Task detail sheet: inline edit, yorumlar, dosyalar (Storage), aktivite, alt görevler, Çalışma Günlüğü tab
- [x] /ops/gorevlerim: Inbox, filtre + sıralama, is_blocked/is_waiting_approval badge
- [x] Supabase Storage bucket: task-attachments
- [x] **Aşama 2**: DB: ops_agents, ops_approvals, ops_outputs tabloları + 5 enum + RLS + realtime
- [x] 6 sanal ajan seed: Elif(stok), Kerem(üretim), Zeynep(pazaryeri), Burak(sevkiyat), Derya(muhasebe), Can(genel)
- [x] /ops/onaylar: Approval sistemi — aksiyon türü, risk seviyesi, payload karşılaştırma, onayla/reddet/revizyon
- [x] /ops/raporlar: Çıktılar sayfası — dosya listesi, tür+ajan filtre, indir/aç/sil
- [x] /ops/ajanlar: Ajan profilleri — kart listesi, detay sheet, yetenekler, çalışma planı, durum kontrolleri
- [x] **Aşama 3 (V3)**: DB: task_templates, recurring_tasks, task_runs tabloları + enum swap (6→4 status) + is_blocked/is_waiting_approval boolean'lar
- [x] Enum swap: backlog→scheduled, open→queue, waiting_approval→in_progress+flag, blocked→in_progress+flag
- [x] /ops/board tab sistemi: Görevler | Şablonlar | Tekrar Eden
- [x] Şablon CRUD: template-dialog, templates-tab (kart grid, arama, departman filtre, şablondan görev oluştur)
- [x] Tekrar eden görev CRUD: recurring-dialog, recurring-tab (cron schedule, aktif/pasif toggle, çalışma geçmişi)
- [x] /ops/kullanim: Agent kullanım istatistikleri — 3 KPI, dönem filtresi, agent bazlı tablo
- [x] Kanban board: Durum/Kişi görünüm toggle, Tümü/Çalışanlar/Asistanlar atama filtresi
- [x] 3 görünüm modu: Pano (Kanban) | Liste (tablo, gruplama, sıralama) | Takvim (aylık grid, chip'ler)
- [x] Liste: durum bazlı collapsible gruplar, sıralanabilir kolonlar, filtreler
- [x] Takvim: ay navigasyonu, bugün vurgusu, durum renkli chip'ler, tarihi belirsiz bölümü
- [x] Build: 87 route, sıfır TypeScript hatası

### KATMAN 29: Test & Güvenlik Denetimi ✅
- [x] Güvenlik: 38/38 server action + 9/9 API route auth guard doğrulandı
- [x] Güvenlik: admin.ts'e `import "server-only"` eklendi
- [x] Güvenlik: CSP + Permissions-Policy header'ları eklendi
- [x] Güvenlik: password_plain getCurrentUser()'dan kaldırıldı (UserProfile type güncellendi)
- [x] Güvenlik: 8 API route'a rate limiting eklendi (cron: 2/dk, PDF: 5/dk)
- [x] Güvenlik: .env.example'a CRON_SECRET eklendi
- [x] Performans: 17 chart component'e Recharts lazy loading (next/dynamic + ssr:false + ChartSkeleton)
- [x] Performans: personel inline chart → ayrı PersonelCharts component'e çıkarıldı
- [x] Build: 59 route, sıfır TypeScript hatası
