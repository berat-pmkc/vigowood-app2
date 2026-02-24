import { NextResponse } from "next/server";

export async function GET() {
  const checks: Record<string, unknown> = {};

  // 1. Check env vars
  checks.envVars = {
    IKAS_CLIENT_ID: process.env.IKAS_CLIENT_ID ? `SET (${process.env.IKAS_CLIENT_ID.substring(0, 8)}...)` : "MISSING",
    IKAS_CLIENT_SECRET: process.env.IKAS_CLIENT_SECRET ? `SET (${process.env.IKAS_CLIENT_SECRET.substring(0, 8)}...)` : "MISSING",
    IKAS_STORE_NAME: process.env.IKAS_STORE_NAME || "MISSING",
  };

  const hasEnv = !!(process.env.IKAS_CLIENT_ID && process.env.IKAS_CLIENT_SECRET && process.env.IKAS_STORE_NAME);
  checks.hasCredentials = hasEnv;

  if (!hasEnv) {
    checks.conclusion = "ENV VARS MISSING — mock data will be used";
    return NextResponse.json(checks);
  }

  // 2. Test token
  try {
    const storeName = process.env.IKAS_STORE_NAME;
    const tokenUrl = `https://${storeName}.myikas.com/api/admin/oauth/token`;
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=client_credentials&client_id=${process.env.IKAS_CLIENT_ID}&client_secret=${process.env.IKAS_CLIENT_SECRET}`,
    });
    const tokenData = await tokenRes.json();
    checks.tokenStatus = tokenRes.status;
    checks.tokenOk = !!tokenData.access_token;
    checks.tokenExpiresIn = tokenData.expires_in;

    if (!tokenData.access_token) {
      checks.tokenError = tokenData;
      checks.conclusion = "TOKEN FAILED";
      return NextResponse.json(checks);
    }

    // 3. Test orders query
    const gqlRes = await fetch("https://api.myikas.com/api/v1/admin/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${tokenData.access_token}`,
      },
      body: JSON.stringify({
        query: `{ listOrder(pagination: { page: 1, limit: 2 }, sort: "orderedAt:desc", orderedAt: { gte: "${new Date(Date.now() - 7 * 86400000).toISOString()}" }) { count hasNext data { orderNumber orderedAt totalFinalPrice status } } }`,
      }),
    });
    const gqlData = await gqlRes.json();
    if (gqlData.errors) {
      checks.gqlErrors = gqlData.errors;
      checks.conclusion = "GQL ERROR";
      return NextResponse.json(checks);
    }
    checks.ordersCount = gqlData.data.listOrder.count;
    checks.sampleOrders = gqlData.data.listOrder.data;

    // 4. Test via our client
    const { getOrders, isUsingMockData } = await import("@/lib/ikas");
    checks.isUsingMockData = isUsingMockData();

    const result = await getOrders({ page: 1, limit: 2, startDate: new Date(Date.now() - 7 * 86400000).toISOString() });
    checks.clientOrdersCount = result.count;
    checks.clientSampleOrders = result.data.map(o => ({
      orderNumber: o.orderNumber,
      orderedAt: o.orderedAt,
      totalFinalPrice: o.totalFinalPrice,
      status: o.status,
    }));
    checks.clientHasNext = result.hasNext;

    checks.conclusion = "ALL OK";
  } catch (err) {
    checks.error = err instanceof Error ? err.message : String(err);
    checks.conclusion = "EXCEPTION";
  }

  return NextResponse.json(checks, { status: 200 });
}
