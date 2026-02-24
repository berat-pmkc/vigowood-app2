/**
 * Mock data for Trendyol API — used when API credentials are invalid
 * Realistic VigoWood product data
 */
import type {
  TrendyolPaginatedResponse,
  TrendyolOrder,
  TrendyolOrderParams,
  TrendyolProduct,
  TrendyolProductParams,
  TrendyolQuestion,
  TrendyolQuestionParams,
  TrendyolSettlement,
  TrendyolSettlementParams,
  TrendyolOrderStatus,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────
const now = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Mock Products ───────────────────────────────────────
const MOCK_PRODUCTS: TrendyolProduct[] = [
  {
    id: "TY-001",
    barcode: "8682530001001",
    title: "Vigo Wood Ahşap Laptop Sehpası - Doğal Akçaağaç",
    productMainId: "VW-LAPTOP-001",
    brandId: 118124,
    brand: "Vigo Wood",
    categoryName: "Laptop Sehpası",
    quantity: 45,
    stockCode: "VW-LP-NAT",
    listPrice: 899.99,
    salePrice: 749.99,
    vatRate: 20,
    approved: true,
    onSale: true,
    createDateTime: now - 90 * DAY,
    lastUpdateDate: now - 2 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-laptop-1.jpg" }],
  },
  {
    id: "TY-002",
    barcode: "8682530001002",
    title: "Vigo Wood Ahşap Kitap Okuma Standı - Ceviz",
    productMainId: "VW-KSTAND-001",
    brand: "Vigo Wood",
    categoryName: "Kitap Okuma Standı",
    quantity: 128,
    stockCode: "VW-KS-WAL",
    listPrice: 549.99,
    salePrice: 449.99,
    vatRate: 20,
    approved: true,
    onSale: true,
    createDateTime: now - 85 * DAY,
    lastUpdateDate: now - 1 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-kstand-1.jpg" }],
  },
  {
    id: "TY-003",
    barcode: "8682530001003",
    title: "Vigo Wood Ahşap Telefon Standı - Meşe",
    productMainId: "VW-TEL-001",
    brand: "Vigo Wood",
    categoryName: "Telefon Standı",
    quantity: 234,
    stockCode: "VW-TS-OAK",
    listPrice: 299.99,
    salePrice: 249.99,
    vatRate: 20,
    approved: true,
    onSale: true,
    createDateTime: now - 120 * DAY,
    lastUpdateDate: now - 3 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-tel-1.jpg" }],
  },
  {
    id: "TY-004",
    barcode: "8682530001004",
    title: "Vigo Wood Premium Kitaplık - 5 Raflı Doğal Ahşap",
    productMainId: "VW-KTP-001",
    brand: "Vigo Wood",
    categoryName: "Kitaplık",
    quantity: 12,
    stockCode: "VW-KTP-5R",
    listPrice: 2499.99,
    salePrice: 1999.99,
    vatRate: 20,
    approved: true,
    onSale: true,
    createDateTime: now - 60 * DAY,
    lastUpdateDate: now - 5 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-ktp-1.jpg" }],
  },
  {
    id: "TY-005",
    barcode: "8682530001005",
    title: "Vigo Wood Ahşap Organizer - Masaüstü Düzenleyici",
    productMainId: "VW-ORG-001",
    brand: "Vigo Wood",
    categoryName: "Organizer",
    quantity: 87,
    stockCode: "VW-ORG-DS",
    listPrice: 449.99,
    salePrice: 379.99,
    vatRate: 20,
    approved: true,
    onSale: true,
    createDateTime: now - 75 * DAY,
    lastUpdateDate: now - 1 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-org-1.jpg" }],
  },
  {
    id: "TY-006",
    barcode: "8682530001006",
    title: "Vigo Wood At Evi - El Yapımı Dekoratif Kuş Evi",
    productMainId: "VW-AE-001",
    brand: "Vigo Wood",
    categoryName: "Dekoratif Obje",
    quantity: 56,
    stockCode: "VW-AE-STD",
    listPrice: 199.99,
    salePrice: 169.99,
    vatRate: 20,
    approved: true,
    onSale: true,
    createDateTime: now - 100 * DAY,
    lastUpdateDate: now - 4 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-ae-1.jpg" }],
  },
  {
    id: "TY-007",
    barcode: "8682530001007",
    title: "Vigo Wood Ahşap Basamak - 2 Basamaklı Çocuk Taburesi",
    productMainId: "VW-BAS-001",
    brand: "Vigo Wood",
    categoryName: "Basamak",
    quantity: 0,
    stockCode: "VW-BAS-2B",
    listPrice: 699.99,
    salePrice: 599.99,
    vatRate: 20,
    approved: true,
    onSale: false,
    createDateTime: now - 45 * DAY,
    lastUpdateDate: now - 7 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-bas-1.jpg" }],
  },
  {
    id: "TY-008",
    barcode: "8682530001008",
    title: "Vigo Wood Duvar Tablosu - Geometrik Ahşap Pano",
    productMainId: "VW-TAB-001",
    brand: "Vigo Wood",
    categoryName: "Duvar Tablosu",
    quantity: 34,
    stockCode: "VW-TAB-GEO",
    listPrice: 349.99,
    salePrice: 299.99,
    vatRate: 20,
    approved: true,
    onSale: true,
    createDateTime: now - 30 * DAY,
    lastUpdateDate: now - 2 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-tab-1.jpg" }],
  },
  {
    id: "TY-009",
    barcode: "8682530001009",
    title: "Vigo Wood Laptop Sehpası - Ayarlanabilir Yükseklik",
    productMainId: "VW-LAPTOP-002",
    brand: "Vigo Wood",
    categoryName: "Laptop Sehpası",
    quantity: 22,
    stockCode: "VW-LP-ADJ",
    listPrice: 1199.99,
    salePrice: 999.99,
    vatRate: 20,
    approved: false,
    onSale: false,
    createDateTime: now - 5 * DAY,
    lastUpdateDate: now - 1 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-lp-2.jpg" }],
  },
  {
    id: "TY-010",
    barcode: "8682530001010",
    title: "Vigo Wood Kabak Lifi Banyo Seti - 3'lü Paket",
    productMainId: "VW-KL-001",
    brand: "Vigo Wood",
    categoryName: "Banyo Aksesuarı",
    quantity: 156,
    stockCode: "VW-KL-3PK",
    listPrice: 179.99,
    salePrice: 149.99,
    vatRate: 20,
    approved: true,
    onSale: true,
    createDateTime: now - 110 * DAY,
    lastUpdateDate: now - 6 * DAY,
    images: [{ url: "https://cdn.dsmcdn.com/mock/vw-kl-1.jpg" }],
  },
];

// ─── Mock Orders ─────────────────────────────────────────
const CUSTOMER_NAMES = [
  ["Ahmet", "Yılmaz"], ["Ayşe", "Demir"], ["Mehmet", "Kaya"], ["Fatma", "Çelik"],
  ["Mustafa", "Şahin"], ["Zeynep", "Öztürk"], ["Ali", "Arslan"], ["Elif", "Koç"],
  ["Hasan", "Kurt"], ["Merve", "Aydın"], ["Emre", "Özdemir"], ["Selin", "Yıldırım"],
  ["Burak", "Doğan"], ["Deniz", "Polat"], ["Can", "Erdoğan"],
];

const CITIES = [
  { name: "İstanbul", code: 34, districts: ["Kadıköy", "Beşiktaş", "Üsküdar", "Ataşehir", "Kartal"] },
  { name: "Ankara", code: 6, districts: ["Çankaya", "Keçiören", "Yenimahalle", "Etimesgut"] },
  { name: "İzmir", code: 35, districts: ["Konak", "Bornova", "Karşıyaka", "Buca"] },
  { name: "Bursa", code: 16, districts: ["Osmangazi", "Nilüfer", "Yıldırım"] },
  { name: "Antalya", code: 7, districts: ["Muratpaşa", "Konyaaltı", "Kepez"] },
];

const ORDER_STATUSES: TrendyolOrderStatus[] = [
  "Created", "Created", "Picking", "Picking", "Shipped", "Shipped", "Shipped",
  "Delivered", "Delivered", "Delivered", "Delivered", "Delivered",
  "Cancelled", "Returned",
];

function generateMockOrders(): TrendyolOrder[] {
  const orders: TrendyolOrder[] = [];
  for (let i = 0; i < 50; i++) {
    const customer = CUSTOMER_NAMES[i % CUSTOMER_NAMES.length];
    const city = CITIES[i % CITIES.length];
    const district = city.districts[i % city.districts.length];
    const status = ORDER_STATUSES[i % ORDER_STATUSES.length];
    const product = MOCK_PRODUCTS[i % MOCK_PRODUCTS.length];
    const orderDate = now - randomBetween(0, 14) * DAY - randomBetween(0, 23) * HOUR;
    const qty = randomBetween(1, 3);

    orders.push({
      id: 100000 + i,
      shipmentPackageId: 200000 + i,
      orderNumber: `${300000000 + i}`,
      customerId: 400000 + i,
      customerFirstName: customer[0],
      customerLastName: customer[1],
      grossAmount: product.salePrice * qty,
      totalDiscount: randomBetween(0, 50),
      totalPrice: product.salePrice * qty,
      shipmentAddress: {
        firstName: customer[0],
        lastName: customer[1],
        address1: `${district} Mah. Örnek Sok. No:${randomBetween(1, 100)}`,
        city: city.name,
        cityCode: city.code,
        district,
        postalCode: `${city.code}${randomBetween(100, 999)}`,
        countryCode: "TR",
        fullAddress: `${district} Mah. Örnek Sok. No:${randomBetween(1, 100)} ${district}/${city.name}`,
      },
      invoiceAddress: {
        firstName: customer[0],
        lastName: customer[1],
        address1: `${district} Mah. Örnek Sok. No:${randomBetween(1, 100)}`,
        city: city.name,
        cityCode: city.code,
        district,
        postalCode: `${city.code}${randomBetween(100, 999)}`,
        countryCode: "TR",
        fullAddress: `${district} Mah. Örnek Sok. No:${randomBetween(1, 100)} ${district}/${city.name}`,
      },
      cargoProviderName: ["Aras Kargo", "Yurtiçi Kargo", "MNG Kargo", "Sürat Kargo"][i % 4],
      cargoTrackingNumber: status === "Shipped" || status === "Delivered" ? 7000000000 + i : undefined,
      lines: [
        {
          id: 500000 + i,
          quantity: qty,
          merchantSku: product.stockCode ?? product.barcode,
          productName: product.title,
          barcode: product.barcode,
          amount: product.salePrice * qty,
          discount: randomBetween(0, 20),
          currencyCode: "TRY",
          vatBaseAmount: product.salePrice * qty * 0.8333,
          vatRate: 20,
          price: product.salePrice,
          orderLineItemStatusName: status,
          commission: randomBetween(8, 18),
          imageUrl: product.images?.[0]?.url,
        },
      ],
      orderDate,
      shipmentPackageStatus: status,
      status,
      deliveryType: "Normal",
      lastModifiedDate: orderDate + randomBetween(0, 5) * HOUR,
      packageHistories: [
        { createdDate: orderDate, status: "Created" },
        ...(["Picking", "Shipped", "Delivered"].includes(status)
          ? [{ createdDate: orderDate + 2 * HOUR, status: "Picking" }]
          : []),
        ...(["Shipped", "Delivered"].includes(status)
          ? [{ createdDate: orderDate + 12 * HOUR, status: "Shipped" }]
          : []),
        ...(status === "Delivered"
          ? [{ createdDate: orderDate + 2 * DAY, status: "Delivered" }]
          : []),
      ],
    });
  }
  return orders.sort((a, b) => b.orderDate - a.orderDate);
}

const mockOrders = generateMockOrders();

// ─── Mock Questions ──────────────────────────────────────
const MOCK_QUESTIONS: TrendyolQuestion[] = [
  {
    id: 1001,
    text: "Bu laptop sehpası kaç kg ağırlığına dayanabilir?",
    status: "WAITING_FOR_ANSWER",
    creationDate: now - 2 * HOUR,
    customerId: 400001,
    userName: "Ahmet Y.",
    productName: "Vigo Wood Ahşap Laptop Sehpası - Doğal Akçaağaç",
    productMainId: "VW-LAPTOP-001",
    public: true,
  },
  {
    id: 1002,
    text: "Ürün gerçekten el yapımı mı? Kaç günde kargoya verilir?",
    status: "WAITING_FOR_ANSWER",
    creationDate: now - 5 * HOUR,
    customerId: 400002,
    userName: "Zeynep Ö.",
    productName: "Vigo Wood At Evi - El Yapımı Dekoratif Kuş Evi",
    productMainId: "VW-AE-001",
    public: true,
  },
  {
    id: 1003,
    text: "Kitap standının açısı ayarlanabiliyor mu?",
    status: "ANSWERED",
    creationDate: now - 2 * DAY,
    customerId: 400003,
    userName: "Mehmet K.",
    productName: "Vigo Wood Ahşap Kitap Okuma Standı - Ceviz",
    productMainId: "VW-KSTAND-001",
    public: true,
    answer: {
      id: 2001,
      text: "Merhaba, evet standımız 5 farklı açı pozisyonunda kullanılabilmektedir. İyi günler dileriz.",
      creationDate: now - 1.5 * DAY,
    },
  },
  {
    id: 1004,
    text: "Organizer'ın ölçüleri nedir? Masama sığar mı?",
    status: "WAITING_FOR_ANSWER",
    creationDate: now - 8 * HOUR,
    customerId: 400004,
    userName: "Elif K.",
    productName: "Vigo Wood Ahşap Organizer - Masaüstü Düzenleyici",
    productMainId: "VW-ORG-001",
    public: true,
  },
  {
    id: 1005,
    text: "Basamak kaç yaş çocuklar için uygun? Güvenlik sertifikası var mı?",
    status: "ANSWERED",
    creationDate: now - 3 * DAY,
    customerId: 400005,
    userName: "Fatma Ç.",
    productName: "Vigo Wood Ahşap Basamak - 2 Basamaklı Çocuk Taburesi",
    productMainId: "VW-BAS-001",
    public: true,
    answer: {
      id: 2002,
      text: "Merhaba, basamağımız 2-8 yaş arası çocuklar için uygundur. CE sertifikalıdır ve maksimum 40 kg taşıma kapasitesine sahiptir.",
      creationDate: now - 2.5 * DAY,
    },
  },
  {
    id: 1006,
    text: "Tablo boyutları tam olarak kaç cm?",
    status: "REJECTED",
    creationDate: now - 4 * DAY,
    customerId: 400006,
    userName: "Deniz P.",
    productName: "Vigo Wood Duvar Tablosu - Geometrik Ahşap Pano",
    productMainId: "VW-TAB-001",
    public: true,
    rejectedAnswer: {
      id: 3001,
      text: "30x40 cm",
      creationDate: now - 3.5 * DAY,
      reason: "Yanıt çok kısa, lütfen daha detaylı bilgi veriniz.",
    },
  },
  {
    id: 1007,
    text: "Kabak lifi doğal mı? Kimyasal kullanılmış mı?",
    status: "WAITING_FOR_APPROVE",
    creationDate: now - 1 * DAY,
    customerId: 400007,
    userName: "Selin Y.",
    productName: "Vigo Wood Kabak Lifi Banyo Seti - 3'lü Paket",
    productMainId: "VW-KL-001",
    public: true,
    answer: {
      id: 2003,
      text: "Merhaba, kabak liflerimiz %100 doğal ve organik olup hiçbir kimyasal işlem uygulanmamıştır. Ünye'de kendi bahçemizde yetiştirdiğimiz kabak liflerinden üretilmektedir.",
      creationDate: now - 20 * HOUR,
    },
  },
];

// ─── Mock Settlements ────────────────────────────────────
function generateMockSettlements(): TrendyolSettlement[] {
  const settlements: TrendyolSettlement[] = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(now - i * DAY);
    const dateStr = date.toISOString().split("T")[0];

    // Sale transactions
    for (let j = 0; j < randomBetween(2, 6); j++) {
      const product = MOCK_PRODUCTS[j % MOCK_PRODUCTS.length];
      const qty = randomBetween(1, 3);
      const amount = product.salePrice * qty;
      const commRate = randomBetween(8, 16);

      settlements.push({
        id: 10000 + i * 10 + j,
        transactionDate: dateStr,
        transactionType: "Sale",
        credit: amount,
        debt: 0,
        barcode: product.barcode,
        commissionRate: commRate,
        commissionAmount: amount * commRate / 100,
        sellerRevenue: amount * (100 - commRate) / 100,
        orderNumber: `${300000000 + i * 10 + j}`,
      });

      // Commission for each sale
      settlements.push({
        id: 10000 + i * 10 + j + 1000,
        transactionDate: dateStr,
        transactionType: "CommissionNegative",
        credit: 0,
        debt: amount * commRate / 100,
        barcode: product.barcode,
        orderNumber: `${300000000 + i * 10 + j}`,
      });
    }

    // Occasional returns
    if (i % 5 === 0) {
      const product = MOCK_PRODUCTS[i % MOCK_PRODUCTS.length];
      settlements.push({
        id: 20000 + i,
        transactionDate: dateStr,
        transactionType: "Return",
        credit: 0,
        debt: product.salePrice,
        barcode: product.barcode,
        orderNumber: `${300000000 + i}`,
      });
    }
  }
  return settlements;
}

