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
const MOCK_CUSTOMERS: IkasCustomer[] = CUSTOMER_NAMES.map((name, i) => ({
  id: `mock-customer-${i}`,
  firstName: name[0],
  lastName: name[1],
  email: `${name[0].toLowerCase()}.${name[1].toLowerCase()}@mock.com`,
  phone: `+9054${randomBetween(10000000, 99999999)}`,
  orderCount: randomBetween(1, 15),
  totalOrderPrice: randomBetween(200, 8000),
  firstOrderDate: now - randomBetween(30, 365) * DAY,
  lastOrderDate: now - randomBetween(0, 30) * DAY,
}));

// Add 5 more customers
for (let i = 0; i < 5; i++) {
  MOCK_CUSTOMERS.push({
    id: `mock-customer-extra-${i}`,
    firstName: ["Gökhan", "Sevgi", "Tolga", "Pınar", "Oğuz"][i],
    lastName: ["Taş", "Güneş", "Erdem", "Bal", "Kılıç"][i],
    email: `extra${i}@mock.com`,
    phone: `+9053${randomBetween(10000000, 99999999)}`,
    orderCount: randomBetween(0, 5),
    totalOrderPrice: randomBetween(0, 3000),
    firstOrderDate: now - randomBetween(10, 180) * DAY,
    lastOrderDate: now - randomBetween(0, 60) * DAY,
  });
}

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
    count: data.length,
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
    count: data.length,
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

  const page = params?.page ?? 1;
  const limit = params?.limit ?? 50;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return {
    data,
    count: data.length,
    hasNext: start + limit < filtered.length,
    page,
    limit,
  };
}
