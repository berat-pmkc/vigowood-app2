/**
 * Mock data for İkas API — used when API credentials are invalid
 * Realistic VigoWood product data
 */
import type {
  IkasPaginatedResponse,
  IkasOrder,
  IkasOrderParams,
  IkasProduct,
  IkasProductParams,
  IkasCustomer,
  IkasCustomerParams,
  IkasOrderStatus,
  IkasPackageStatus,
} from "./types";

// ─── Helpers ─────────────────────────────────────────────
const now = Date.now();
const DAY = 86_400_000;
const HOUR = 3_600_000;

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ─── Mock Products ───────────────────────────────────────
const MOCK_PRODUCTS: IkasProduct[] = [
  {
    id: "IK-001",
    name: "Vigo Wood Ahşap Laptop Sehpası - Doğal Akçaağaç",
    type: "PHYSICAL",
    totalStock: 45,
    variants: [{
      id: "IKV-001", sku: "VW-LP-NAT", isActive: true,
      barcodeList: ["8682530001001"],
      prices: [{ sellPrice: 899.99, discountPrice: 749.99, currency: "TRY" }],
      images: [{ imageId: "img-001", isMain: true }],
    }],
  },
  {
    id: "IK-002",
    name: "Vigo Wood Ahşap Kitap Okuma Standı - Ceviz",
    type: "PHYSICAL",
    totalStock: 128,
    variants: [{
      id: "IKV-002", sku: "VW-KS-WAL", isActive: true,
      barcodeList: ["8682530001002"],
      prices: [{ sellPrice: 549.99, discountPrice: 449.99, currency: "TRY" }],
      images: [{ imageId: "img-002", isMain: true }],
    }],
  },
  {
    id: "IK-003",
    name: "Vigo Wood Ahşap Telefon Standı - Meşe",
    type: "PHYSICAL",
    totalStock: 234,
    variants: [{
      id: "IKV-003", sku: "VW-TS-OAK", isActive: true,
      barcodeList: ["8682530001003"],
      prices: [{ sellPrice: 299.99, discountPrice: 249.99, currency: "TRY" }],
      images: [{ imageId: "img-003", isMain: true }],
    }],
  },
  {
    id: "IK-004",
    name: "Vigo Wood Premium Kitaplık - 5 Raflı Doğal Ahşap",
    type: "PHYSICAL",
    totalStock: 12,
    variants: [{
      id: "IKV-004", sku: "VW-KTP-5R", isActive: true,
      barcodeList: ["8682530001004"],
      prices: [{ sellPrice: 2499.99, discountPrice: 1999.99, currency: "TRY" }],
      images: [{ imageId: "img-004", isMain: true }],
    }],
  },
  {
    id: "IK-005",
    name: "Vigo Wood Ahşap Organizer - Masaüstü Düzenleyici",
    type: "PHYSICAL",
    totalStock: 87,
    variants: [{
      id: "IKV-005", sku: "VW-ORG-DS", isActive: true,
      barcodeList: ["8682530001005"],
      prices: [{ sellPrice: 449.99, discountPrice: 379.99, currency: "TRY" }],
      images: [{ imageId: "img-005", isMain: true }],
    }],
  },
  {
    id: "IK-006",
    name: "Vigo Wood At Evi - El Yapımı Dekoratif Kuş Evi",
    type: "PHYSICAL",
    totalStock: 56,
    variants: [{
      id: "IKV-006", sku: "VW-AE-STD", isActive: true,
      barcodeList: ["8682530001006"],
      prices: [{ sellPrice: 199.99, discountPrice: 169.99, currency: "TRY" }],
      images: [{ imageId: "img-006", isMain: true }],
    }],
  },
  {
    id: "IK-007",
    name: "Vigo Wood Ahşap Basamak - 2 Basamaklı Çocuk Taburesi",
    type: "PHYSICAL",
    totalStock: 0,
    variants: [{
      id: "IKV-007", sku: "VW-BAS-2B", isActive: false,
      barcodeList: ["8682530001007"],
      prices: [{ sellPrice: 699.99, discountPrice: 599.99, currency: "TRY" }],
      images: [{ imageId: "img-007", isMain: true }],
    }],
  },
  {
    id: "IK-008",
    name: "Vigo Wood Duvar Tablosu - Geometrik Ahşap Pano",
    type: "PHYSICAL",
    totalStock: 34,
    variants: [{
      id: "IKV-008", sku: "VW-TAB-GEO", isActive: true,
      barcodeList: ["8682530001008"],
      prices: [{ sellPrice: 349.99, discountPrice: 299.99, currency: "TRY" }],
      images: [{ imageId: "img-008", isMain: true }],
    }],
  },
  {
    id: "IK-009",
    name: "Yükseklik Ayarlanabilir Katlanabilir Kitap Okuma Standı",
    type: "PHYSICAL",
    totalStock: 22,
    variants: [{
      id: "IKV-009", sku: "DYKOS01", isActive: true,
      barcodeList: ["8682530001009"],
      prices: [{ sellPrice: 1199.99, discountPrice: 999.99, currency: "TRY" }],
      images: [{ imageId: "img-009", isMain: true }],
    }],
  },
  {
    id: "IK-010",
    name: "Renkli Minderli Kitap Okuma Standı",
    type: "PHYSICAL",
    totalStock: 156,
    variants: [{
      id: "IKV-010", sku: "MKOS42N", isActive: true,
      barcodeList: ["MKOS42N"],
      prices: [{ sellPrice: 1029, discountPrice: 989, currency: "TRY" }],
      images: [{ imageId: "img-010", isMain: true }],
    }],
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
  { name: "İstanbul", code: "34", districts: ["Kadıköy", "Beşiktaş", "Üsküdar", "Ataşehir"] },
  { name: "Ankara", code: "6", districts: ["Çankaya", "Keçiören", "Yenimahalle"] },
  { name: "İzmir", code: "35", districts: ["Konak", "Bornova", "Karşıyaka"] },
  { name: "Bursa", code: "16", districts: ["Osmangazi", "Nilüfer", "Yıldırım"] },
  { name: "Antalya", code: "7", districts: ["Muratpaşa", "Konyaaltı", "Kepez"] },
];

const PACKAGE_STATUSES: IkasPackageStatus[] = [
  "UNFULFILLED", "UNFULFILLED", "FULFILLED", "FULFILLED",
  "READY_FOR_SHIPMENT", "READY_FOR_SHIPMENT", "READY_FOR_SHIPMENT",
  "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED",
  "CANCELLED", "REFUNDED",
];

const ORDER_STATUSES: IkasOrderStatus[] = [
  "CREATED", "CREATED", "CREATED", "CREATED",
  "CREATED", "CREATED", "CREATED",
  "CREATED", "CREATED", "CREATED", "CREATED", "CREATED",
  "CANCELLED", "REFUNDED",
];

function generateMockOrders(): IkasOrder[] {
  const orders: IkasOrder[] = [];
  for (let i = 0; i < 50; i++) {
    const customer = CUSTOMER_NAMES[i % CUSTOMER_NAMES.length];
    const city = CITIES[i % CITIES.length];
    const district = city.districts[i % city.districts.length];
    const pkgStatus = PACKAGE_STATUSES[i % PACKAGE_STATUSES.length];
    const orderStatus = ORDER_STATUSES[i % ORDER_STATUSES.length];
    const product = MOCK_PRODUCTS[i % MOCK_PRODUCTS.length];
    const orderDate = now - randomBetween(0, 14) * DAY - randomBetween(0, 23) * HOUR;
    const qty = randomBetween(1, 3);
    const price = product.variants[0].prices[0].sellPrice;

    orders.push({
      id: `mock-order-${String(i).padStart(3, "0")}`,
      orderNumber: `VWI${1000 + i}`,
      status: orderStatus,
      orderPaymentStatus: "PAID",
      orderPackageStatus: pkgStatus,
      totalPrice: price * qty,
      totalFinalPrice: price * qty * 0.92,
      currencyCode: "TRY",
      orderedAt: orderDate,
      customer: {
        firstName: customer[0],
        lastName: customer[1],
        email: `${customer[0].toLowerCase()}.${customer[1].toLowerCase()}@mock.com`,
        phone: `+9054${randomBetween(10000000, 99999999)}`,
      },
      shippingAddress: {
        addressLine1: `${district} Mah. Örnek Sok. No:${randomBetween(1, 100)}`,
        city: { name: city.name, code: city.code },
        country: { name: "Türkiye", code: "TUR" },
      },
      orderLineItems: [
        {
          id: `mock-line-${i}`,
          quantity: qty,
          price: price,
          finalPrice: price * 0.92,
          variant: {
            id: product.variants[0].id,
            sku: product.variants[0].sku,
            name: product.name,
          },
        },
      ],
      salesChannel: { id: "mock-channel", name: "vigowood" },
    });
  }
  return orders.sort((a, b) => b.orderedAt - a.orderedAt);
}

const mockOrders = generateMockOrders();

// ─── Mock Customers ─────────────────────────────────────
// Segment distribution: VIP(10+): 5, Sadık(3-9): 10, Aktif(1-2): 15, Yeni(0): 5 = 35 total
const CUSTOMER_PROFILES: { firstName: string; lastName: string; orderCount: number; totalOrderPrice: number }[] = [
  // VIP (10+ sipariş) — 5 kişi
  { firstName: "Ahmet", lastName: "Yılmaz", orderCount: 18, totalOrderPrice: 24500 },
  { firstName: "Ayşe", lastName: "Demir", orderCount: 14, totalOrderPrice: 18200 },
  { firstName: "Mehmet", lastName: "Kaya", orderCount: 12, totalOrderPrice: 15800 },
  { firstName: "Fatma", lastName: "Çelik", orderCount: 11, totalOrderPrice: 14200 },
  { firstName: "Mustafa", lastName: "Şahin", orderCount: 10, totalOrderPrice: 12000 },
  // Sadık (3-9 sipariş) — 10 kişi
  { firstName: "Zeynep", lastName: "Öztürk", orderCount: 9, totalOrderPrice: 8900 },
  { firstName: "Ali", lastName: "Arslan", orderCount: 8, totalOrderPrice: 7600 },
  { firstName: "Elif", lastName: "Koç", orderCount: 7, totalOrderPrice: 6300 },
  { firstName: "Hasan", lastName: "Kurt", orderCount: 6, totalOrderPrice: 5800 },
  { firstName: "Merve", lastName: "Aydın", orderCount: 5, totalOrderPrice: 4200 },
  { firstName: "Emre", lastName: "Özdemir", orderCount: 5, totalOrderPrice: 3900 },
  { firstName: "Selin", lastName: "Yıldırım", orderCount: 4, totalOrderPrice: 3500 },
  { firstName: "Burak", lastName: "Doğan", orderCount: 4, totalOrderPrice: 3200 },
  { firstName: "Deniz", lastName: "Polat", orderCount: 3, totalOrderPrice: 2800 },
  { firstName: "Can", lastName: "Erdoğan", orderCount: 3, totalOrderPrice: 2100 },
  // Aktif (1-2 sipariş) — 15 kişi
  { firstName: "Gökhan", lastName: "Taş", orderCount: 2, totalOrderPrice: 1800 },
  { firstName: "Sevgi", lastName: "Güneş", orderCount: 2, totalOrderPrice: 1600 },
  { firstName: "Tolga", lastName: "Erdem", orderCount: 2, totalOrderPrice: 1400 },
  { firstName: "Pınar", lastName: "Bal", orderCount: 2, totalOrderPrice: 1200 },
  { firstName: "Oğuz", lastName: "Kılıç", orderCount: 1, totalOrderPrice: 950 },
  { firstName: "Ceren", lastName: "Akın", orderCount: 1, totalOrderPrice: 890 },
  { firstName: "Baran", lastName: "Yüksel", orderCount: 1, totalOrderPrice: 780 },
  { firstName: "Nihan", lastName: "Çetin", orderCount: 1, totalOrderPrice: 650 },
  { firstName: "Ege", lastName: "Aslan", orderCount: 2, totalOrderPrice: 1350 },
  { firstName: "Defne", lastName: "Korkmaz", orderCount: 1, totalOrderPrice: 550 },
  { firstName: "Murat", lastName: "Yıldız", orderCount: 1, totalOrderPrice: 480 },
  { firstName: "Seda", lastName: "Aktaş", orderCount: 2, totalOrderPrice: 1100 },
  { firstName: "Okan", lastName: "Güler", orderCount: 1, totalOrderPrice: 720 },
  { firstName: "Esra", lastName: "Çakır", orderCount: 1, totalOrderPrice: 390 },
  { firstName: "Barış", lastName: "Özkan", orderCount: 2, totalOrderPrice: 1500 },
  // Yeni (0 sipariş) — 5 kişi
  { firstName: "Tuğba", lastName: "Koçak", orderCount: 0, totalOrderPrice: 0 },
  { firstName: "Kerem", lastName: "Acar", orderCount: 0, totalOrderPrice: 0 },
  { firstName: "Gül", lastName: "Sarı", orderCount: 0, totalOrderPrice: 0 },
  { firstName: "Onur", lastName: "Kaplan", orderCount: 0, totalOrderPrice: 0 },
  { firstName: "Nehir", lastName: "Tekin", orderCount: 0, totalOrderPrice: 0 },
];

const MOCK_CUSTOMERS: IkasCustomer[] = CUSTOMER_PROFILES.map((p, i) => ({
  id: `mock-customer-${i}`,
  firstName: p.firstName,
  lastName: p.lastName,
  email: `${p.firstName.toLowerCase()}.${p.lastName.toLowerCase()}@mock.com`,
  phone: `+9054${randomBetween(10000000, 99999999)}`,
  orderCount: p.orderCount,
  totalOrderPrice: p.totalOrderPrice,
  firstOrderDate: p.orderCount > 0 ? now - randomBetween(30, 365) * DAY : null,
  lastOrderDate: p.orderCount > 0 ? now - randomBetween(0, 30) * DAY : null,
}));

// ─── Exported Mock Functions ─────────────────────────────
export function getMockOrders(
  params?: IkasOrderParams
): IkasPaginatedResponse<IkasOrder> {
  let filtered = [...mockOrders];

  if (params?.packageStatus) {
    filtered = filtered.filter((o) => o.orderPackageStatus === params.packageStatus);
  }
  if (params?.status) {
    filtered = filtered.filter((o) => o.status === params.status);
  }
  if (params?.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        `${o.customer.firstName} ${o.customer.lastName}`.toLowerCase().includes(q)
    );
  }
  if (params?.startDate) {
    const start = new Date(params.startDate).getTime();
    filtered = filtered.filter((o) => o.orderedAt >= start);
  }
  if (params?.endDate) {
    const end = new Date(params.endDate).getTime();
    filtered = filtered.filter((o) => o.orderedAt <= end);
  }

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return {
    data,
    count: filtered.length,
    hasNext: start + limit < filtered.length,
    page,
    limit,
  };
}

