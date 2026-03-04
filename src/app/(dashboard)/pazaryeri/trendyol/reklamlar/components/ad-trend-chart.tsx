"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MetricKey } from "./filter-bar";

const AD_COLORS = ["#cdbd9d", "#3368b1", "#ee7683", "#70c1aa", "#f28a19"];

const METRIC_LABELS: Record<MetricKey, string> = {
  spent: "Harcama",
  revenue: "Ciro",
  roas: "ROAS",
  sales: "Satış",
  ctr: "CTR",
  cvr: "CVR",
};

interface WeeklyRow {
  ad_name: string;
  period_end: string;
  spent: number;
  total_revenue: number;
  total_sales: number;
  clicks: number;
  impressions: number;
  roas: number;
  ctr: number;
  cvr: number;
}

interface Props {
  data: WeeklyRow[];
  metric: MetricKey;
  selectedAds: string[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" });
}

function getMetricValue(row: WeeklyRow, metric: MetricKey): number {
  switch (metric) {
    case "spent": return Number(row.spent) || 0;
    case "revenue": return Number(row.total_revenue) || 0;
    case "roas": return Number(row.roas) || 0;
    case "sales": return Number(row.total_sales) || 0;
    case "ctr": return Number(row.ctr) || 0;
    case "cvr": return Number(row.cvr) || 0;
  }
}

function formatMetricValue(val: number, metric: MetricKey): string {
  if (metric === "roas") return `${val.toFixed(2)}x`;
  if (metric === "ctr" || metric === "cvr") return `%${val.toFixed(2)}`;
  if (metric === "spent" || metric === "revenue") {
    return `${val.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺`;
  }
  return val.toLocaleString("tr-TR");
}

function formatYAxis(val: number, metric: MetricKey): string {
  if (metric === "roas") return `${val}x`;
  if (metric === "ctr" || metric === "cvr") return `%${val}`;
  if (metric === "spent" || metric === "revenue") {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toFixed(0);
  }
  return val.toLocaleString("tr-TR");
}

export default function AdTrendChart({ data, metric, selectedAds }: Props) {
  // Get unique sorted periods
  const periodsSet = new Set<string>();
  data.forEach((r) => periodsSet.add(r.period_end));
  const periods = Array.from(periodsSet).sort();

  if (selectedAds.length === 0) {
    // "Tüm Reklamlar" — aggregate all ads per period into one line
    const chartData = periods.map((p) => {
      const periodRows = data.filter((r) => r.period_end === p);
      let value: number;
      if (metric === "roas") {
        const totalSpent = periodRows.reduce((s, r) => s + (Number(r.spent) || 0), 0);
        const totalRevenue = periodRows.reduce((s, r) => s + (Number(r.total_revenue) || 0), 0);
        value = totalSpent > 0 ? totalRevenue / totalSpent : 0;
      } else if (metric === "ctr") {
        const totalClicks = periodRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
        const totalImpressions = periodRows.reduce((s, r) => s + (Number(r.impressions) || 0), 0);
        value = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      } else if (metric === "cvr") {
        const totalSales = periodRows.reduce((s, r) => s + (Number(r.total_sales) || 0), 0);
        const totalClicks = periodRows.reduce((s, r) => s + (Number(r.clicks) || 0), 0);
        value = totalClicks > 0 ? (totalSales / totalClicks) * 100 : 0;
      } else {
        value = periodRows.reduce((s, r) => s + getMetricValue(r, metric), 0);
      }
      return { label: formatDate(p), toplam: Math.round(value * 100) / 100 };
    });

    return (
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ left: 0, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatYAxis(v, metric)} />
          <Tooltip
            formatter={(value) => [formatMetricValue(Number(value), metric), METRIC_LABELS[metric]]}
            labelStyle={{ fontWeight: 600 }}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey="toplam"
            name={METRIC_LABELS[metric]}
            stroke="#cdbd9d"
            strokeWidth={2}
            dot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Multiple selected ads — each ad gets its own line (max 5, rest collapsed to "Diğer")
  const displayAds = selectedAds.slice(0, 5);
  const otherAds = selectedAds.slice(5);
  const hasOther = otherAds.length > 0;

  const chartData = periods.map((p) => {
    const periodRows = data.filter((r) => r.period_end === p);
    const point: Record<string, string | number> = { label: formatDate(p) };

    for (const ad of displayAds) {
      const adRows = periodRows.filter((r) => r.ad_name === ad);
      if (metric === "roas") {
        const s = adRows.reduce((acc, r) => acc + (Number(r.spent) || 0), 0);
        const rv = adRows.reduce((acc, r) => acc + (Number(r.total_revenue) || 0), 0);
        point[ad] = s > 0 ? Math.round((rv / s) * 100) / 100 : 0;
      } else if (metric === "ctr") {
        const cl = adRows.reduce((acc, r) => acc + (Number(r.clicks) || 0), 0);
        const imp = adRows.reduce((acc, r) => acc + (Number(r.impressions) || 0), 0);
        point[ad] = imp > 0 ? Math.round((cl / imp) * 10000) / 100 : 0;
      } else if (metric === "cvr") {
        const sl = adRows.reduce((acc, r) => acc + (Number(r.total_sales) || 0), 0);
        const cl = adRows.reduce((acc, r) => acc + (Number(r.clicks) || 0), 0);
        point[ad] = cl > 0 ? Math.round((sl / cl) * 10000) / 100 : 0;
      } else {
        point[ad] = adRows.reduce((acc, r) => acc + getMetricValue(r, metric), 0);
      }
    }

    if (hasOther) {
      const otherRows = periodRows.filter((r) => otherAds.includes(r.ad_name));
      if (metric === "roas") {
        const s = otherRows.reduce((acc, r) => acc + (Number(r.spent) || 0), 0);
        const rv = otherRows.reduce((acc, r) => acc + (Number(r.total_revenue) || 0), 0);
        point["Diğer"] = s > 0 ? Math.round((rv / s) * 100) / 100 : 0;
      } else {
        point["Diğer"] = otherRows.reduce((acc, r) => acc + getMetricValue(r, metric), 0);
      }
    }

    return point;
  });

  const allKeys = [...displayAds, ...(hasOther ? ["Diğer"] : [])];

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ left: 0, right: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatYAxis(v, metric)} />
        <Tooltip
          formatter={(value, name) => [formatMetricValue(Number(value), metric), String(name)]}
          labelStyle={{ fontWeight: 600 }}
        />
        <Legend />
        {allKeys.map((key, i) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            name={key}
            stroke={AD_COLORS[i % AD_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 3 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
