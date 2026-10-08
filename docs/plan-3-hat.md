# Revizyon 3 — Hat Bazlı İş Talimatı

İş talimatı personel bazlı yerine **hat bazlı** olur. Varsayılan hatlar: MONTAJ 1 HATTI, MONTAJ 2 HATTI,
MONTAJ 3 HATTI, DÖŞEME HATTI, PAKETLEME HATTI (her biri 1 boş satırla). "Hat ekle" ile yeni hat.

## Kararlar
- Tamamlanma: montaj tipi hatlar (Montaj 1/2/3, Döşeme) → ürünün **son montaj aşaması** (is_final_step) adedi;
  Paketleme hattı → paketleme adedi. Stoğa yalnızca paketleme girer; montaj asla stoğa gitmez.
- Sayaç kuralları korunur (talimat verildiği andan; ürün değişince ve "Tekrar aktif et"te sıfırdan).
- Onay: hat başına bir onay ("Gördüm, anlaşıldı"); hatırlatma/raporlar hat bazlı.
- Talimat dışı (ana ekran) seanslarda hat **her seferinde sorulur** (zorunlu seçim).
- Kesim hattı yok; kesim talimatı kaldırılır (gerekirse "Hat ekle").
- Bir personel aynı ürünün aynı aşamasında ikinci açık seans açamaz.
- Talepler: bir talep birden fazla hatta atanabilir; talep ekranında aşama durumları (montaj başladı/tamamlandı,
  döşeme başladı/tamamlandı, paketleme başladı/tamamlandı).
- Mevcut personel bazlı talimat satırları (yalnızca provada) kullanılmaz; yeni sistem hat satırlarını gösterir.

## Paketler (Sonnet ajanları)
| Paket | İçerik | Sıra |
|---|---|---|
| H1 DB çekirdeği | talimat_hatlar + seed, satır/seans hat_id, RPC'ler, ilerleme, yayın/onay hat bazlı, talep çoklu hat ataması + aşama durumları, testler | önce |
| H2 Planlayıcı (Mavi Yaka) | Hat ekle, hat grupları, satır çoklu seçim + başka hatta sürükleyerek kopyalama (otomatik satır açma), filtreler | H1 sonrası |
| H3 Tablet | İş Talimatları hat kategorileri (5 sütun/bölüm), "Seans işlemi" → Aç/Kapat, hat bazlı tamamlananlar ve ek seans; ana ekranda seanslar hat gruplarında; yeni seans penceresinde hat seçimi | H1 sonrası |
| H4 Talepler | Çoklu hatta atama, aşama durumları | H1 sonrası |

Doğrulama: test-talimat yeşil, tsc temiz, build, localhost kontrolü.
