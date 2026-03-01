"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bot,
  ArrowLeft,
  CheckCircle2,
  Shield,
  FileOutput,
  Clock,
} from "lucide-react";
import {
  TASK_DEPARTMENT_LABELS,
  AGENT_STATUS_LABELS,
  AGENT_STATUS_COLORS,
  type TaskDepartment,
  type AgentStatus,
} from "@/lib/constants";
import type { OpsAgent } from "../../../actions";
import { MemoryPanel } from "./memory-panel";
import { PerformancePanel } from "./performance-panel";
import { FeedbackPanel } from "./feedback-panel";
import { CostPanel } from "./cost-panel";
import { TasksPanel } from "./tasks-panel";
import { RulesPanel } from "./rules-panel";

const DEPT_BORDER_COLORS: Record<string, string> = {
  uretim: "#6366f1",
  stok: "#14b8a6",
  sevkiyat: "#06b6d4",
  muhasebe: "#ec4899",
  pazaryeri: "#8b5cf6",
  genel: "#6b7280",
};

interface AgentDetailClientProps {
  agent: OpsAgent;
}

export function AgentDetailClient({ agent }: AgentDetailClientProps) {
  const [activeTab, setActiveTab] = useState("hafiza");
  const borderColor = DEPT_BORDER_COLORS[agent.department] ?? DEPT_BORDER_COLORS.genel;
  const statusColors = AGENT_STATUS_COLORS[agent.status as AgentStatus];

  const formatDate = (d: string | null) =>
    d
      ? new Date(d).toLocaleDateString("tr-TR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  return (
    <div className="space-y-4">
      {/* Back button */}
      <div>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/ops/ajanlar" className="flex items-center gap-1.5">
            <ArrowLeft className="h-4 w-4" />
            Ajanlar
          </Link>
        </Button>
      </div>

      {/* Agent Info Card */}
      <Card className="border-l-4" style={{ borderLeftColor: borderColor }}>
        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Avatar */}
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full shrink-0"
              style={{ backgroundColor: `${borderColor}18` }}
            >
              <Bot className="h-7 w-7" style={{ color: borderColor }} />
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-vw-dark">{agent.name}</h1>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors.bg} ${statusColors.text}`}
                >
                  {AGENT_STATUS_LABELS[agent.status as AgentStatus]}
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  {TASK_DEPARTMENT_LABELS[agent.department as TaskDepartment] ?? agent.department}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {agent.code}
                </Badge>
              </div>

              {agent.description && (
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {agent.description}
                </p>
              )}
            </div>

            {/* Quick Stats */}
            <div className="flex gap-4 shrink-0 text-center">
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <p className="text-lg font-bold text-vw-dark">{agent.total_tasks_completed}</p>
                <p className="text-[10px] text-muted-foreground">Görev</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <p className="text-lg font-bold text-vw-dark">{agent.total_approvals_requested}</p>
                <p className="text-[10px] text-muted-foreground">Onay</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <FileOutput className="h-3.5 w-3.5" />
                </div>
                <p className="text-lg font-bold text-vw-dark">{agent.total_outputs_generated}</p>
                <p className="text-[10px] text-muted-foreground">Çıktı</p>
              </div>
              <div>
                <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <p className="text-xs font-medium text-vw-dark">
                  {formatDate(agent.last_active_at)}
                </p>
                <p className="text-[10px] text-muted-foreground">Son Aktivite</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="hafiza">Hafıza</TabsTrigger>
            <TabsTrigger value="performans">Performans</TabsTrigger>
            <TabsTrigger value="geribildirim">Geri Bildirim</TabsTrigger>
            <TabsTrigger value="maliyet">Maliyet</TabsTrigger>
            <TabsTrigger value="gorevler">Görevler</TabsTrigger>
            <TabsTrigger value="kurallar">Kurallar</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="hafiza">
          {activeTab === "hafiza" && <MemoryPanel agentCode={agent.code} />}
        </TabsContent>
        <TabsContent value="performans">
          {activeTab === "performans" && <PerformancePanel agentCode={agent.code} />}
        </TabsContent>
        <TabsContent value="geribildirim">
          {activeTab === "geribildirim" && <FeedbackPanel />}
        </TabsContent>
        <TabsContent value="maliyet">
          {activeTab === "maliyet" && <CostPanel agentCode={agent.code} />}
        </TabsContent>
        <TabsContent value="gorevler">
          {activeTab === "gorevler" && <TasksPanel agentCode={agent.code} />}
        </TabsContent>
        <TabsContent value="kurallar">
          {activeTab === "kurallar" && <RulesPanel agent={agent} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
