"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bot,
  Clock,
  CheckCircle2,
  FileOutput,
  DollarSign,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  AGENT_STATUSES,
  AGENT_STATUS_LABELS,
  AGENT_STATUS_COLORS,
  type TaskDepartment,
  type AgentStatus,
} from "@/lib/constants";
import { updateAgent, type OpsAgent } from "../actions";

type AgentStat = {
  agent_id: string;
  agent_name: string;
  total_tokens: number;
  total_cost: number;
  action_count: number;
};

interface AjanlarClientProps {
  agents: OpsAgent[];
  usageStats: {
    totalCost: number;
    agents: AgentStat[];
    actions: Array<Record<string, unknown>>;
  };
}

const CAPABILITY_LABELS: Record<string, string> = {
  stok_izleme: "Stok İzleme",
  kritik_stok_uyari: "Kritik Stok Uyarısı",
  yeniden_siparis_onerisi: "Yeniden Sipariş Önerisi",
  stok_raporu: "Stok Raporu",
  yari_mamul_analiz: "Yarı Mamül Analizi",
  uretim_izleme: "Üretim İzleme",
  darbogaz_tespit: "Darboğaz Tespiti",
  verimlilik_raporu: "Verimlilik Raporu",
  kesim_optimizasyon: "Kesim Optimizasyonu",
  montaj_analiz: "Montaj Analizi",
  siparis_takip: "Sipariş Takibi",
  siparis_guncelle: "Sipariş Güncelleme",
  satis_raporu: "Satış Raporu",
  kampanya_analiz: "Kampanya Analizi",
  kampanya_takip: "Kampanya Takibi",
  musteri_analizi: "Müşteri Analizi",
  ikas_siparis_analizi: "İkas Sipariş Analizi",
  gunluk_satis_raporu: "Günlük Satış Raporu",
  pazaryeri_performans: "Pazaryeri Performans",
  sevkiyat_planlama: "Sevkiyat Planlama",
  sevkiyat_takip: "Sevkiyat Takibi",
  teslimat_raporu: "Teslimat Raporu",
  konteyner_optimizasyon: "Konteyner Optimizasyonu",
  lojistik_raporu: "Lojistik Raporu",
  lojistik_analiz: "Lojistik Analizi",
  maliyet_takip: "Maliyet Takibi",
  teslimat_takip: "Teslimat Takibi",
  nakit_akis_izleme: "Nakit Akış İzleme",
  nakit_akis_analizi: "Nakit Akış Analizi",
  odeme_hatirlatma: "Ödeme Hatırlatması",
  finansal_rapor: "Finansal Rapor",
  finansal_ozet: "Finansal Özet",
  karlilik_analiz: "Kârlılık Analizi",
  karlilik_raporu: "Kârlılık Raporu",
  borc_takip: "Borç Takibi",
  gorev_koordinasyon: "Görev Koordinasyonu",
  gorev_atama: "Görev Atama",
  rapor_toplama: "Rapor Toplama",
  gunluk_brief: "Günlük Brief",
  koordinasyon: "Koordinasyon",
  onceliklendirme: "Önceliklendirme",
  performans_ozet: "Performans Özeti",
  toplanti_ozet: "Toplantı Özeti",
  performans_raporu: "Performans Raporu",
  oncelik_analiz: "Öncelik Analizi",
};

const DEPT_BORDER_COLORS: Record<string, string> = {
  uretim: "#6366f1",
  stok: "#14b8a6",
  sevkiyat: "#06b6d4",
  muhasebe: "#ec4899",
  pazaryeri: "#8b5cf6",
  genel: "#6b7280",
};

