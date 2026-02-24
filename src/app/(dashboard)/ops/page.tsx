import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ListChecks,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Bot,
  FileOutput,
  Shield,
} from "lucide-react";
import { getOpsStats, getRecentActivity } from "./actions";
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_DEPARTMENT_LABELS,
  TASK_ACTIVITY_LABELS,
  APPROVAL_ACTION_TYPE_LABELS,
  APPROVAL_RISK_LEVEL_LABELS,
  APPROVAL_RISK_LEVEL_COLORS,
  type TaskPriority,
  type TaskDepartment,
  type TaskActivityAction,
  type ApprovalActionType,
  type ApprovalRiskLevel,
} from "@/lib/constants";

export default async function OpsOverviewPage() {
  const [stats, recentActivity] = await Promise.all([
    getOpsStats(),
    getRecentActivity(20),
  ]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Ops Center</h1>
        <p className="text-sm text-muted-foreground">
          Görev yönetimi genel bakış
        </p>
      </div>

      {/* KPI Cards — Row 1: Tasks */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
              <ListChecks className="h-5 w-5 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Açık Görevler</p>
              <p className="text-2xl font-bold">{stats.openCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
              <Clock className="h-5 w-5 text-amber-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bugün Deadline</p>
              <p className="text-2xl font-bold">{stats.dueTodayCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100">
              <ShieldCheck className="h-5 w-5 text-purple-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Onay Bekleyen</p>
              <p className="text-2xl font-bold">
                {stats.waitingApprovalCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100">
              <AlertTriangle className="h-5 w-5 text-red-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bloke</p>
              <p className="text-2xl font-bold">{stats.blockedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Cards — Row 2: V2 (Approvals, Agents, Outputs) */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
              <Shield className="h-5 w-5 text-orange-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bekleyen Onay Talebi</p>
              <p className="text-2xl font-bold">{stats.pendingApprovalsCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100">
              <Bot className="h-5 w-5 text-emerald-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Aktif Ajanlar</p>
              <p className="text-2xl font-bold">{stats.activeAgentsCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-100">
              <FileOutput className="h-5 w-5 text-cyan-700" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Bugün Çıktılar</p>
              <p className="text-2xl font-bold">{stats.recentOutputsCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Overdue Tasks */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              Geciken Görevler
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Geciken görev yok
              </p>
            ) : (
              <div className="space-y-2">
                {stats.overdueTasks.map((t) => {
                  const task = t as { id: string; title: string; assigned_to: string | null; due_date: string; priority: string; department: string; assignee_name?: string | null };
                  return (
                    <div
                      key={task.id}
                      className="flex items-center justify-between rounded-lg border border-red-100 bg-red-50/50 p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{task.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {task.assignee_name && (
                            <span className="text-xs text-muted-foreground">
                              {task.assignee_name}
                            </span>
                          )}
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                          >
                            {TASK_DEPARTMENT_LABELS[task.department as TaskDepartment]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-red-600">
                        <Calendar className="h-3 w-3" />
                        {new Date(task.due_date).toLocaleDateString("tr-TR", {
                          day: "numeric",
                          month: "short",
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pending Approvals */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Shield className="h-4 w-4 text-orange-500" />
              Bekleyen Onay Talepleri
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.pendingApprovals.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bekleyen onay talebi yok
              </p>
            ) : (
              <div className="space-y-2">
                {stats.pendingApprovals.map((a) => {
                  const riskColors = APPROVAL_RISK_LEVEL_COLORS[a.risk_level as ApprovalRiskLevel];
                  return (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border border-orange-100 bg-orange-50/50 p-3"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium">{a.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px]">
                            {APPROVAL_ACTION_TYPE_LABELS[a.action_type as ApprovalActionType]}
                          </Badge>
                          <span
                            className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${riskColors.bg} ${riskColors.text}`}
                          >
                            {APPROVAL_RISK_LEVEL_LABELS[a.risk_level as ApprovalRiskLevel]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {formatDate(a.requested_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today Completed */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              Bugün Tamamlanan
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats.todayDoneTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Bugün tamamlanan görev yok
              </p>
            ) : (
              <div className="space-y-2">
                {stats.todayDoneTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    <p className="text-sm">{t.title}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Son Aktiviteler</CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Henüz aktivite yok
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-start gap-3 text-sm">
                    <div className="mt-1.5 h-2 w-2 rounded-full bg-vw-primary shrink-0" />
                    <div className="flex-1">
                      <p>
                        <span className="font-medium">{a.actor_name}</span>{" "}
                        <span className="text-muted-foreground">
                          {TASK_ACTIVITY_LABELS[a.action as TaskActivityAction] ?? a.action}
                        </span>
                        {a.old_value && a.new_value && (
                          <span className="text-muted-foreground">
                            {" "}({a.old_value} &rarr; {a.new_value})
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {String((a as Record<string, unknown>).task_title ?? "")} &middot; {formatDate(a.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
