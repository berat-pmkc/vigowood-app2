const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const c = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function check() {
  // Get ALL distinct transaction types (paginate)
  let page = 0;
  const typeCounts = {};
  let total = 0;
  while (true) {
    const { data } = await c.from('trendyol_settlements').select('transaction_type').range(page * 1000, (page + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(r => { typeCounts[r.transaction_type] = (typeCounts[r.transaction_type] || 0) + 1; });
    total += data.length;
    page++;
  }
  console.log('Total settlements:', total);
  console.log('Types:', JSON.stringify(typeCounts, null, 2));

  // Check date range of settlements
  const { data: oldest } = await c.from('trendyol_settlements').select('transaction_date').order('transaction_date', { ascending: true }).limit(1);
  const { data: newest } = await c.from('trendyol_settlements').select('transaction_date').order('transaction_date', { ascending: false }).limit(1);
  if (oldest && oldest[0]) {
    console.log('\nOldest settlement:', oldest[0].transaction_date, '->', new Date(parseInt(oldest[0].transaction_date)).toISOString());
  }
  if (newest && newest[0]) {
    console.log('Newest settlement:', newest[0].transaction_date, '->', new Date(parseInt(newest[0].transaction_date)).toISOString());
  }

  // Check order date range
  const { data: oldO } = await c.from('trendyol_orders').select('order_date').order('order_date', { ascending: true }).limit(1);
  const { data: newO } = await c.from('trendyol_orders').select('order_date').order('order_date', { ascending: false }).limit(1);
  if (oldO && oldO[0]) console.log('\nOldest order:', new Date(oldO[0].order_date).toISOString());
  if (newO && newO[0]) console.log('Newest order:', new Date(newO[0].order_date).toISOString());

  // Order statuses
  let oPage = 0;
  const statusCounts = {};
  while (true) {
    const { data } = await c.from('trendyol_orders').select('status').range(oPage * 1000, (oPage + 1) * 1000 - 1);
    if (!data || data.length === 0) break;
    data.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1; });
    oPage++;
  }
  console.log('\nOrder statuses:', JSON.stringify(statusCounts));

  // Sample commission data on settlements
  const { data: commSample } = await c.from('trendyol_settlements')
    .select('commission_amount, commission_rate, seller_revenue, credit')
    .not('commission_amount', 'is', null)
    .limit(5);
  console.log('\nSample commission data:', JSON.stringify(commSample));

  // Check for null commission
  const { count: nullComm } = await c.from('trendyol_settlements')
    .select('*', { count: 'exact', head: true })
    .is('commission_amount', null);
  const { count: hasComm } = await c.from('trendyol_settlements')
    .select('*', { count: 'exact', head: true })
    .not('commission_amount', 'is', null);
  console.log('\nSettlements with commission:', hasComm, '| without:', nullComm);
}

check().catch(console.error);
