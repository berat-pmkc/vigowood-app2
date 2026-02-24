require('dotenv').config({ path: '.env.local' });

const sellerId = process.env.TRENDYOL_SELLER_ID;
const apiKey = process.env.TRENDYOL_API_KEY;
const apiSecret = process.env.TRENDYOL_API_SECRET;
const auth = Buffer.from(apiKey + ':' + apiSecret).toString('base64');
const TR = 3 * 60 * 60 * 1000;
const DAY = 86400000;

async function fetchPage(page, extra) {
  const params = new URLSearchParams({ page: String(page), size: '200', ...extra });
  const url = 'https://api.trendyol.com/sapigw/suppliers/' + sellerId + '/orders?' + params;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + auth, 'User-Agent': sellerId + ' - SelfIntegration' }
  });
  if (res.status !== 200) return null;
  return res.json();
}

async function main() {
  const now = Date.now();

  // Test weekly chunks going back 90 days
  console.log('=== Weekly chunk totals (last 90 days) ===');
  let grandTotal = 0;
  const allIds = new Set();

  for (let weeksAgo = 0; weeksAgo < 13; weeksAgo++) {
    const end = now - weeksAgo * 7 * DAY;
    const start = now - (weeksAgo + 1) * 7 * DAY;
    const startLabel = new Date(start + TR).toISOString().slice(0,10);
    const endLabel = new Date(end + TR).toISOString().slice(0,10);

    const r = await fetchPage(0, {
      startDate: String(start),
      endDate: String(end),
      orderByField: 'PackageLastModifiedDate',
      orderByDirection: 'DESC',
    });

    if (r) {
      // Count unique order IDs from first page
      for (const o of r.content) allIds.add(o.shipmentPackageId);
      console.log(startLabel, '→', endLabel, ':', r.totalElements, 'orders,', r.totalPages, 'pages');
      grandTotal += r.totalElements;
    } else {
      console.log(startLabel, '→', endLabel, ': ERROR');
    }
  }

  console.log('\nGrand total (with dupes):', grandTotal);

  // Now check: how many unique orderDates per day if we fetch ALL pages for the problematic week
  console.log('\n=== Fetching ALL pages for Feb 1-8 chunk ===');
  const feb1 = Date.UTC(2026, 1, 1) - TR;
  const feb8 = Date.UTC(2026, 1, 8) - TR;
  let allOrders = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const r = await fetchPage(page, {
      startDate: String(feb1),
      endDate: String(feb8),
      orderByField: 'PackageLastModifiedDate',
      orderByDirection: 'DESC',
    });
    if (r === null || r.content.length === 0) break;
    allOrders.push(...r.content);
    page++;
    hasMore = page < r.totalPages;
  }
  console.log('Total orders fetched (Feb 1-8 by lastMod):', allOrders.length);

  const dayCount = {};
  for (const o of allOrders) {
    const d = new Date(o.orderDate + TR).toISOString().slice(0,10);
    dayCount[d] = (dayCount[d] || 0) + 1;
  }
  // Sort and print
  const sorted = Object.entries(dayCount).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [day, count] of sorted) {
    console.log(' ', day, ':', count, 'orders');
  }

  // Also fetch Feb 8-15
  console.log('\n=== Fetching ALL pages for Feb 8-15 chunk ===');
  const feb15 = Date.UTC(2026, 1, 15) - TR;
  let allOrders2 = [];
  page = 0;
  hasMore = true;
  while (hasMore) {
    const r = await fetchPage(page, {
      startDate: String(feb8),
      endDate: String(feb15),
      orderByField: 'PackageLastModifiedDate',
      orderByDirection: 'DESC',
    });
    if (r === null || r.content.length === 0) break;
    allOrders2.push(...r.content);
    page++;
    hasMore = page < r.totalPages;
  }
  console.log('Total orders fetched (Feb 8-15 by lastMod):', allOrders2.length);
  const dayCount2 = {};
  for (const o of allOrders2) {
    const d = new Date(o.orderDate + TR).toISOString().slice(0,10);
    dayCount2[d] = (dayCount2[d] || 0) + 1;
  }
  const sorted2 = Object.entries(dayCount2).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [day, count] of sorted2) {
    console.log(' ', day, ':', count, 'orders');
  }
}

main().catch(console.error);
