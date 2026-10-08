# Revizyon: satış/pazaryeri kaldırma, kalite akışları, yeni analiz, hat bazlı iş talimatı, talepler, DB taşıma hazırlığı

## Özet
Kullanıcı revizyon listelerinin (1., 2., 3. kısım ve sonraki düzeltmeler) uygulaması. Uygulama kodu bu dalda;
tüm veritabanı değişiklikleri `supabase/pending_migrations/` altında ve **canlı DB'ye uygulanmadı** —
yeni Supabase projesindeki `vigowood` schema'sına geçişte uygulanacak (prova: `vigowood_prova`).

## Başlıca değişiklikler
- **Kaldırılanlar:** Satış, Pazaryeri (Trendyol/İkas/Fiyatlama), DİA entegrasyonu; Ops Center Ajanlar/Kullanım.
- **Roller:** admin-eşdeğer roller (Yönetici, E-Ticaret Müdürü, Üretim ve Planlama Sorumlusu); Üretim/Hat rolleri
  Ops Center, İade, Sayım, Kritik Stok ve Personel'e erişemez; Admin → Kullanıcılar → **Yetki Tablosu**.
- **Kalite:** uygunsuz / kontrol / söküm (fire + uygunsuz girilir, kalan sağlam) / fire / YM dönüşüm, kayıt iptali;
  iade girişine kargo/sipariş; yarı mamul stokta uygunsuz/fire kolonları.
- **Analiz:** yeni dönem filtreleri, özet grafik, 7 kart + detay sayfaları, sütun filtreleri, odak modu,
  yan malzeme kullanımı, üretim kapanış gününe yazılır, hat renkleri.
- **Stok:** Ürün Stok sadeleştirme + Depo Transferi butonu, sayımda pencere (sayım sırasında giren üretim eklenir),
  Stok Düzenleme, Kritik Stok filtre/sıralama/renk eşikleri.
- **Admin Plakalar:** ürün → plaka → parça ağacı, otomatik yarı mamul kodu.
- **İş Talimatı (hat bazlı):** 5 hat (Montaj 1/2/3, Döşeme, Paketleme), Hat Ekle, hatlar arası kopyalama,
  yayın/onay/hatırlatma, pasif/aktif (zamanlı, yayın seçenekli), tamamlananlar listede, sayaç kuralları,
  hat içinde ardışık aynı ürün yasağı, toplu temizleme; tablette hat sütunları, Seans işlemi (Aç/Kapat),
  ek seans, montaj seans bekletme.
- **Talepler:** talep açma/düzenleme kuralları, çoklu hatta atama, aşama durumları, bildirim zili.
- **DB taşıma:** `scripts/migrate/*` (schema build, veri kopyalama, auth birleştirme, finalize, testler),
  yapılandırılabilir schema (`NEXT_PUBLIC_SUPABASE_DB_SCHEMA`), bakım modu, ortak auth koruması.

## İnceleyenin bilmesi gerekenler
- Bu dal `main`'e birleştirilmeden önce DB geçişi yapılmalı: kod yeni tabloları/RPC'leri bekliyor.
  Canlı (eski) DB ile çalıştırılırsa yeni ekranlar hata verir.
- Geçiş sırası: bakım modu → `scripts/migrate` (README) → Vercel env (`NEXT_PUBLIC_SUPABASE_URL`, anahtarlar,
  `NEXT_PUBLIC_SUPABASE_DB_SCHEMA=vigowood`) → merge/deploy → bakım modunu kaldır.
- Prova testleri: `test-talimat.mjs` 147/147, `test-kalite.mjs` geçti; `npm run build` temiz.
- `.github/workflows/supabase-migrations.yml` eski projeyi hedefliyor; geçişten sonra güncellenmeli veya kapatılmalı.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
