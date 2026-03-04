/**
 * Seed script: Pazaryeri Fiyatlama tabloları
 * Excel'den oku → Supabase'e yaz
 *
 * Kullanım: node scripts/seed-pricing.js
 * Gerekli: .env.local'da NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 */

const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');

// .env.local'dan oku
const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Excel dosyası
const xlsxPath = path.join(__dirname, '..', '..', 'data', '2026 FİYATLAMA.xlsx');
const wb = XLSX.readFile(xlsxPath);

// =============================================
// Yardımcı fonksiyonlar
// =============================================

function getSheetData(sheetName) {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

function toNum(val) {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function round4(n) {
  return Math.round(n * 10000) / 10000;
}

// Desi tablosunu sayfadan çıkar — "Desi" ve "Fiyat" bulunan satırdan başla
function extractDesiTable(data) {
  const desi = {};
  let startRow = -1;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row && String(row[1]).toLowerCase().includes('desi') && String(row[2]).toLowerCase().includes('fiyat')) {
      startRow = i + 1;
      break;
    }
  }
  if (startRow === -1) return desi;
  for (let i = startRow; i < data.length; i++) {
    const row = data[i];
    if (!row || row[1] === '' || row[1] === undefined) break;
    const d = toNum(row[1]);
    const p = toNum(row[2]);
    if (d > 0) desi[String(d)] = p;
  }
  return desi;
}

// =============================================
// 1. Marketplaces
// =============================================

const MARKETPLACES = [
  { code: 'TY', name: 'Trendyol', stopaj_orani: 0.01, hedef_fiyat_tipi: 'perakende_min', sira: 1 },
  { code: 'HB', name: 'Hepsiburada', stopaj_orani: 0.01, hedef_fiyat_tipi: 'perakende_min', sira: 2 },
  { code: 'CS', name: 'ÇiçekSepeti', stopaj_orani: 0.01, hedef_fiyat_tipi: 'perakende_min', sira: 3 },
  { code: 'N11', name: 'N11', stopaj_orani: 0.01, hedef_fiyat_tipi: 'perakende_min', sira: 4 },
  { code: 'PZM', name: 'Pazarama', stopaj_orani: 0.01, hedef_fiyat_tipi: 'perakende_min', sira: 5 },
  { code: 'IDE', name: 'İdefix', stopaj_orani: 0.01, hedef_fiyat_tipi: 'perakende_min', sira: 6 },
  { code: 'VW', name: 'VigoWood', stopaj_orani: 0, hedef_fiyat_tipi: 'perakende_min', sira: 7 },
  { code: 'TEMU', name: 'TEMU', stopaj_orani: 0.01, hedef_fiyat_tipi: 'perakende_min', sira: 8 },
  { code: 'AMZ', name: 'Amazon', stopaj_orani: 0.01, hedef_fiyat_tipi: 'perakende_min', sira: 9 },
  { code: 'TDV', name: 'TDV', stopaj_orani: 0.01, hedef_fiyat_tipi: 'toptan_min', sira: 10 },
];

// Sayfa → Marketplace code eşleştirmesi
const SHEET_MAP = {
  'TY0126': 'TY',
  'HB0126': 'HB',
  'ÇS0126': 'CS',
  'N110126': 'N11',
  'PZM0126': 'PZM',
  'İDE0126': 'IDE',
  'VW0126': 'VW',
  'TEMU0126': 'TEMU',
  'AMZ0126': 'AMZ',
  'TDV0625': 'TDV',
};

// =============================================
// 2. Shipping Providers — Desi tabloları
// =============================================

const SHIPPING_PROVIDER_MAP = {
  'TY0126': { name: 'DHL Kargo (TY)', code: 'KARGO-TY' },
  'HB0126': { name: 'Hepsijet Kargo (HB)', code: 'KARGO-HB' },
  'ÇS0126': { name: 'Sürat Kargo (ÇS)', code: 'KARGO-CS' },
  'N110126': { name: 'Sürat Kargo (N11)', code: 'KARGO-N11' },
  'PZM0126': { name: 'Sürat Kargo (PZM)', code: 'KARGO-PZM' },
  'İDE0126': { name: 'Sürat Kargo (İDE)', code: 'KARGO-IDE' },
  'VW0126': { name: 'HJ İkas Kargo (VW)', code: 'KARGO-VW' },
  'TEMU0126': { name: 'Sürat Kargo (TEMU)', code: 'KARGO-TEMU' },
  'AMZ0126': { name: 'UPS Kargo (AMZ)', code: 'KARGO-AMZ' },
  'TDV0625': { name: 'Hepsijet Kargo (TDV)', code: 'KARGO-TDV' },
};

