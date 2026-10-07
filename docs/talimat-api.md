# İş Talimatları + Talepler — API Dokümanı

Paket P4a (DB + RPC + cron + server action çekirdeği). UI paketleri (P4b yönetim, P4c tablet) bu API üzerine kurulur.

Migration'lar (`supabase/pending_migrations/`, sırayla): `130_talimat_temel.sql`, `131_talimat_gorunumler.sql`,
`132_talimat_rpc.sql`, `133_talep_rpc.sql`, `134_talimat_zamanlayici.sql`.
Bağımlılıklar: 002/003 (roller), `depolar`, `montaj_sessions`, `pack_events.durum`, `cut_batches.durum`, `notifications`, `app_settings`, `pg_cron`.

Kod: `src/lib/talimat/{constants,types,helpers,db,queries,actions}.ts`, `src/lib/talep/{types,queries,actions}.ts`.
`helpers.ts`, `constants.ts`, `types.ts` istemciden import edilebilir; `queries.ts`/`db.ts` `server-only`; `actions.ts` `"use server"`.

## 1. Kavramlar

- **Plan** (`talimat_planlar`): haftalık, `hafta_baslangic` = Pazartesi (UNIQUE). Durum: `taslak` (işçilere görünmez, gelecek hafta hazırlığı) → `yayinda` → `pasif` (Cumartesi 17:30'da otomatik).
- **Satır** (`talimat_satirlar`): personel (users.role `Üretim`/`Hat`), `sira` (1=en öncelikli, personel içinde 1..n sıkışık), `istasyon` (kesim/montaj/paketleme, opsiyonel), `sku`, kesimde `plaka_id`, `istenen_miktar`, `not_text`, `talep_id`, `durum` (`aktif|pasif|tamamlandi`), `pasif_*`, bayraklar `degisti` ve `onay_bekliyor`.
  - Plaka verilip sku verilmezse, plakanın tek SKU'su varsa sku otomatik doldurulur.
  - İstasyon boşsa türetilir: plaka varsa `kesim`, yoksa `montaj` (`etkin_istasyon`).
  - **Ardışık SKU kuralı KALDIRILDI (SQL 155)**: aynı personelde art arda aynı ürün serbest. `talimat_ardisik_dogrula()` no-op, `trg_talimat_ardisik` düşürüldü; `ARDISIK_SKU` artık üretilmez. Aynı personel plana iki kez eklenemez (istemci personel seçicisi eklenmişleri dışlar).
- **Yayın** (`talimat_yayinlar` + `talimat_yayin_hedefler`): "Değişiklikleri yayınla" kaydı; snapshot (değişen satırlar), hedef personeller (+ onların satır id'leri), seçenekler.
- **Onay** (`talimat_onaylar`): personelin "Görüldü, anlaşıldı" kaydı (`yayin_id`, `personel_id`, `onay_zamani`).
- **Güncellik** (`talimat_guncellik`): "Liste güncel" işaretleri (bitiş tarihi dahil).
- **Pasif** : satır düzeyi `talimat_satirlar.durum='pasif'` (+neden, başlangıç, `pasif_until`), personel/liste düzeyi `talimat_pasifler` (aralıklı). Pasif satırlar işçiye gösterilmez; bugün için geçerli pasiflik `etkin_pasif`.
- **Talep** (`talepler`) + `talep_revizyonlar`.

### Değişiklik izleme (iki bayrak)
Plan `yayinda` iken yapılan düzenlemeler **canlıdır** (tablet Realtime ile görür) ama:
- `degisti=true`: yayınlanmamış değişiklik (planlayıcının "Değişen satırlar" filtresi). Silme / başka personele devir / sıra kayması için ek olarak `talimat_planlar.degisen_personeller`'e personel yazılır.
- Yayınlanınca (`talimat_yayinla`) `degisti` temizlenir. **Bildirimli** yayında değişen satırlar `onay_bekliyor=true` olur (tablette kırmızı) ve personel onaylayınca (veya yayın durdurulunca/geri çekilince) kalkar. `kirmizi = degisti OR onay_bekliyor`.
- **Taslak** planda `degisti` işaretlenmez; ilk yayın tüm personele gider ve satırlar kırmızı olmaz.

## 2. Haftalık yaşam döngüsü

1. `planGetirVeyaOlustur(hafta)` → taslak plan; satırlar eklenir. Ya da `planKopyala(oncekiPlanId, hedefHafta)` (tüm satırlar kopyalanır; pasif/tamamlandı → aktif; sıra, miktar, not, talep bağı korunur).
2. `talimatYayinla(...)` → plan `yayinda`. **Gelecek hafta** planında bildirim gönderilmez (bildirim zorla kapalı); Pazartesi 07:55'te zamanlayıcı otomatik "herkese" bildirim gönderir (ilk yayında bildirim zaten gittiyse tekrar etmez).
3. **Cumartesi 17:30** (Europe/Istanbul, ayarlanabilir): plan `pasif`. Açık bildirimler durdurulur/geri çekilir. Tablet: `talimat_tablet_plan(personel)` pasif planı yalnızca personelin **açık montaj/paketleme seansı** sürdükçe (en fazla 14 gün) gösterir; sonra liste boş.
4. Pasif plan düzenlenemez (`PLAN_PASIF`).

## 3. Yayın, bildirim, onay

`talimatYayinla({planId, bildirimGonder, gonderimZamani?, sesli?, hedef?})`
- `bildirimGonder=false` → "bildirimsiz yenile": yayın durumu `bildirimsiz`, onay istenmez.
- `bildirimGonder=true`, `gonderimZamani` boş/geçmiş → hemen gönderilir (durum `gonderildi`); gelecekse `beklemede`, zamanlayıcı gönderir.
- `hedef`: `degisenler` (varsayılan; değişen satırı olan + silme/sıra değişikliği olan personeller) | `herkes`. Taslak planın ilk yayını her zaman `herkes`.
- Değişiklik yoksa `Yayınlanacak değişiklik yok` hatası.
- Dönen: `{yayin_id, personel_sayisi, satir_sayisi, bildirim_gonder, ilk_yayin, durum}`.

Yayın durumları (`talimat_yayinlar.durum`): `bildirimsiz`, `beklemede`, `gonderildi`, `tamamlandi` (herkes onayladı), `durduruldu`, `geri_cekildi`.

Zamanlayıcı (`talimat_zamanlayici()`, pg_cron `talimat-zamanlayici`, her dakika):
1. Plan otomatik pasif (Cumartesi 17:30).
2. Pazartesi 07:55 otomatik bildirim (bu haftanın yayındaki planı, `pazartesi_bildirim_at` ile bir kez).
3. `beklemede` yayınları gönderir.
4. **Hatırlatma**: `gonderildi` + `bildirim_gonder` yayınlarda, onaylamayan her personele son bildirimden `hatirlatma_dakika` sonra yeni bildirim (onay / durdur / geri çek / plan pasif olana dek).
5. **Rapor**: ilk gönderimden `rapor_dakika` sonra, onaylamayan varsa yayını yapana (otomatikse plan sahibine) `talimat_rapor` bildirimi (`payload.onaylamayanlar=[{personel_id, ad}]`). Bir kez.

`bildirimDurdur(yayinId, geriCek=false)`: durdur → hatırlatma kesilir, `durduruldu`; `geriCek=true` → gönderilmiş okunmamış bildirimler de geri çekilir (`geri_cekildi_at`), `onay_bekliyor` kalkar, durum `geri_cekildi`.

`talimatOnayla(yayinId, personelId, hepsi=true)`: onay kaydı; aynı plandaki tüm bekleyen yayınlar onaylanır (`hepsi`), bildirimler okundu işaretlenir (`notification_reads`), `onay_bekliyor` kalkar; herkes onaylayınca yayın `tamamlandi`. Yetki: planlayıcı; ya da personelin kendisi / seçili operatörü (`vw_selected_operator_id`) / aynı istasyon hesabı.

Planlayıcı özetleri: `talimat_yayin_ozet` (`hedef_sayisi`, `onay_sayisi`, `onaylamayan_sayisi`, `onaylamayanlar[]` → "4 personel görmedi"), `getYayinDetay` (personel bazlı `onay_zamani=null` = görmedi).

### Ayarlar (`app_settings.key='talimat_ayarlari'`)
```json
{ "pasif_gun_saat": {"gun": 6, "saat": "17:30"}, "pazartesi_bildirim_saat": "07:55",
  "hatirlatma_dakika": 10, "rapor_dakika": 15 }
```
`gun` ISO (1=Pzt…7=Paz). Eksik anahtarlar `talimat_ayarlari()` ile varsayılanla tamamlanır. Kaydet: `talimatAyarlariKaydet` (admin-eşdeğeri roller).

### Güncellik
`guncelIsaretle(planId, gun)`: bugün dahil `gun` gün güncel (gun=1 → bugün). `talimat_plan_ozet.guncel_bitis/guncel_mi` (en son işaret geçerli). Tablet: yeşil "Liste güncel (guncel_bitis tarihine kadar)" / kırmızı "Liste güncel değil" (`TalimatTabletListe.guncel`).

### Pasif
`talimatPasifYap({kapsam:'satir'|'personel'|'liste', planId, ids, baslangic?, bitis?, neden?})`; `bitis=null` → elle kaldırılana dek. `talimatPasifKaldir`. Pasif satır işçiye gösterilmez (`etkin_pasif`), bağlı talep `pasif` ("İş pasif edildi") olur (tüm bağlı satırlar pasifse). Satır başka personele devredilirse (`satirKaydet` ile `personel_id` değişimi) pasiflik kalkar ve talep durumu yeniden aktif görünür.

## 4. İlerleme (görünüm `talimat_satir_ilerleme`)

Hafta sınırları Europe/Istanbul `[Pzt 00:00, sonraki Pzt 00:00)`.

| İstasyon | `uretilen` |
|---|---|
| montaj | sku için `montaj_sessions` (`is_final_step`, `durum='tamamlandi'`) qty toplamı, haftada, **tüm personel** (ürün düzeyi) |
| paketleme | sku için tamamlanmış `pack_events` qty, personelin katıldığı seanslar (`personel` CSV veya `workers` JSON) ya da `talimat_satir_id` bağlı |
| kesim | `cut_batches.adet`: `talimat_satir_id` bağlı kayıtlar + bağsız olup aynı operatör & aynı plaka (plaka yoksa sku) |

`fark = istenen − uretilen`; `tamamlandi_mi` (uretilen ≥ istenen veya durum=tamamlandi); `etkin_durum` = `pasif | tamamlandi | aktif` (tamamlanan satır yerinde kalır, soluk gösterilir). `paketlemeye_hazir` (yalnız montaj satırları) = haftalık bitiş-adımı montaj qty − haftalık paketleme qty (tüm personel, ≥0) — **yaklaşık değerdir** (önceki haftadan kalan/devreden yok).
Personel katkı kırılımı: `talimat_satir_katki` (satır x personel x adım; `getSatirKatkilari`).
Filtre alanları: `sira`, `bugun_seans_var`/`hafta_seans_var`/`son_seans_at` ("1. öncelik + seansı başlamamış"), `degisti`, `onay_bekliyor`, `etkin_pasif`, `etkin_durum`.
Kısıtlar/yaklaşımlar: aynı plaka aynı personelde iki satırda varsa kesim üretimi her iki satıra da yansır; kesim adedi `cut_batches.adet` biriminde (plaka adedi) kabul edilir.

## 5. Talepler

Tablo `talepler`: `sku`, `hedef_depo_id`, `istenen_miktar?`, `termin_tarihi`, `aciklama?`, `olusturan`, `created_at`, `kapanis` (NULL=açık | `tamamlandi|tamamlanmadi|stokta_mevcut|geri_cekildi`), `kapanis_neden`.

**Durum** (türetilir, `talep_durum.durum`): `kapanis` varsa o; bağlı satır yok → `acik`; tüm bağlı satırlar pasif → `pasif`; `uretilen ≥ istenen` → `hazir`; seans/kesim başladı → `hazirlaniyor`; aksi halde `is_emri_verildi`. Talep düzeyi `uretilen`, talep açıldığından beri (bağlı satır istasyonlarına göre montaj bitiş adımı / paketleme / bağlı kesim içinden **en büyüğü**).
Geçmiş listeleri: `kapali:true` + `durumlar:["tamamlandi","stokta_mevcut"]` (Tamamlanan) / `["tamamlanmadi","geri_cekildi"]` (Tamamlanmayan). Sıralama: en eski önce. Filtreler: durum, sku, olusturan, depo, tarih aralığı, arama (`TalepFiltre`).

**10 dakika kuralı**: açan (ofis rolü) ilk 10 dk içinde düzenleyebilir/geri çekebilir/silebilir, kayıt tutulmaz. Sonrasında düzenleme/geri çekme/kapatma `talep_revizyonlar`'a yazılır ve bağlı satırlar `degisti=true` olur. Bağlı satırlarda not/miktar, talebin eski değerine eşitse otomatik yeni değere çekilir. `bildirimGonder:true` ve çağıran planlayıcıysa bağlı planlar bildirimli yayınlanır (planlayıcı değilse bayraklar kalır, planlayıcı yayınlar — başkasının bekleyen değişikliklerini kendi adına yayınlamamak için). Planlayıcı düzenlemeleri her zaman revizyon kaydı bırakır. Talimata bağlı talebin ürünü değiştirilemez; bağlı talep silinemez (geri çekilir).

**İş talimatına ata** (`talepTalimataAta`): planlayıcı; `sira` boşsa listenin sonu; dolu sıra → `SIRA_DOLU` (arayüz `getSiraDurumu` ile dolu satırı gösterip `kaydir:true` ile tekrar çağırır); `miktar` boşsa talep miktarı; talep açıklaması satır `not_text`'ine kopyalanır. `planId` boşsa bu haftanın yayındaki planı, yoksa bu hafta/sonrası en yakın taslak.
Kapanışın satırlara etkisi: `tamamlandi` → aktif satırlar `tamamlandi`; `tamamlanmadi`/`stokta_mevcut`/`geri_cekildi` → satırlar pasif (neden `Talep: ...`); `talepYenidenAc` bu otomatik pasifleri geri alır.

Stok uyarısı: `talepStokUyarisiGetir(sku, depoId, istenen)` + `helpers.stokUyarisiMetni(...)` ("Stokta 500 var, yine de talep ediyor musunuz?"; hedef depo seçiliyse o depo stoğu esas). Ürün seçici: `urunAra(q)` → `UrunStokSecenek` (toplam + depo bazlı stok), `getDepolar()`.

## 6. Tablet entegrasyonu

### Liste
`tabletListeGetir(personelId)` → `{plan, satirlar (pasifsiz, sıralı), guncel, bekleyen_yayin_idler}`. Kırmızı yazı: `satir.kirmizi`. Onay düğmesi: `bekleyen_yayin_idler` doluysa `talimatOnayla(bekleyen_yayin_idler[0], personelId)` (hepsi onaylanır).
Realtime: `talimat_satirlar`, `talimat_planlar`, `talimat_yayinlar`, `talimat_onaylar`, `talepler`, `notifications` yayınında.

### Seans Başlat / Bitirdi
- `seansOnDoldurmaGetir(satirId)` → ürün, personel, istasyon, `kalan`, `not_text` (boşsa not gösterme).
- `kesimOnDoldurmaGetir(satirId)` → `plaka_id`, `adet` (kalan, yoksa istenen).
- **Seans/kesim kayıtlarını yazan action'lar (P4c/üretim)** şunları yazmalı: `montaj_sessions` / `pack_events` / `cut_batches` tablolarında yeni kolonlar `talimat_satir_id uuid` (talimattan başlatıldıysa) ve `yardimci_sayisi int default 0` (isimsiz yardımcı sayısı). İlerleme ve "seansı başladı mı" hesapları bu bağlara ve operatör/`workers` alanlarına bakar. Talimat seans kısıtı yoktur (madde 29): işçi talimat dışı da seans açabilir.

### Bildirim hedefleme (paylaşımlı istasyon hesapları)
Bildirim satırı: `notifications` (`kind='talimat_degisiklik'`, `target_user = personel user_id (VW…)`, `payload`, `sesli`, `yayin_id`, `geri_cekildi_at`). Personel başına bir bildirim; hatırlatmada önceki okunmamış bildirim `geri_cekildi_at` ile iptal edilip yenisi yazılır.
`payload`: `{yayin_id, plan_id, personel_id, personel_adi, personel_istasyon, satir_sayisi, hatirlatma, otomatik}`.
İstasyon tableti iki kaynaktan dinler: (a) seçili operatör (`user_metadata.vw_selected_operator_id`) ve (b) aynı istasyondaki personeller (`users.station` = hesabın istasyonu; `payload.personel_istasyon` ile de süzülebilir). `tabletBildirimleriGetir(personelIds?, {istasyonKapsami})` bunu uygular. İstemci Realtime'da `notifications` INSERT olaylarını `kind=eq.talimat_degisiklik` ile dinleyip büyük renkli banner + ses (`sesli`) gösterir; `geri_cekildi_at` dolu olanlar gösterilmez (UPDATE olayını da dinleyin). Okundu: `talimatOnayla` otomatik işaretler; ayrıca `bildirimOkundu(notifIds, personelId)`.
**Dikkat**: mevcut `/bildirimler` sayfası ve navbar rozeti `kind='genel'` ile sınırlanmalı; yoksa talimat bildirimleri genel listede görünür (bu paketin dışındaki dosyalar).
Planlayıcı raporu: `kind='talimat_rapor'`, `target_user = yayını yapan`.

## 7. RPC listesi (SECURITY DEFINER; planlayıcı = `is_admin_or_engineer()`)

| RPC | Yetki | Açıklama |
|---|---|---|
| `talimat_plan_getir_veya_olustur(date)` | planlayıcı | hafta planı / taslak oluştur |
| `talimat_kopyala_hafta(uuid, date)` | planlayıcı | haftayı kopyala (hedef boş olmalı) |
| `talimat_satir_kaydet(jsonb)` | planlayıcı | ekle/güncelle; `SIRA_DOLU`, `PLAN_PASIF` |
| `talimat_satir_sil(uuid)` | planlayıcı | sil + sıra sıkıştır |
| `talimat_satir_sirala(uuid, text, uuid[])` | planlayıcı | personel satırlarını yeniden sırala |
| `talimat_yayinla(uuid, bool, timestamptz, bool, text)` | planlayıcı | yayınla (`bildirim, gonderim, sesli, hedef`) |
| `talimat_bildirim_durdur(uuid, bool)` | planlayıcı | durdur / geri çek |
| `talimat_onayla(uuid, text, bool)` | üretim/ofis | personel onayı (action ek kontrol yapar) |
| `talimat_guncel_isaretle(uuid, int)` | planlayıcı | güncellik |
| `talimat_pasif(text, uuid, text[], date, date, text)` / `talimat_pasif_kaldir(text, uuid, text[])` | planlayıcı | pasif |
| `talimat_tablet_plan(text)` | okuma | personelin görmesi gereken plan |
| `talep_olustur(text,text,numeric,date,text)` | ofis | |
| `talep_guncelle(uuid, jsonb, bool)` | açan/planlayıcı | 10 dk kuralı + revizyon |
| `talep_geri_cek(uuid, text)` / `talep_sil(uuid)` / `talep_kapat(uuid,text,text)` / `talep_yeniden_ac(uuid)` | açan/planlayıcı | |
| `talep_stokta_mevcut(uuid, text)` | planlayıcı | |
| `talep_talimata_ata(uuid,text,int,numeric,text,bool,uuid,text)` | planlayıcı | |

Dahili (istemciye kapalı): `talimat_sira_yerlestir`, `talimat_degisen_isaretle`, `talimat_yayinla_ic`, `talimat_bildirim_gonder_ic`, `talimat_onay_bekliyor_temizle`, `talep_satirlari_pasifle_ic`, `talimat_zamanlayici`.
Yardımcılar: `is_office_user()` (ofis rolleri), `talimat_kullanici_id()`, `talimat_bugun()`, `talimat_ayarlari()`.

## 8. Server action listesi

`src/lib/talimat/actions.ts` (hepsi `ActionResult<T>`): `planGetirVeyaOlustur`, `planKopyala`, `satirKaydet`, `satirSil`, `satirSirala`, `talimatYayinla`, `bildirimDurdur`, `talimatOnayla`, `bildirimOkundu`, `guncelIsaretle`, `talimatPasifYap`, `talimatPasifKaldir`, `talimatAyarlariKaydet`; okuma: `talimatSatirlariGetir`, `satirKatkilariGetir`, `siraDurumuGetir`, `yayinDetayGetir`, `urunAra`, `plakalariGetir`, `tabletListeGetir`, `tabletBildirimleriGetir`, `seansOnDoldurmaGetir`, `kesimOnDoldurmaGetir`.
`src/lib/talep/actions.ts`: `talepOlustur`, `talepGuncelle`, `talepGeriCek`, `talepSil`, `talepKapat`, `talepStoktaMevcut`, `talepYenidenAc`, `talepTalimataAta`; okuma: `talepleriGetir`, `talepDetayGetir`, `talepStokUyarisiGetir`.
Server component sorguları: `src/lib/talimat/queries.ts` (`getPlanlar`, `getPlanByHafta`, `getPlanSatirlari`, `getYayinlar`, `getYayinDetay`, `getTalimatPersoneller`, `getDepolar`, …) ve `src/lib/talep/queries.ts`.
Roller: `TALIMAT_PLANNER_ROLES` (= `ADMIN_ROLES`), `TALEP_CREATOR_ROLES` (ofis), `TALIMAT_VIEW_ROLES` — `src/lib/talimat/constants.ts`.
Yenileme: action'lar `TALIMAT_REVALIDATE_PATHS` yollarını revalidate eder (`/ops/board`, `/talepler`, `/uretim`); UI paketleri gerçek yollarını bu sabite ekleyebilir.

## 9. RLS özeti
Okuma: `has_production_access() OR is_office_user()`. Doğrudan yazma: planlayıcı (plan/satır/yayın/hedef/güncellik/pasif tabloları); `talimat_onaylar` ve `talep_revizyonlar` yalnız RPC ile; `talepler`: ofis kullanıcısı kendi adına INSERT, açan veya planlayıcı UPDATE, silme planlayıcı veya açan (ilk 10 dk). Görünümler `security_invoker`.

## 10. Bilinen varsayımlar / dikkat
- DB'ye bu aşamada uygulanmadı; SQL elle test edilmedi. Prova schema'sında 130→134 sırayla çalıştırıp RPC duman testi yapın (özellikle `talimat_satir_kaydet` kaydırma + deferred unique, `talimat_yayinla` ilk/ikinci yayın, `talimat_zamanlayici()` elle çağrı).
- `pack_events.durum='tamamlandi'`, `cut_batches.durum='tamamlandi'`, `montaj_sessions.durum='tamamlandi'` kapanmış kayıt sayılır; açık paketleme `durum='paketlemede'`.
- Supabase `database types` yeni tabloları içermez; kod tipsiz client kullanır (`talimatDb()`). Types yeniden üretilince sıkılaştırılabilir.
- Mevcut admin-eşdeğeri RLS için `is_admin_or_engineer()` kullanılıyor (planlayıcı = admin-eşdeğeri + Endüstri Mühendisi).

## 9. Talepler "Kaldır" akışı + istasyon otomatiği (SQL 150)

- `talepler.kaldirildi_at/kaldiran`; `talep_durum.kaldirildi_at` (görünümün son kolonu). Kapalı talep (`kapanis` dolu) kullanıcı "Kaldır" diyene dek **aktif listede soluk, en altta** kalır; `kaldirildi_at` dolunca yalnız geçmiş sekmelerinde görünür (geçmiş sekmeler kaldırılmış/kaldırılmamış tüm kapalıları gösterir). `talep_yeniden_ac` (trigger) `kaldirildi_at`'ı temizler.
- RPC: `talep_kaldir(uuid)`, `talep_kaldir_toplu(uuid[]) -> int` (açan veya planlayıcı; yalnız kapalı talepler). Action: `talepKaldir`, `talepKaldirToplu`. Sorgu: `TalepFiltre.kaldirilmamis` (aktif liste), `sirala` (varsayılan yeni önce).
- `talimat_satirlar` INSERT trigger'ı: `istasyon` boş ve `plaka_id` yoksa `users.station`'dan türetilir (`talimat_istasyon_esle`: Kesim/Montaj/Paketleme [+ " Hattı"]; diğerleri NULL). İstemci karşılığı: `helpers.istasyonEsle`.
- Derin bağlantılar: `/talepler?talep=<id>[&degisiklik=1]` (doğru sekme, filtre temizleme, kaydırma + 3 sn vurgu; satır `id="talep-<id>"` + `data-talep-id`), `/ops/board/mavi-yaka?hafta=<pazartesi>&satir=<satir_id>` (satır `id="satir-<id>"` + `data-satir-id`).

## 10. Sayaç sıfırlama / Tekrar aktif et (SQL 154)

- `talimat_satirlar.sayac_baslangic` (NULL = hafta başı). `talimat_satir_etkin.sayac_bas_ts` = greatest(hafta başı, sayac_baslangic); `talimat_satir_ilerleme` (uretilen, son_seans_at) ve `talimat_satir_katki` yalnız bu andan sonra kapanan seansları sayar. `paketlemeye_hazir` ve `talep_durum` (talep kümülatif üretilen) değişmedi.
- RPC `talimat_satir_yeniden_aktif(p_satir, p_istenen>0)`: planlayıcı, PLAN_PASIF korumalı; sayac=now(), istenen=p_istenen, tamamlandi->aktif, yayında ise degisti + degisen_personeller. Action: `satirYenidenAktifEt(satirId, istenen)`.

## 11. Görünen sıra (tamamlananlar çıkınca) + Tamamlananlar filtreleri

- Planlayıcı tablosunda tamamlanan (`etkin_durum='tamamlandi'`) satırlar gizlenir ve **Sıra sütunu görünen aktif satırlara göre 1..n** gösterilir (personel başına, tablet gibi). DB `sira` tamamlananları da içerir (değişmedi).
- Sürükle-bırak: tam liste `satirSirala`'ya gönderilir, **tamamlananlar listenin sonuna** alınır; böylece aktif satırlar DB'de de 1..k olur.
- Talep -> "İş talimatına ata" diyaloğunda sıra N = aktif satırlar arasındaki görünen konum; istemci gerçek `sira`'ya çevirip RPC'ye gönderir (N > aktif sayısı = listenin sonu). `SIRA_DOLU`/kaydır mantığı aynen geçerli.
- Tamamlananlar diyaloğu: arama (kod/ad/personel, Türkçe harf duyarsız), Personel, İstasyon (chip) ve Ürün (aranabilir) filtreleri, "N / M kalem", Temizle; tek tablo + sabit başlık, boş gruplar gizlenir.
