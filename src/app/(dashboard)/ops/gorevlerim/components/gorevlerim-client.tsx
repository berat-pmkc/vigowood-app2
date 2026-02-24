"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ListChecks,
  Paperclip,
  MessageSquare,
  ArrowUpDown,
} from "lucide-react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  type TaskStatus,
  type TaskPriority,
  type TaskDepartment,
} from "@/lib/constants";
import type { TaskWithRelations } from "../../actions";

interface GorevlerimClientProps {
  tasks: TaskWithRelations[];
}

export function GorevlerimClient({ tasks }: GorevlerimClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || !value) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
    });

  const isOverdue = (d: string | null) =>
    d && new Date(d) < new Date(new Date().toDateString());

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={searchParams.get("department") || "all"}
          onValueChange={(v) => updateParam("department", v)}
        >
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

        <Select
          value={searchParams.get("priority") || "all"}
          onValueChange={(v) => updateParam("priority", v)}
        >
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="Öncelik" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Öncelikler</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {TASK_PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("status") || "all"}
          onValueChange={(v) => updateParam("status", v)}
        >
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Aktif (done hariç)</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("sort") || "due_date"}
          onValueChange={(v) => updateParam("sort", v)}
        >
          <SelectTrigger className="h-8 w-[130px]">
            <ArrowUpDown className="mr-1 h-3 w-3" />
            <SelectValue placeholder="Sırala" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="due_date">Bitiş Tarihi</SelectItem>
            <SelectItem value="priority">Öncelik</SelectItem>
            <SelectItem value="created_at">Oluşturma</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Görüntülenecek görev yok
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => {
            const priorityColors =
              TASK_PRIORITY_COLORS[task.priority as TaskPriority];
            const statusColors =
              TASK_STATUS_COLORS[task.status as TaskStatus];
            const deptColors =
              TASK_DEPARTMENT_COLORS[task.department as TaskDepartment];
            const overdue = isOverdue(task.due_date);

            return (
              <Card
                key={task.id}
                className={`cursor-pointer transition-shadow hover:shadow-md ${
                  overdue ? "border-l-4 border-l-red-400" : ""
                }`}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Priority indicator */}
                  <div
                    className={`h-8 w-1 rounded-full ${
                      task.priority === "urgent"
                        ? "bg-red-500"
                        : task.priority === "high"
                        ? "bg-orange-500"
                        : task.priority === "medium"
                        ? "bg-blue-500"
                        : "bg-slate-300"
                    }`}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">
                      {task.title}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColors.bg} ${statusColors.text}`}
                      >
                        {TASK_STATUS_LABELS[task.status as TaskStatus]}
                      </span>
                      <span
                        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${deptColors.bg} ${deptColors.text}`}
                      >
                        {TASK_DEPARTMENT_LABELS[task.department as TaskDepartment]}
                      </span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    {task.due_date && (
                      <span
                        className={`flex items-center gap-1 ${
                          overdue ? "font-medium text-red-600" : ""
                        }`}
                      >
                        <Calendar className="h-3 w-3" />
                        {formatDate(task.due_date)}
                      </span>
                    )}
                    {(task.subtask_count ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <ListChecks className="h-3 w-3" />
                        {task.subtask_done_count ?? 0}/{task.subtask_count ?? 0}
                      </span>
                    )}
                    {(task.comment_count ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <MessageSquare className="h-3 w-3" />
                        {task.comment_count ?? 0}
                      </span>
                    )}
                    {(task.attachment_count ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Paperclip className="h-3 w-3" />
                        {task.attachment_count ?? 0}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