const STATUS_SEGMENT_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-800 shadow-sm",
  paused: "bg-amber-100 text-amber-800 shadow-sm",
  disabled: "bg-red-100 text-red-800 shadow-sm",
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function AjanlarClient({ agents, usageStats }: AjanlarClientProps) {
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<OpsAgent | null>(null);

  const filtered = agents.filter((a) => {
    if (deptFilter !== "all" && a.department !== deptFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  // Usage stats map by agent name
  const usageMap = new Map(usageStats.agents.map((a) => [a.agent_name, a]));

  const handleToggleStatus = async (agent: OpsAgent, newStatus: AgentStatus) => {
    const result = await updateAgent(agent.id, { status: newStatus });
    if (result.success) {
      toast.success(
        `${agent.name} ${AGENT_STATUS_LABELS[newStatus].toLowerCase()} durumuna alındı`
      );
    } else {
      toast.error(result.error || "Durum güncellenemedi");
    }
  };

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("tr-TR", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-sm font-normal">
          {agents.filter((a) => a.status === "active").length} aktif ajan
        </Badge>

        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Departman" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Departmanlar</SelectItem>
            {TASK_DEPARTMENTS.map((d) => (
              <SelectItem key={d} value={d}>
                {TASK_DEPARTMENT_LABELS[d]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {AGENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {AGENT_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Agent Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((agent) => {
          const statusColors = AGENT_STATUS_COLORS[agent.status as AgentStatus];
          const deptColors =
            TASK_DEPARTMENT_COLORS[agent.department as TaskDepartment] ??
            TASK_DEPARTMENT_COLORS.genel;
          const borderColor = DEPT_BORDER_COLORS[agent.department] ?? DEPT_BORDER_COLORS.genel;
          const agentUsage = usageMap.get(agent.name);

          return (
            <Card
              key={agent.id}
              className="cursor-pointer transition-shadow hover:shadow-md border-l-4"
              style={{ borderLeftColor: borderColor }}
              onClick={() => setSelectedAgent(agent)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
                    style={{ backgroundColor: `${borderColor}18` }}
                  >
                    <Bot className="h-5 w-5" style={{ color: borderColor }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{agent.name}</h3>
                      <span
                        className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${statusColors.bg} ${statusColors.text}`}
                      >
                        {AGENT_STATUS_LABELS[agent.status as AgentStatus]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-1">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${deptColors.bg} ${deptColors.text}`}
                      >
                        {TASK_DEPARTMENT_LABELS[agent.department as TaskDepartment] ?? agent.department}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {agent.code}
                      </span>
                    </div>

                    {/* Capability preview (top 3 + "+N") */}
                    {agent.capabilities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {agent.capabilities.slice(0, 3).map((cap) => (
                          <Badge
                            key={cap}
                            variant="secondary"
                            className="text-[9px] px-1.5 py-0 h-4"
                          >
                            {CAPABILITY_LABELS[cap] ?? cap}
                          </Badge>
                        ))}
                        {agent.capabilities.length > 3 && (
                          <Badge
                            variant="outline"
                            className="text-[9px] px-1.5 py-0 h-4"
                          >
                            +{agent.capabilities.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Stats + Usage */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1" title="Tamamlanan görev">
                        <CheckCircle2 className="h-3 w-3" />
                        {agent.total_tasks_completed}
                      </span>
                      <span className="flex items-center gap-1" title="Çıktılar">
                        <FileOutput className="h-3 w-3" />
                        {agent.total_outputs_generated}
                      </span>
                      {agentUsage && (
                        <>
                          <span className="flex items-center gap-1" title="Aylık maliyet">
                            <DollarSign className="h-3 w-3" />
                            {agentUsage.total_cost.toFixed(4)}
                          </span>
                          <span className="flex items-center gap-1" title="Aylık token">
                            <Zap className="h-3 w-3" />
                            {formatTokens(agentUsage.total_tokens)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Agent Detail Sheet */}
      <Sheet
        open={!!selectedAgent}
        onOpenChange={(o) => !o && setSelectedAgent(null)}
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {selectedAgent && (() => {
            const agentUsage = usageMap.get(selectedAgent.name);
            const borderColor = DEPT_BORDER_COLORS[selectedAgent.department] ?? DEPT_BORDER_COLORS.genel;

            return (
              <>
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <div
                      className="flex h-8 w-8 items-center justify-center rounded-full shrink-0"
                      style={{ backgroundColor: `${borderColor}18` }}
                    >
                      <Bot className="h-4 w-4" style={{ color: borderColor }} />
                    </div>
                    {selectedAgent.name}
                  </SheetTitle>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {/* Status + Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={`${AGENT_STATUS_COLORS[selectedAgent.status as AgentStatus].bg} ${AGENT_STATUS_COLORS[selectedAgent.status as AgentStatus].text}`}
                    >
                      {AGENT_STATUS_LABELS[selectedAgent.status as AgentStatus]}
                    </Badge>
                    <Badge variant="outline">
                      {TASK_DEPARTMENT_LABELS[selectedAgent.department as TaskDepartment] ?? selectedAgent.department}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px]">{selectedAgent.code}</Badge>
                  </div>

                  {/* Segmented Status Control */}
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Durum Değiştir</p>
                    <div className="flex gap-1 rounded-lg bg-muted p-1">
                      {AGENT_STATUSES.map((s) => (
                        <button
                          key={s}
                          onClick={() => handleToggleStatus(selectedAgent, s as AgentStatus)}
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors flex-1",
                            selectedAgent.status === s
                              ? STATUS_SEGMENT_COLORS[s]
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {AGENT_STATUS_LABELS[s as AgentStatus]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  {selectedAgent.description && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Açıklama</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {selectedAgent.description}
                        </p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Capabilities */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Yetenekler</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedAgent.capabilities.map((cap) => (
                          <Badge key={cap} variant="outline" className="text-xs">
                            {CAPABILITY_LABELS[cap] ?? cap}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Schedule */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Çalışma Planı</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1 text-sm">
                      {selectedAgent.schedule.description && (
                        <p className="text-muted-foreground">
                          {selectedAgent.schedule.description}
                        </p>
                      )}
                      {selectedAgent.schedule.cron && (
                        <p className="font-mono text-xs text-muted-foreground">
                          Cron: {selectedAgent.schedule.cron}
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Stats + Usage */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">İstatistikler</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-2xl font-bold">
                            {selectedAgent.total_tasks_completed}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Görev
                          </p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {selectedAgent.total_approvals_requested}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Onay Talebi
                          </p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold">
                            {selectedAgent.total_outputs_generated}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Çıktı
                          </p>
                        </div>
                      </div>

                      {/* Monthly usage from usage stats */}
                      {agentUsage && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-xs text-muted-foreground mb-2">Aylık Kullanım</p>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="rounded-md bg-muted/50 py-2">
                              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                                <Zap className="h-3 w-3" />
                              </div>
                              <span className="text-sm font-bold text-vw-dark">
                                {formatTokens(agentUsage.total_tokens)}
                              </span>
                              <p className="text-[10px] text-muted-foreground">Token</p>
                            </div>
                            <div className="rounded-md bg-muted/50 py-2">
                              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                                <DollarSign className="h-3 w-3" />
                              </div>
                              <span className="text-sm font-bold text-vw-dark">
                                ${agentUsage.total_cost.toFixed(4)}
                              </span>
                              <p className="text-[10px] text-muted-foreground">Maliyet</p>
                            </div>
                            <div className="rounded-md bg-muted/50 py-2">
                              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                                <CheckCircle2 className="h-3 w-3" />
                              </div>
                              <span className="text-sm font-bold text-vw-dark">
                                {agentUsage.action_count}
                              </span>
                              <p className="text-[10px] text-muted-foreground">İşlem</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Meta */}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Son aktivite: {formatDate(selectedAgent.last_active_at)}
                    </p>
                    <p>
                      Oluşturulma: {formatDate(selectedAgent.created_at)}
                    </p>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}
