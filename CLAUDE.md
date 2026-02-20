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

---

## ARAÇLAR

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

### KATMAN 7: Admin — Parça Yönetimi ✅
- [x] Parça listesi (tip bazlı filtre)
- [x] Parça CRUD + kritik stok seviyesi

### KATMAN 8: Admin — Plaka Yönetimi ✅
- [x] Plaka listesi + CRUD
- [x] PlakaParts yönetimi
- [x] Makine bazlı kesim süresi

### KATMAN 9: Admin — BOM ve Montaj ✅
- [x] Montaj adımları (sıralama, drag-drop)
- [x] StepBOM + ASM referans desteği
- [x] Reçete ağaç görünümü

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

### KATMAN 17: Stok — Hazır Eleman + İade
- [ ] Kritik stok uyarıları + stok giriş + iade

### KATMAN 18: Sevkiyat
- [ ] Sevkiyat listesi + konteyner yönetimi

### KATMAN 19: Satış
- [ ] Satış listesi + hedefler + kampanyalar

### KATMAN 20: Analiz & Dashboard
- [ ] KPI kartları + grafikler + raporlar

### KATMAN 21: Personel & Yoklama
- [ ] Yoklama giriş/liste + mesai

### KATMAN 22: Bildirimler
- [ ] Uygulama içi bildirim sistemi

### KATMAN 23: Realtime & Polish
- [ ] Supabase Realtime + performans + UX iyileştirmeleri

### KATMAN 24+: İleri Özellikler
- [ ] Amazon SP-API, Trendyol/Hepsiburada API
- [ ] WhatsApp bildirimler
- [ ] PPC dashboard, Finans modülü, AI tahmin
