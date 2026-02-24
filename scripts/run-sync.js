// Manual sync runner — tests the weekly chunk approach
require('dotenv').config({ path: '.env.local' });

const sellerId = process.env.TRENDYOL_SELLER_ID;
const apiKey = process.env.TRENDYOL_API_KEY;
const apiSecret = process.env.TRENDYOL_API_SECRET;
const auth = Buffer.from(apiKey + ':' + apiSecret).toString('base64');

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TR = 3 * 60 * 60 * 1000;
const WEEK_MS = 7 * 86400000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchOrders(params) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) qs.set(k, String(v));
  }
  const url = 'https://api.trendyol.com/sapigw/suppliers/' + sellerId + '/orders?' + qs;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + auth, 'User-Agent': sellerId + ' - SelfIntegration' }
  });
  if (res.status !== 200) throw new Error('HTTP ' + res.status);
  return res.json();
}

function mapOrderToRow(order) {
  return {
    id: order.shipmentPackageId,
    order_number: order.orderNumber,
    customer_id: order.customerId,
    customer_first_name: order.customerFirstName,
    customer_last_name: order.customerLastName,
    customer_email: order.customerEmail || null,
    gross_amount: order.grossAmount,
    total_discount: order.totalDiscount,
    total_price: order.totalPrice,
    status: order.status,
    shipment_address: order.shipmentAddress,
    invoice_address: order.invoiceAddress,
    cargo_tracking_number: order.cargoTrackingNumber || null,
    cargo_tracking_link: order.cargoTrackingLink || null,
    cargo_provider_name: order.cargoProviderName || null,
    cargo_sender_number: order.cargoSenderNumber || null,
    delivery_type: order.deliveryType || null,
    order_date: order.orderDate,
    last_modified_date: order.lastModifiedDate,
    package_histories: order.packageHistories || null,
    raw_data: {
      commercial: order.commercial,
      fastDelivery: order.fastDelivery,
      invoiceLink: order.invoiceLink,
      estimatedDeliveryStartDate: order.estimatedDeliveryStartDate,
      estimatedDeliveryEndDate: order.estimatedDeliveryEndDate,
      deliveryAddressType: order.deliveryAddressType,
    },
  };
}

function mapLineToRow(line, orderId) {
  return {
    id: line.id,
    order_id: orderId,
    line_id: line.lineId || null,
    quantity: line.quantity,
    merchant_sku: line.merchantSku,
    sku: line.sku || null,
    stock_code: line.stockCode || null,
    product_name: line.productName,
    barcode: line.barcode,
    amount: line.amount,
    discount: line.discount,
    currency_code: line.currencyCode,
    vat_base_amount: line.vatBaseAmount,
    vat_rate: line.vatRate || null,
    price: line.price,
    status_name: line.orderLineItemStatusName,
    commission: line.commission || null,
    product_size: line.productSize || null,
    product_color: line.productColor || null,
    image_url: line.imageUrl || null,
  };
}

async function main() {
  const now = Date.now();
  let totalSynced = 0;
  let requestCount = 0;

  console.log('Starting weekly chunk sync (13 weeks / ~90 days)...');

  for (let w = 0; w < 13; w++) {
    const start = now - (w + 1) * WEEK_MS;
    const end = now - w * WEEK_MS;
    const startLabel = new Date(start + TR).toISOString().slice(0, 10);
    const endLabel = new Date(end + TR).toISOString().slice(0, 10);

    let page = 0;
    let hasMore = true;
    let chunkCount = 0;

    while (hasMore) {
      if (requestCount > 0 && requestCount % 40 === 0) {
        console.log('  Rate limit pause...');
        await sleep(10000);
      }

      const result = await fetchOrders({
        startDate: start,
        endDate: end,
        page,
        size: 200,
        orderByField: 'PackageLastModifiedDate',
        orderByDirection: 'DESC',
      });
      requestCount++;

      if (result.content.length === 0) break;

      // Upsert orders
      const orderRows = result.content.map(mapOrderToRow);
      const { error: orderErr } = await supabase
        .from('trendyol_orders')
        .upsert(orderRows, { onConflict: 'id' });

      if (orderErr) throw new Error('Order upsert failed: ' + orderErr.message);

      // Upsert order lines
      for (const order of result.content) {
        if (order.lines.length === 0) continue;
        await supabase.from('trendyol_order_lines').delete().eq('order_id', order.shipmentPackageId);
        const lineRows = order.lines.map(l => mapLineToRow(l, order.shipmentPackageId));
        const { error: lineErr } = await supabase.from('trendyol_order_lines').insert(lineRows);
        if (lineErr) console.warn('  Line insert error:', lineErr.message);
      }

      chunkCount += result.content.length;
      totalSynced += result.content.length;
      page++;
      hasMore = page < result.totalPages;
    }

    console.log('Week', w, '(' + startLabel + ' → ' + endLabel + '):', chunkCount, 'orders');
  }

  console.log('\nTotal synced:', totalSynced, '(includes duplicates from overlapping modifications)');

  // Now verify Feb data
  console.log('\n=== Verifying Feb 2026 data in DB ===');
  function tsToTRDate(ts) {
    const d = new Date(ts + TR);
    return d.toISOString().slice(0,10);
  }

  const febStart = Date.UTC(2026, 1, 1) - TR;
  const febEnd = Date.UTC(2026, 2, 1) - TR - 1;
  let allOrders = [];
  let offset = 0;
  let more = true;
  while (more) {
    const { data } = await supabase
      .from('trendyol_orders')
      .select('id, order_date, total_price')
      .gte('order_date', febStart)
      .lte('order_date', febEnd)
      .order('order_date', { ascending: true })
      .range(offset, offset + 999);
    allOrders.push(...(data || []));
    more = (data || []).length === 1000;
    offset += 1000;
  }

  console.log('Total Feb orders in DB:', allOrders.length);
  const dayMap = {};
  for (const o of allOrders) {
    const day = tsToTRDate(o.order_date);
    if (!dayMap[day]) dayMap[day] = { count: 0, ciro: 0 };
    dayMap[day].count++;
    dayMap[day].ciro += o.total_price;
  }

  for (let d = 1; d <= 24; d++) {
    const key = '2026-02-' + String(d).padStart(2,'0');
    const info = dayMap[key] || { count: 0, ciro: 0 };
    const bar = '#'.repeat(Math.min(Math.round(info.count / 3), 50));
    console.log(key, String(info.count).padStart(4), 'sip', String(Math.round(info.ciro)).padStart(8) + ' TL', bar);
  }
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
