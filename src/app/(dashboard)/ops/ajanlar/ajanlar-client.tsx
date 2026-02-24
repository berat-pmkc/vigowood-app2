"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Bot,
  Clock,
  CheckCircle2,
  Shield,
  FileOutput,
  Play,
  Pause,
  Power,
} from "lucide-react";
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

interface AjanlarClientProps {
  agents: OpsAgent[];
}

const CAPABILITY_LABELS: Record<string, string> = {
  stok_izleme: "Stok İzleme",
  kritik_stok_uyari: "Kritik Stok Uyarısı",
  stok_raporu: "Stok Raporu",
  yari_mamul_analiz: "Yarı Mamül Analizi",
  uretim_izleme: "Üretim İzleme",
  darbogaz_tespit: "Darboğaz Tespiti",
  verimlilik_raporu: "Verimlilik Raporu",
  kesim_optimizasyon: "Kesim Optimizasyonu",
  siparis_takip: "Sipariş Takibi",
  siparis_guncelle: "Sipariş Güncelleme",
  satis_raporu: "Satış Raporu",
  kampanya_analiz: "Kampanya Analizi",
  sevkiyat_planlama: "Sevkiyat Planlama",
  konteyner_optimizasyon: "Konteyner Optimizasyonu",
  lojistik_raporu: "Lojistik Raporu",
  teslimat_takip: "Teslimat Takibi",
  nakit_akis_izleme: "Nakit Akış İzleme",
  odeme_hatirlatma: "Ödeme Hatırlatması",
  finansal_rapor: "Finansal Rapor",
  karlilik_analiz: "Kârlılık Analizi",
  gorev_koordinasyon: "Görev Koordinasyonu",
  toplanti_ozet: "Toplantı Özeti",
  performans_raporu: "Performans Raporu",
  oncelik_analiz: "Öncelik Analizi",
};

export function AjanlarClient({ agents }: AjanlarClientProps) {
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedAgent, setSelectedAgent] = useState<OpsAgent | null>(null);

  const filtered = agents.filter((a) => {
    if (deptFilter !== "all" && a.department !== deptFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

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
          const statusColors =
            AGENT_STATUS_COLORS[agent.status as AgentStatus];
          const deptColors =
            TASK_DEPARTMENT_COLORS[agent.department as TaskDepartment] ??
            TASK_DEPARTMENT_COLORS.genel;

          return (
            <Card
              key={agent.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setSelectedAgent(agent)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-vw-primary/20 shrink-0">
                    <Bot className="h-6 w-6 text-vw-dark" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{agent.name}</h3>
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

                    {agent.description && (
                      <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                        {agent.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {agent.total_tasks_completed}
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        {agent.total_approvals_requested}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileOutput className="h-3 w-3" />
                        {agent.total_outputs_generated}
                      </span>
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
          {selectedAgent && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {selectedAgent.name}
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Status + Controls */}
                <div className="flex items-center gap-2">
                  <Badge
                    className={`${AGENT_STATUS_COLORS[selectedAgent.status as AgentStatus].bg} ${AGENT_STATUS_COLORS[selectedAgent.status as AgentStatus].text}`}
                  >
                    {AGENT_STATUS_LABELS[selectedAgent.status as AgentStatus]}
                  </Badge>
                  <Badge variant="outline">
                    {TASK_DEPARTMENT_LABELS[selectedAgent.department as TaskDepartment] ?? selectedAgent.department}
                  </Badge>
                  <Badge variant="outline">{selectedAgent.code}</Badge>
                </div>

                <div className="flex items-center gap-2">
                  {selectedAgent.status !== "active" && (
                    <Button
                      size="sm"
                      className="bg-emerald-600 text-white hover:bg-emerald-700"
                      onClick={() =>
                        handleToggleStatus(selectedAgent, "active")
                      }
                    >
                      <Play className="mr-1 h-3 w-3" />
                      Aktifleştir
                    </Button>
                  )}
                  {selectedAgent.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-amber-600"
                      onClick={() =>
                        handleToggleStatus(selectedAgent, "paused")
                      }
                    >
                      <Pause className="mr-1 h-3 w-3" />
                      Duraklat
                    </Button>
                  )}
                  {selectedAgent.status !== "disabled" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600"
                      onClick={() =>
                        handleToggleStatus(selectedAgent, "disabled")
                      }
                    >
                      <Power className="mr-1 h-3 w-3" />
                      Devre Dışı
                    </Button>
                  )}
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

                {/* Stats */}
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
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