const mockSettlements = generateMockSettlements();

// ─── Exported Mock Functions ─────────────────────────────
export function getMockOrders(
  params?: TrendyolOrderParams
): TrendyolPaginatedResponse<TrendyolOrder> {
  let filtered = [...mockOrders];

  if (params?.status) {
    filtered = filtered.filter((o) => o.status === params.status);
  }
  if (params?.orderNumber) {
    filtered = filtered.filter((o) => o.orderNumber.includes(params.orderNumber!));
  }
  if (params?.startDate) {
    filtered = filtered.filter((o) => o.orderDate >= params.startDate!);
  }
  if (params?.endDate) {
    filtered = filtered.filter((o) => o.orderDate <= params.endDate!);
  }

  const page = params?.page ?? 0;
  const size = params?.size ?? 50;
  const start = page * size;
  const content = filtered.slice(start, start + size);

  return {
    page,
    size,
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / size),
    content,
  };
}

export function getMockProducts(
  params?: TrendyolProductParams
): TrendyolPaginatedResponse<TrendyolProduct> {
  let filtered = [...MOCK_PRODUCTS];

  if (params?.approved !== undefined) {
    filtered = filtered.filter((p) => p.approved === params.approved);
  }
  if (params?.barcode) {
    filtered = filtered.filter((p) => p.barcode === params.barcode);
  }
  if (params?.stockCode) {
    filtered = filtered.filter((p) => p.stockCode === params.stockCode);
  }
  if (params?.onSale !== undefined) {
    filtered = filtered.filter((p) => p.onSale === params.onSale);
  }

  const page = params?.page ?? 0;
  const size = params?.size ?? 50;
  const start = page * size;
  const content = filtered.slice(start, start + size);

  return {
    page,
    size,
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / size),
    content,
  };
}

export function getMockQuestions(
  params?: TrendyolQuestionParams
): TrendyolPaginatedResponse<TrendyolQuestion> {
  let filtered = [...MOCK_QUESTIONS];

  if (params?.status) {
    filtered = filtered.filter((q) => q.status === params.status);
  }

  const page = params?.page ?? 0;
  const size = params?.size ?? 50;
  const start = page * size;
  const content = filtered.slice(start, start + size);

  return {
    page,
    size,
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / size),
    content,
  };
}

export function getMockSettlements(
  params?: TrendyolSettlementParams
): TrendyolPaginatedResponse<TrendyolSettlement> {
  let filtered = [...mockSettlements];

  if (params?.transactionType) {
    const types = params.transactionType.split(",");
    filtered = filtered.filter((s) => types.includes(s.transactionType));
  }

  const page = params?.page ?? 0;
  const size = params?.size ?? 500;
  const start = page * size;
  const content = filtered.slice(start, start + size);

  return {
    page,
    size,
    totalElements: filtered.length,
    totalPages: Math.ceil(filtered.length / size),
    content,
  };
}