// =============================================
// 3. Sayfa kolon yapıları
// =============================================

// Standart: [0]=No [1]=Kod [2]=Satış [3]=HedefMin [4]=HedefStd [5]=Ham [6]=Komisyon [7]=KomBedel
//           [8]=en [9]="x" [10]=boy [11]="x" [12]=yükseklik [13]=Kargo [14]=Vergi [15]=Stopaj [16]=Reklam [17]=ReklamBedel
// VW0126:   [0-13] aynı, [14]=Vergi, [15]=Reklam (stopaj yok)
// AMZ0126:  [0-13] aynı, [14]=Amazon Lojistik, [15]=Vergi, [16]=Stopaj, [17]=Reklam
// VW TUFAN gibi sayfalar seed edilmeyecek

function getColumnConfig(sheetName) {
  if (sheetName === 'VW0126') {
    return { satis: 2, komisyon: 6, kargo: 13, reklam: 15, en: 8, boy: 10, yukseklik: 12, amzLojistik: null };
  }
  if (sheetName === 'AMZ0126') {
    return { satis: 2, komisyon: 6, kargo: 13, reklam: 17, en: 8, boy: 10, yukseklik: 12, amzLojistik: 14 };
  }
  // Standart
  return { satis: 2, komisyon: 6, kargo: 13, reklam: 16, en: 8, boy: 10, yukseklik: 12, amzLojistik: null };
}

// =============================================
// Ana seed fonksiyonu
// =============================================

