"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Bot, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

type AgentStat = {
  agent_id: string;
  agent_name: string;
  total_tokens: number;
  total_cost: number;
  action_count: number;
};

interface KullanimClientProps {
  stats: {
    totalCost: number;
    agents: AgentStat[];
    actions: Array<Record<string, unknown>>;
  };
  currentPeriod: string;
}

const PERIODS = [
  { value: "day", label: "Günlük" },
  { value: "week", label: "Haftalık" },
  { value: "month", label: "Aylık" },
] as const;

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function KullanimClient({ stats, currentPeriod }: KullanimClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setPeriod = (p: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.push(`${pathname}?${params.toString()}`);
  };

  const mostActiveAgent = stats.agents.length > 0
    ? stats.agents.reduce((a, b) => (a.action_count > b.action_count ? a : b))
    : null;

  const avgCostPerTask = stats.actions.length > 0
    ? stats.totalCost / stats.actions.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        {PERIODS.map((p) => (
          <button
            key={p.value}
            onClick={() => setPeriod(p.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              currentPeriod === p.value
                ? "bg-background text-vw-dark shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam Harcama
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.actions.length} işlem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Aktif Asistan
            </CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {mostActiveAgent?.agent_name ?? "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {mostActiveAgent ? `${mostActiveAgent.action_count} işlem` : "Henüz işlem yok"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ort. İşlem Maliyeti
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${avgCostPerTask.toFixed(6)}</div>
            <p className="text-xs text-muted-foreground">
              İşlem başına ortalama
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asistan Bazlı Kullanım</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.agents.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Bu dönemde asistan aktivitesi yok
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-2 font-medium text-muted-foreground">Asistan</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">İşlem</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Token</th>
                    <th className="pb-2 font-medium text-muted-foreground text-right">Maliyet ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.agents.map((a) => (
                    <tr key={a.agent_id} className="border-b last:border-0">
                      <td className="py-2 font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100">
                            <Bot className="h-3.5 w-3.5 text-violet-700" />
                          </div>
                          {a.agent_name}
                        </div>
                      </td>
                      <td className="py-2 text-right">{a.action_count}</td>
                      <td className="py-2 text-right">{formatTokens(a.total_tokens)}</td>
                      <td className="py-2 text-right font-mono">${a.total_cost.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t font-medium">
                    <td className="pt-2">Toplam</td>
                    <td className="pt-2 text-right">
                      {stats.agents.reduce((s, a) => s + a.action_count, 0)}
                    </td>
                    <td className="pt-2 text-right">
                      {formatTokens(stats.agents.reduce((s, a) => s + a.total_tokens, 0))}
                    </td>
                    <td className="pt-2 text-right font-mono">${stats.totalCost.toFixed(4)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
