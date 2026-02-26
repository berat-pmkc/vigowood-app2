"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, RefreshCw, Trash2, Edit, Pause, Play, History, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  RECURRING_FREQUENCIES,
  type TaskDepartment,
  type TaskPriority,
} from "@/lib/constants";
import {
  deleteRecurringTask,
  updateRecurringTask,
} from "../../actions";
import type { RecurringTask, TaskTemplate } from "@/lib/supabase/types";
import { RecurringDialog } from "./recurring-dialog";

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };

interface RecurringTabProps {
  recurringTasks: RecurringTask[];
  templates: TaskTemplate[];
  users: User[];
  agents: Agent[];
}

function getCronLabel(cron: string): string {
  const match = RECURRING_FREQUENCIES.find((f) => f.value === cron);
  if (match) return match.label;
  return cron;
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RecurringTab({ recurringTasks, templates, users, agents }: RecurringTabProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editRecurring, setEditRecurring] = useState<RecurringTask | null>(null);

  const handleToggle = async (id: string, currentActive: boolean) => {
    const result = await updateRecurringTask(id, { is_active: !currentActive });
    if (result.success) {
      toast.success(!currentActive ? "Aktif edildi" : "Duraklatıldı");
    } else {
      toast.error(result.error || "Güncellenemedi");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Bu tekrar eden görevi silmek istediğinize emin misiniz?")) return;
    const result = await deleteRecurringTask(id);
    if (result.success) {
      toast.success("Silindi");
    } else {
      toast.error(result.error || "Silinemedi");
    }
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {recurringTasks.length} tekrar eden görev ({recurringTasks.filter((r) => r.is_active).length} aktif)
        </p>
        <Button
          size="sm"
          onClick={() => { setEditRecurring(null); setShowDialog(true); }}
          className="bg-vw-primary text-vw-dark hover:bg-vw-deep hover:text-white"
        >
          <Plus className="mr-1 h-4 w-4" />
          Yeni Tekrar Eden
        </Button>
      </div>

      {recurringTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <RefreshCw className="mb-2 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Henüz tekrar eden görev yok</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recurringTasks.map((r) => {
            const deptColors = TASK_DEPARTMENT_COLORS[r.department as TaskDepartment];
            const prioColors = TASK_PRIORITY_COLORS[r.priority as TaskPriority];

            return (
              <div
                key={r.id}
                className={`rounded-lg border border-l-4 border-l-indigo-400 bg-indigo-50/40 p-4 shadow-sm transition-shadow hover:shadow-md ${
                  !r.is_active ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-sm leading-tight">{r.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {getCronLabel(r.cron_schedule)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={r.is_active ?? false}
                      onCheckedChange={() => handleToggle(r.id, r.is_active ?? false)}
                      className="scale-75"
                    />
                    <button
                      onClick={() => { setEditRecurring(r); setShowDialog(true); }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {r.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {r.description}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${deptColors.bg} ${deptColors.text}`}>
                    {TASK_DEPARTMENT_LABELS[r.department as TaskDepartment]}
                  </span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${prioColors.bg} ${prioColors.text}`}>
                    {TASK_PRIORITY_LABELS[r.priority as TaskPriority]}
                  </span>
                  {r.is_active ? (
                    <span className="inline-flex items-center gap-0.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                      <Play className="h-3 w-3" />
                      Aktif
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      <Pause className="h-3 w-3" />
                      Durduruldu
                    </span>
                  )}
                </div>

                <div className="mt-2 space-y-0.5 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <History className="h-3 w-3" />
                    <span>Toplam: {r.run_count ?? 0} çalışma</span>
                  </div>
                  {r.last_run_at && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Son: {formatDate(r.last_run_at)}</span>
                    </div>
                  )}
                  {r.next_run_at && (
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span>Sonraki: {formatDate(r.next_run_at)}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showDialog && (
        <RecurringDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setEditRecurring(null); }}
          recurring={editRecurring}
          templates={templates}
          users={users}
          agents={agents}
        />
      )}
    </>
  );
}