export function getMockProducts(
  params?: IkasProductParams
): IkasPaginatedResponse<IkasProduct> {
  let filtered = [...MOCK_PRODUCTS];

  if (params?.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.variants.some((v) => v.sku.toLowerCase().includes(q))
    );
  }

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return {
    data,
    count: filtered.length,
    hasNext: start + limit < filtered.length,
    page,
    limit,
  };
}

export function getMockCustomers(
  params?: IkasCustomerParams
): IkasPaginatedResponse<IkasCustomer> {
  let filtered = [...MOCK_CUSTOMERS];

  if (params?.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(
      (c) =>
        `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)
    );
  }

  // Sort support (mirrors İkas API sort format: "field:direction")
  if (params?.sort) {
    const [field, dir] = params.sort.split(":");
    const asc = dir === "asc";
    filtered.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;
      switch (field) {
        case "firstName":
          aVal = a.firstName.toLowerCase();
          bVal = b.firstName.toLowerCase();
          break;
        case "lastName":
          aVal = a.lastName.toLowerCase();
          bVal = b.lastName.toLowerCase();
          break;
        case "lastOrderDate":
          aVal = a.lastOrderDate ?? 0;
          bVal = b.lastOrderDate ?? 0;
          break;
        case "orderCount":
          aVal = a.orderCount ?? 0;
          bVal = b.orderCount ?? 0;
          break;
        case "totalOrderPrice":
          aVal = a.totalOrderPrice ?? 0;
          bVal = b.totalOrderPrice ?? 0;
          break;
        default:
          return 0;
      }
      if (typeof aVal === "string" && typeof bVal === "string") {
        return asc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return asc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return {
    data,
    count: filtered.length,
    hasNext: start + limit < filtered.length,
    page,
    limit,
  };
}
