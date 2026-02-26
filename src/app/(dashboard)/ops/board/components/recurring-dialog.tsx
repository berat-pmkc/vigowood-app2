"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  RECURRING_FREQUENCIES,
} from "@/lib/constants";
import {
  createRecurringTask,
  updateRecurringTask,
} from "../../actions";
import type { RecurringTask, TaskTemplate } from "@/lib/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };

interface RecurringDialogProps {
  open: boolean;
  onClose: () => void;
  recurring?: RecurringTask | null;
  templates: TaskTemplate[];
  users: User[];
  agents: Agent[];
}

type FormValues = {
  title: string;
  description: string;
  department: string;
  priority: string;
  assignee_id: string;
  cron_schedule: string;
  custom_cron: string;
};

export function RecurringDialog({
  open,
  onClose,
  recurring,
  templates,
  users,
  agents,
}: RecurringDialogProps) {
  const isEdit = !!recurring;
  const [saving, setSaving] = useState(false);

  const isCustomCron = recurring?.cron_schedule
    ? !RECURRING_FREQUENCIES.some((f) => f.value === recurring.cron_schedule)
    : false;

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      title: recurring?.title ?? "",
      description: recurring?.description ?? "",
      department: recurring?.department ?? "genel",
      priority: recurring?.priority ?? "medium",
      assignee_id: recurring?.assignee_id ?? "",
      cron_schedule: isCustomCron ? "custom" : (recurring?.cron_schedule ?? "0 9 * * 1"),
      custom_cron: isCustomCron ? (recurring?.cron_schedule ?? "") : "",
    },
  });

  const cronSchedule = watch("cron_schedule");

  const fillFromTemplate = (templateId: string) => {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    setValue("title", t.title);
    setValue("description", t.description ?? "");
    setValue("department", t.department ?? "genel");
    setValue("priority", t.priority ?? "medium");
    setValue("assignee_id", t.assignee_id ?? "");
  };

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    try {
      const schedule = data.cron_schedule === "custom" ? data.custom_cron : data.cron_schedule;
      if (!schedule) {
        toast.error("Zamanlama gereklidir");
        setSaving(false);
        return;
      }

      const payload = {
        title: data.title,
        description: data.description || null,
        department: data.department as "genel",
        priority: data.priority as "medium",
        assignee_id: data.assignee_id || null,
        cron_schedule: schedule,
      };

      const result = isEdit
        ? await updateRecurringTask(recurring!.id, payload)
        : await createRecurringTask(payload);

      if (result.success) {
        toast.success(isEdit ? "Güncellendi" : "Tekrar eden görev oluşturuldu");
        onClose();
      } else {
        toast.error(result.error || "Bir hata oluştu");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Tekrar Eden Görev Düzenle" : "Yeni Tekrar Eden Görev"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Fill from template */}
          {!isEdit && templates.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground">Şablondan Doldur (Opsiyonel)</Label>
              <Select onValueChange={fillFromTemplate}>
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Şablon seç..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Başlık *</Label>
            <Input {...register("title", { required: true })} placeholder="Görev başlığı" />
          </div>

          <div>
            <Label>Açıklama</Label>
            <Textarea {...register("description")} placeholder="Açıklama" rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Departman</Label>
              <Select value={watch("department")} onValueChange={(v) => setValue("department", v)}>
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
            <div>
              <Label>Öncelik</Label>
              <Select value={watch("priority")} onValueChange={(v) => setValue("priority", v)}>
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
          </div>

          {/* Schedule */}
          <div>
            <Label>Zamanlama *</Label>
            <Select value={cronSchedule} onValueChange={(v) => setValue("cron_schedule", v)}>
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

          {/* Assignee */}
          <div>
            <Label>Atanan</Label>
            <Tabs defaultValue="calisanlar" className="mt-1">
              <TabsList className="h-8">
                <TabsTrigger value="calisanlar" className="text-xs">Çalışanlar</TabsTrigger>
                <TabsTrigger value="asistanlar" className="text-xs">Asistanlar</TabsTrigger>
              </TabsList>
              <TabsContent value="calisanlar" className="mt-1">
                <Select
                  value={watch("assignee_id") || "unassigned"}
                  onValueChange={(v) => setValue("assignee_id", v === "unassigned" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Çalışan seç" />
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
              <TabsContent value="asistanlar" className="mt-1">
                <Select
                  value={watch("assignee_id") || "unassigned"}
                  onValueChange={(v) => setValue("assignee_id", v === "unassigned" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Asistan seç" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Atanmamış</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              İptal
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-vw-primary text-vw-dark hover:bg-vw-deep hover:text-white"
            >
              {saving ? "Kaydediliyor..." : isEdit ? "Güncelle" : "Oluştur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
