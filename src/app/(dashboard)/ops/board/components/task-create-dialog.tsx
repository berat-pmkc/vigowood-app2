"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, Users, RefreshCw } from "lucide-react";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  RECURRING_FREQUENCIES,
  type TaskPriority,
  type TaskDepartment,
} from "@/lib/constants";
import { createTask, createRecurringTask } from "../../actions";
import { cn } from "@/lib/utils";

type FormValues = {
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  department: string;
  due_date: string | null;
  parent_id: string | null;
  source_type: string;
  // Recurring fields
  cron_schedule: string;
  custom_cron: string;
};

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };

type TaskMode = "single" | "recurring";

interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  users: User[];
  agents?: Agent[];
  parentId?: string;
}

export function TaskCreateDialog({
  open,
  onClose,
  users,
  agents = [],
  parentId,
}: TaskCreateDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [taskMode, setTaskMode] = useState<TaskMode>("single");

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      title: "",
      description: null,
      status: "queue",
      priority: "medium",
      assigned_to: null,
      department: "genel",
      due_date: null,
      parent_id: parentId ?? null,
      source_type: "manual",
      cron_schedule: "0 9 * * 1",
      custom_cron: "",
    },
  });

  const cronSchedule = watch("cron_schedule");

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);

    if (taskMode === "recurring") {
      const schedule = data.cron_schedule === "custom" ? data.custom_cron : data.cron_schedule;
      if (!schedule) {
        toast.error("Zamanlama gereklidir");
        setSubmitting(false);
        return;
      }
      const result = await createRecurringTask({
        title: data.title,
        description: data.description,
        department: data.department as TaskDepartment,
        priority: data.priority as TaskPriority,
        assignee_id: data.assigned_to,
        cron_schedule: schedule,
      });
      setSubmitting(false);
      if (result.success) {
        toast.success("Tekrar eden görev oluşturuldu");
        reset();
        setTaskMode("single");
        onClose();
      } else {
        toast.error(result.error || "Oluşturulamadı");
      }
    } else {
      const result = await createTask({
        title: data.title,
        description: data.description,
        priority: data.priority as TaskPriority,
        department: data.department as TaskDepartment,
        assigned_to: data.assigned_to,
        due_date: data.due_date,
        parent_id: parentId ?? data.parent_id ?? null,
      });
      setSubmitting(false);
      if (result.success) {
        toast.success("Görev oluşturuldu");
        reset();
        onClose();
      } else {
        toast.error(result.error || "Görev oluşturulamadı");
      }
    }
  };

  const currentAssignee = watch("assigned_to");

  const handleClose = () => {
    setTaskMode("single");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {taskMode === "recurring" ? "Yeni Tekrar Eden Görev" : "Yeni Görev Oluştur"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Task Mode Toggle */}
          {!parentId && (
            <div className="flex rounded-md border">
              <button
                type="button"
                onClick={() => setTaskMode("single")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-l-md px-3 py-1.5 text-sm font-medium transition-colors",
                  taskMode === "single"
                    ? "bg-vw-primary text-vw-dark"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                Tek Seferlik
              </button>
              <button
                type="button"
                onClick={() => setTaskMode("recurring")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-r-md border-l px-3 py-1.5 text-sm font-medium transition-colors",
                  taskMode === "recurring"
                    ? "bg-vw-primary text-vw-dark"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Tekrar Eden
              </button>
            </div>
          )}

          {/* Title */}
          <div>
            <Label htmlFor="title">Başlık *</Label>
            <Input
              id="title"
              {...register("title")}
              placeholder="Görev başlığı"
              autoFocus
            />
            {errors.title && (
              <p className="mt-1 text-xs text-destructive">
                {errors.title.message}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Görev açıklaması (isteğe bağlı)"
              rows={3}
            />
          </div>

          {/* Row: Priority + Department */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Öncelik</Label>
              <Select
                value={watch("priority")}
                onValueChange={(v) => setValue("priority", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TASK_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Departman</Label>
              <Select
                value={watch("department")}
                onValueChange={(v) => setValue("department", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>
                      {TASK_DEPARTMENT_LABELS[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Schedule (only for recurring) */}
          {taskMode === "recurring" && (
            <div>
              <Label>Zamanlama *</Label>
              <Select
                value={cronSchedule}
                onValueChange={(v) => setValue("cron_schedule", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {cronSchedule === "custom" && (
                <Input
                  className="mt-2"
                  {...register("custom_cron")}
                  placeholder="0 9 * * 1-5 (Cron ifadesi)"
                />
              )}
            </div>
          )}

          {/* Assignee with Tabs (Çalışanlar / Ajanlar) */}
          <div>
            <Label>Atanan Kişi</Label>
            <Tabs defaultValue="users" className="mt-1">
              <TabsList className="h-7">
                <TabsTrigger value="users" className="text-xs h-6 px-2">
                  <Users className="mr-1 h-3 w-3" />
                  Çalışanlar
                </TabsTrigger>
                {agents.length > 0 && (
                  <TabsTrigger value="agents" className="text-xs h-6 px-2">
                    <Bot className="mr-1 h-3 w-3" />
                    Ajanlar
                  </TabsTrigger>
                )}
              </TabsList>
              <TabsContent value="users" className="mt-1">
                <Select
                  value={currentAssignee ?? "unassigned"}
                  onValueChange={(v) =>
                    setValue("assigned_to", v === "unassigned" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seçiniz" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Atanmamış</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              {agents.length > 0 && (
                <TabsContent value="agents" className="mt-1">
                  <Select
                    value={currentAssignee ?? "unassigned"}
                    onValueChange={(v) =>
                      setValue("assigned_to", v === "unassigned" ? null : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Ajan seçiniz" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Atanmamış</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} ({a.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TabsContent>
              )}
            </Tabs>
          </div>

          {/* Due Date (only for single) */}
          {taskMode === "single" && (
            <div>
              <Label>Bitiş Tarihi</Label>
              <Input
                type="date"
                value={watch("due_date") ?? ""}
                onChange={(e) =>
                  setValue("due_date", e.target.value || null)
                }
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-vw-primary text-vw-dark hover:bg-vw-deep hover:text-white"
            >
              {submitting
                ? "Oluşturuluyor..."
                : taskMode === "recurring"
                  ? "Tekrar Eden Oluştur"
                  : "Oluştur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