async function seed() {
  console.log('🔄 Fiyatlama seed başlıyor...\n');

  // Mevcut products SKU'larını al
  const { data: products, error: prodErr } = await supabase
    .from('products')
    .select('sku');
  if (prodErr) {
    console.error('Products sorgu hatası:', prodErr);
    process.exit(1);
  }
  const validSkus = new Set(products.map(p => p.sku));
  console.log(`✅ ${validSkus.size} mevcut SKU bulundu\n`);

  // =============================================
  // A) Marketplaces
  // =============================================
  console.log('📌 Marketplaces ekleniyor...');
  const { data: mpData, error: mpErr } = await supabase
    .from('marketplaces')
    .upsert(MARKETPLACES.map(m => ({
      code: m.code,
      name: m.name,
      stopaj_orani: m.stopaj_orani,
      hedef_fiyat_tipi: m.hedef_fiyat_tipi,
      sira: m.sira,
      aktif: true,
      vergi_dahil: true,
    })), { onConflict: 'code' })
    .select();
  if (mpErr) {
    console.error('Marketplace insert hatası:', mpErr);
    process.exit(1);
  }
  console.log(`  ✅ ${mpData.length} pazaryeri eklendi`);

  // marketplace code → id haritası
  const mpMap = {};
  mpData.forEach(m => { mpMap[m.code] = m.id; });

  // =============================================
  // B) Shipping Providers
  // =============================================
  console.log('\n📌 Shipping Providers ekleniyor...');
  const shippingProviders = [];

  for (const [sheetName, providerInfo] of Object.entries(SHIPPING_PROVIDER_MAP)) {
    const data = getSheetData(sheetName);
    const desiTable = extractDesiTable(data);
    if (Object.keys(desiTable).length === 0) {
      console.log(`  ⚠️ ${sheetName}: Desi tablosu bulunamadı`);
    }
    shippingProviders.push({
      name: providerInfo.name,
      code: providerInfo.code,
      desi_fiyatlari: desiTable,
      aktif: true,
    });
  }

  const { data: spData, error: spErr } = await supabase
    .from('shipping_providers')
    .upsert(shippingProviders, { onConflict: 'code' })
    .select();
  if (spErr) {
    console.error('Shipping provider insert hatası:', spErr);
    process.exit(1);
  }
  console.log(`  ✅ ${spData.length} kargo firması eklendi`);

  // shipping code → id haritası
  const spMap = {};
  spData.forEach(s => { spMap[s.code] = s.id; });

  // =============================================
  // C) Marketplace-Shipping Eşleştirmesi
  // =============================================
  console.log('\n📌 Marketplace-Shipping eşleştirmeleri...');
  const msRecords = [];
  for (const [sheetName, mpCode] of Object.entries(SHEET_MAP)) {
    const provInfo = SHIPPING_PROVIDER_MAP[sheetName];
    if (provInfo && mpMap[mpCode] && spMap[provInfo.code]) {
      msRecords.push({
        marketplace_id: mpMap[mpCode],
        shipping_provider_id: spMap[provInfo.code],
        varsayilan: true,
      });
    }
  }

  const { error: msErr } = await supabase
    .from('marketplace_shipping')
    .upsert(msRecords, { onConflict: 'marketplace_id,shipping_provider_id' });
  if (msErr) {
    console.error('Marketplace-Shipping insert hatası:', msErr);
  } else {
    console.log(`  ✅ ${msRecords.length} eşleştirme eklendi`);
  }

  // =============================================
  // D) Product Target Prices — "2025 KASIM" sayfası
  // =============================================
  console.log('\n📌 Hedef fiyatlar ekleniyor (2025 KASIM)...');
  const kasimData = getSheetData('2025 KASIM');
  const targetPrices = [];

  for (let i = 2; i < kasimData.length; i++) {
    const row = kasimData[i];
    if (!row || !row[1] || row[1] === '') continue;
    const sku = String(row[1]).trim();
    if (!validSkus.has(sku)) {
      console.log(`  ⚠️ Hedef fiyat: SKU "${sku}" products tablosunda yok, atlanıyor`);
      continue;
    }
    targetPrices.push({
      sku,
      perakende_min: round2(toNum(row[2])),
      perakende_standart: round2(toNum(row[4])),
      toptan_min: round2(toNum(row[6])),
      toptan_standart: round2(toNum(row[8])),
      perakende_min_kdv: round2(toNum(row[3])),
      perakende_standart_kdv: round2(toNum(row[5])),
      toptan_min_kdv: round2(toNum(row[7])),
      toptan_standart_kdv: round2(toNum(row[9])),
      aktif: true,
    });
  }

  const { error: tpErr } = await supabase
    .from('product_target_prices')
    .upsert(targetPrices, { onConflict: 'sku' });
  if (tpErr) {
    console.error('Target prices insert hatası:', tpErr);
  } else {
    console.log(`  ✅ ${targetPrices.length} hedef fiyat eklendi`);
  }

  // =============================================
  // E) Product Box Dimensions + F) Marketplace Listings
  // =============================================
  console.log('\n📌 Kutu boyutları ve listing verileri çıkarılıyor...');

  const boxDimMap = {}; // sku → {en, boy, yukseklik, desi}
  const allListings = [];
  let skippedNoSku = 0;

  for (const [sheetName, mpCode] of Object.entries(SHEET_MAP)) {
    const data = getSheetData(sheetName);
    const cols = getColumnConfig(sheetName);
    const marketplaceId = mpMap[mpCode];
    const provInfo = SHIPPING_PROVIDER_MAP[sheetName];
    const shippingProviderId = provInfo ? spMap[provInfo.code] : null;
    const desiTable = shippingProviderId ? (spData.find(s => s.id === shippingProviderId)?.desi_fiyatlari || {}) : {};

    let listingCount = 0;

    for (let i = 2; i < data.length; i++) {
      const row = data[i];
      if (!row) continue;

      // Satır numarası yoksa veya listing kodu yoksa atla
      const no = row[0];
      if (no === '' || no === undefined || typeof no !== 'number') continue;

      const listingKodu = String(row[1]).trim();
      if (!listingKodu) continue;

      const satisFiyati = toNum(row[cols.satis]);
      // 0 fiyatlı ürünleri de ekle (pasif olabilir)

      const komisyonOrani = round4(toNum(row[cols.komisyon]));
      const kargoMaliyeti = round2(toNum(row[cols.kargo]));
      const reklamOrani = round4(toNum(row[cols.reklam]));

      // Kutu boyutları
      const en = toNum(row[cols.en]);
      const boy = toNum(row[cols.boy]);
      const yukseklik = toNum(row[cols.yukseklik]);

      // SKU eşleştirme
      let sku = listingKodu;
      if (!validSkus.has(sku)) {
        // Yaygın eşleştirmeler dene
        // Boşluk trimle
        const trimmed = sku.replace(/\s+/g, '');
        if (validSkus.has(trimmed)) {
          sku = trimmed;
        }
      }

      // Hala eşleşmiyorsa listing_kodu=sku olarak kaydet
      if (!validSkus.has(sku)) {
        skippedNoSku++;
        continue; // products tablosunda yoksa FK hata verir, atlıyoruz
      }

      // Kutu boyutları kaydet (ilk bulunan kazanır)
      if (en > 0 && boy > 0 && yukseklik > 0 && !boxDimMap[sku]) {
        const desi = Math.ceil((en * boy * yukseklik) / 3000);
        boxDimMap[sku] = { en, boy, yukseklik, desi };
      }

      // Ham fiyat hesapla
      const vergi = satisFiyati - satisFiyati / 1.1;
      const hamFiyat = round2(satisFiyati * (1 - komisyonOrani - (vergi / satisFiyati || 0) - reklamOrani) - kargoMaliyeti);

      // Özel maliyetler
      const ozelMaliyetler = {};
      if (cols.amzLojistik !== null) {
        const amzLojistik = toNum(row[cols.amzLojistik]);
        if (amzLojistik > 0) {
          ozelMaliyetler.amazon_lojistik = amzLojistik;
        }
      }

      // Hedef fiyat — marketplace'in hedef_fiyat_tipi'ne göre
      const mpInfo = MARKETPLACES.find(m => m.code === mpCode);
      const tp = targetPrices.find(t => t.sku === sku);
      let hedefFiyat = 0;
      if (tp && mpInfo) {
        hedefFiyat = tp[mpInfo.hedef_fiyat_tipi] || 0;
      }

      // Kâr marjı = (ham_fiyat - hedef_fiyat) / satış_fiyatı
      const karMarji = satisFiyati > 0 ? round4((hamFiyat - hedefFiyat) / satisFiyati) : 0;

      allListings.push({
        marketplace_id: marketplaceId,
        sku,
        listing_kodu: listingKodu,
        satis_fiyati: round2(satisFiyati),
        komisyon_orani: komisyonOrani,
        reklam_orani: reklamOrani,
        shipping_provider_id: shippingProviderId,
        kargo_maliyeti: kargoMaliyeti,
        ham_fiyat: round2(Math.max(hamFiyat, 0)),
        hedef_fiyat_kullanilan: round2(hedefFiyat),
        kar_marji: karMarji,
        ozel_maliyetler: Object.keys(ozelMaliyetler).length > 0 ? ozelMaliyetler : {},
        aktif: satisFiyati > 0,
      });
      listingCount++;
    }

    console.log(`  📊 ${sheetName} (${mpCode}): ${listingCount} listing`);
  }

  // E) Box Dimensions insert
  console.log(`\n📌 Kutu boyutları ekleniyor (${Object.keys(boxDimMap).length} ürün)...`);
  const boxRecords = Object.entries(boxDimMap).map(([sku, dims]) => ({
    sku,
    en_cm: dims.en,
    boy_cm: dims.boy,
    yukseklik_cm: dims.yukseklik,
    desi: dims.desi,
  }));

  if (boxRecords.length > 0) {
    const { error: boxErr } = await supabase
      .from('product_box_dimensions')
      .upsert(boxRecords, { onConflict: 'sku' });
    if (boxErr) {
      console.error('Box dimensions insert hatası:', boxErr);
    } else {
      console.log(`  ✅ ${boxRecords.length} kutu boyutu eklendi`);
    }
  }

  // F) Listings insert — batch halinde
  console.log(`\n📌 Marketplace listings ekleniyor (${allListings.length} toplam)...`);
  if (skippedNoSku > 0) {
    console.log(`  ⚠️ ${skippedNoSku} listing atlandı (SKU products tablosunda yok)`);
  }

  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < allListings.length; i += BATCH) {
    const batch = allListings.slice(i, i + BATCH);
    const { error: lErr } = await supabase
      .from('marketplace_listings')
      .upsert(batch, { onConflict: 'marketplace_id,listing_kodu' });
    if (lErr) {
      console.error(`  ❌ Batch ${i}-${i + batch.length} hatası:`, lErr.message);
    } else {
      inserted += batch.length;
    }
  }
  console.log(`  ✅ ${inserted} listing eklendi`);

  // =============================================
  // Özet
  // =============================================
  console.log('\n' + '='.repeat(50));
  console.log('🎉 Seed tamamlandı!');
  console.log(`  Pazaryerleri: ${mpData.length}`);
  console.log(`  Kargo firmaları: ${spData.length}`);
  console.log(`  Hedef fiyatlar: ${targetPrices.length}`);
  console.log(`  Kutu boyutları: ${boxRecords.length}`);
  console.log(`  Listings: ${inserted}`);
  console.log('='.repeat(50));
}

seed().catch(err => {
  console.error('Seed hatası:', err);
  process.exit(1);
});
