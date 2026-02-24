"use client";

import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Calendar } from "lucide-react";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  type TaskPriority,
  type TaskDepartment,
} from "@/lib/constants";
import { updateTask, type TaskWithRelations } from "../actions";

interface OnaylarClientProps {
  tasks: TaskWithRelations[];
}

export function OnaylarClient({ tasks }: OnaylarClientProps) {
  const handleApprove = async (taskId: string) => {
    const result = await updateTask(taskId, { status: "done" });
    if (result.success) {
      toast.success("Görev onaylandı");
    } else {
      toast.error(result.error || "Onaylama başarısız");
    }
  };

  const handleReject = async (taskId: string) => {
    const result = await updateTask(taskId, { status: "in_progress" });
    if (result.success) {
      toast.success("Görev geri gönderildi");
    } else {
      toast.error(result.error || "İşlem başarısız");
    }
  };

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            Onay bekleyen görev yok
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => {
        const priorityColors = TASK_PRIORITY_COLORS[task.priority as TaskPriority];
        const deptColors = TASK_DEPARTMENT_COLORS[task.department as TaskDepartment];

        return (
          <Card key={task.id} className="border-l-4 border-l-purple-400">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium">{task.title}</h3>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityColors.bg} ${priorityColors.text}`}
                  >
                    {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
                  </span>
                  <span
                    className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${deptColors.bg} ${deptColors.text}`}
                  >
                    {TASK_DEPARTMENT_LABELS[task.department as TaskDepartment]}
                  </span>
                  {task.assignee_name && (
                    <span className="text-xs text-muted-foreground">
                      {task.assignee_name}
                    </span>
                  )}
                  {task.due_date && (
                    <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {new Date(task.due_date).toLocaleDateString("tr-TR", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleReject(task.id)}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Geri Gönder
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 text-white hover:bg-emerald-700"
                  onClick={() => handleApprove(task.id)}
                >
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  Onayla
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
