const XLSX = require("xlsx");
const wb = XLSX.readFile("../data/VIGO WOOD Sevkiyat Planları.xlsx");

const sheetCountryMap = {
  DE17: "DE", DE18: "DE", DE19: "DE", DE20: "DE",
  UK26: "UK", UK27: "UK", UK28: "UK",
  USA21: "USA", USA22: "USA", USA23: "USA", USA24: "USA",
};

// Son sheet'teki veri geçerli (last wins — sıralama doğru)
const templates = new Map();
let totalRows = 0;

for (const [sheetName, cc] of Object.entries(sheetCountryMap)) {
  const ws = wb.Sheets[sheetName];
  if (!ws) continue;
  const rows = XLSX.utils.sheet_to_json(ws);

  for (const row of rows) {
    const sku = (row["KODU"] || "").toString().trim();
    if (!sku) continue;

    const koliAdedi = Number(row["ADET"]) || 0;
    const paletteKoli = Number(row["PALETTE KOLİ"] || row["PALETTE_KOLİ"]) || 0;
    const koliAgirlik = Number(row["KOLİ AĞIRLIK"] || row["KOLI_AGIRLIK"]) || 0;

    if (!koliAdedi || !paletteKoli || !koliAgirlik) continue;

    const key = cc + ":" + sku;
    totalRows++;

    // Palet yükseklik — farklı kolon isimleri dene
    let paletYukseklik = 0;
    for (const colName of Object.keys(row)) {
      if (colName.toLowerCase().includes("palet") && colName.toLowerCase().includes("yükseklik")) {
        paletYukseklik = Number(row[colName]) || 0;
        break;
      }
    }
    if (!paletYukseklik) paletYukseklik = 125;

    templates.set(key, {
      country_code: cc,
      sku,
      urun_adi: (row["ÜRÜN"] || "").toString().trim() || null,
      palet_boyut: (row["PALET"] || (cc === "DE" ? "80x120" : "100x120")).toString().trim(),
      palet_yukseklik: paletYukseklik,
      en: Number(row["EN"]) || 0,
      boy: Number(row["BOY"]) || 0,
      yuk: Number(row["YÜKS"]) || 0,
      koli_adedi: koliAdedi,
      palette_koli: paletteKoli,
      koli_agirlik: koliAgirlik,
    });
  }
}

console.log("Toplam veri satırı:", totalRows);
console.log("Unique şablon (country+sku):", templates.size);

// Ülke bazında dağılım
const byCountry = {};
for (const [, t] of templates) {
  byCountry[t.country_code] = (byCountry[t.country_code] || 0) + 1;
}
console.log("Ülke bazında:", JSON.stringify(byCountry));

// Filtreleme: en/boy/yuk 0 olanları raporla
let zeroCount = 0;
for (const [, t] of templates) {
  if (!t.en || !t.boy || !t.yuk) zeroCount++;
}
console.log("En/boy/yuk sıfır olanlar:", zeroCount);

// İlk 10 örnek
console.log("\n--- İlk 10 şablon ---");
let count = 0;
for (const [, t] of templates) {
  if (count++ >= 10) break;
  console.log(JSON.stringify(t));
}

// Export for seed script
module.exports = { templates };
