"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, Bot, Activity, Zap, Hash } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  type TaskDepartment,
} from "@/lib/constants";
import type { OpsAgent } from "../../actions";

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
  agents: OpsAgent[];
  currentPeriod: string;
}

const PERIODS = [
  { value: "day", label: "Günlük" },
  { value: "week", label: "Haftalık" },
  { value: "month", label: "Aylık" },
] as const;

const DEPT_BORDER_COLORS: Record<string, string> = {
  uretim: "#6366f1",
  stok: "#14b8a6",
  sevkiyat: "#06b6d4",
  muhasebe: "#ec4899",
  pazaryeri: "#8b5cf6",
  genel: "#6b7280",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function KullanimClient({ stats, agents, currentPeriod }: KullanimClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setPeriod = (p: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("period", p);
    router.push(`${pathname}?${params.toString()}`);
  };

  const totalActions = stats.actions.length;
  const mostActiveAgent = stats.agents.length > 0
    ? stats.agents.reduce((a, b) => (a.action_count > b.action_count ? a : b))
    : null;

  // Match usage stats with agent profiles
  const agentMap = new Map(agents.map((a) => [a.name, a]));

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
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
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
              {totalActions} işlem
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Toplam İşlem
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.agents.length} asistan
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              En Aktif Asistan
            </CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold truncate">
              {mostActiveAgent?.agent_name ?? "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              {mostActiveAgent ? `${mostActiveAgent.action_count} işlem` : "Henüz işlem yok"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards Grid */}
      <div>
        <h2 className="text-base font-semibold text-vw-dark mb-4">
          Asistan Bazlı Kullanım
        </h2>

        {stats.agents.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Bu dönemde asistan aktivitesi yok
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {stats.agents.map((agentStat) => {
              const agentProfile = agentMap.get(agentStat.agent_name);
              const dept = (agentProfile?.department ?? "genel") as TaskDepartment;
              const deptLabel = TASK_DEPARTMENT_LABELS[dept] ?? dept;
              const deptColors = TASK_DEPARTMENT_COLORS[dept] ?? TASK_DEPARTMENT_COLORS.genel;
              const borderColor = DEPT_BORDER_COLORS[dept] ?? DEPT_BORDER_COLORS.genel;
              const costPct = stats.totalCost > 0
                ? (agentStat.total_cost / stats.totalCost) * 100
                : 0;

              return (
                <Card
                  key={agentStat.agent_id}
                  className="border-l-4 transition-shadow hover:shadow-md"
                  style={{ borderLeftColor: borderColor }}
                >
                  <CardContent className="pt-5 pb-4 px-5">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${borderColor}18` }}
                        >
                          <Bot className="h-4 w-4" style={{ color: borderColor }} />
                        </div>
                        <span className="font-semibold text-sm text-vw-dark truncate">
                          {agentStat.agent_name}
                        </span>
                      </div>
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0 shrink-0",
                          deptColors.bg,
                          deptColors.text
                        )}
                      >
                        {deptLabel}
                      </Badge>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div className="rounded-md bg-muted/50 py-2 px-1">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                          <Zap className="h-3 w-3" />
                          <span className="text-[10px]">Token</span>
                        </div>
                        <span className="text-sm font-bold text-vw-dark">
                          {formatTokens(agentStat.total_tokens)}
                        </span>
                      </div>
                      <div className="rounded-md bg-muted/50 py-2 px-1">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                          <DollarSign className="h-3 w-3" />
                          <span className="text-[10px]">Maliyet</span>
                        </div>
                        <span className="text-sm font-bold text-vw-dark">
                          ${agentStat.total_cost.toFixed(4)}
                        </span>
                      </div>
                      <div className="rounded-md bg-muted/50 py-2 px-1">
                        <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                          <Hash className="h-3 w-3" />
                          <span className="text-[10px]">İşlem</span>
                        </div>
                        <span className="text-sm font-bold text-vw-dark">
                          {agentStat.action_count}
                        </span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span>Maliyet payı</span>
                        <span>%{costPct.toFixed(1)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.max(costPct, 2)}%`,
                            backgroundColor: borderColor,
                          }}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Totals summary */}
      {stats.agents.length > 0 && (
        <Card className="bg-muted/30">
          <CardContent className="py-3 px-5">
            <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
              <span className="text-muted-foreground">
                <strong className="text-vw-dark">{stats.agents.length}</strong> asistan toplam
              </span>
              <div className="flex items-center gap-6">
                <span className="text-muted-foreground">
                  Token: <strong className="text-vw-dark">
                    {formatTokens(stats.agents.reduce((s, a) => s + a.total_tokens, 0))}
                  </strong>
                </span>
                <span className="text-muted-foreground">
                  İşlem: <strong className="text-vw-dark">
                    {stats.agents.reduce((s, a) => s + a.action_count, 0)}
                  </strong>
                </span>
                <span className="text-muted-foreground">
                  Toplam: <strong className="text-vw-dark font-mono">
                    ${stats.totalCost.toFixed(4)}
                  </strong>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
