require('dotenv').config({ path: '.env.local' });

const sellerId = process.env.TRENDYOL_SELLER_ID;
const apiKey = process.env.TRENDYOL_API_KEY;
const apiSecret = process.env.TRENDYOL_API_SECRET;
const auth = Buffer.from(apiKey + ':' + apiSecret).toString('base64');

const TR = 3 * 60 * 60 * 1000;

async function fetchPage(page, extra) {
  const params = new URLSearchParams({ page: String(page), size: '200', ...extra });
  const url = 'https://api.trendyol.com/sapigw/suppliers/' + sellerId + '/orders?' + params;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + auth, 'User-Agent': sellerId + ' - SelfIntegration' }
  });
  if (res.status !== 200) { console.log('HTTP', res.status); return null; }
  return res.json();
}

async function main() {
  // Test 1: No date filter, CreatedDate ASC
  console.log('=== Test 1: No filter, CreatedDate ASC ===');
  const t1 = await fetchPage(0, { orderByField: 'CreatedDate', orderByDirection: 'ASC' });
  if (t1) {
    console.log('Total:', t1.totalElements, 'pages:', t1.totalPages);
    if (t1.content[0]) console.log('Oldest:', new Date(t1.content[0].orderDate + TR).toISOString().slice(0,10));
    const last = t1.content[t1.content.length - 1];
    if (last) console.log('Page 0 last:', new Date(last.orderDate + TR).toISOString().slice(0,10));
  }

  // Test 2: startDate far back (2025-01-01), CreatedDate ASC
  const farBack = Date.UTC(2025, 0, 1) - TR;
  const now = Date.now();
  console.log('\n=== Test 2: startDate=2025-01-01, CreatedDate ASC ===');
  const t2 = await fetchPage(0, { startDate: String(farBack), endDate: String(now), orderByField: 'CreatedDate', orderByDirection: 'ASC' });
  if (t2) {
    console.log('Total:', t2.totalElements, 'pages:', t2.totalPages);
    if (t2.content[0]) console.log('Oldest:', new Date(t2.content[0].orderDate + TR).toISOString().slice(0,10));
  }

  // Test 3: Feb 1-7 specifically
  const feb1 = Date.UTC(2026, 1, 1) - TR;
  const feb7 = Date.UTC(2026, 1, 7) - TR;
  console.log('\n=== Test 3: Feb 1-7, CreatedDate ASC ===');
  const t3 = await fetchPage(0, { startDate: String(feb1), endDate: String(feb7), orderByField: 'CreatedDate', orderByDirection: 'ASC' });
  if (t3) {
    console.log('Total Feb 1-7:', t3.totalElements, 'pages:', t3.totalPages);
    const dayCount = {};
    for (const o of t3.content) {
      const d = new Date(o.orderDate + TR).toISOString().slice(0,10);
      dayCount[d] = (dayCount[d] || 0) + 1;
    }
    console.log('Days:', dayCount);
  }

  // Test 4: Feb 7-14 specifically
  const feb14 = Date.UTC(2026, 1, 14) - TR;
  console.log('\n=== Test 4: Feb 7-14, CreatedDate ASC ===');
  const t4 = await fetchPage(0, { startDate: String(feb7), endDate: String(feb14), orderByField: 'CreatedDate', orderByDirection: 'ASC' });
  if (t4) {
    console.log('Total Feb 7-14:', t4.totalElements, 'pages:', t4.totalPages);
    const dayCount = {};
    for (const o of t4.content) {
      const d = new Date(o.orderDate + TR).toISOString().slice(0,10);
      dayCount[d] = (dayCount[d] || 0) + 1;
    }
    console.log('Days:', dayCount);
  }

  // Test 5: No filter, PackageLastModifiedDate DESC — what our sync does
  console.log('\n=== Test 5: No filter, PackageLastModifiedDate DESC (current sync) ===');
  const t5 = await fetchPage(0, { orderByField: 'PackageLastModifiedDate', orderByDirection: 'DESC' });
  if (t5) {
    console.log('Total:', t5.totalElements, 'pages:', t5.totalPages);
    // Check last page to see oldest records
    const lastPage = await fetchPage(t5.totalPages - 1, { orderByField: 'PackageLastModifiedDate', orderByDirection: 'DESC' });
    if (lastPage) {
      const oldest = lastPage.content[lastPage.content.length - 1];
      if (oldest) {
        console.log('Oldest lastMod:', new Date(oldest.lastModifiedDate + TR).toISOString().slice(0,10));
        console.log('Oldest orderDate:', new Date(oldest.orderDate + TR).toISOString().slice(0,10));
      }
    }
  }
}

main().catch(console.error);
