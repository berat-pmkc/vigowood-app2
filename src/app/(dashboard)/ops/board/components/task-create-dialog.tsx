"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  type TaskPriority,
  type TaskDepartment,
} from "@/lib/constants";
import { taskCreateSchema } from "@/lib/validations";
import { createTask } from "../../actions";

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
};

type User = { user_id: string; full_name: string; role: string };

interface TaskCreateDialogProps {
  open: boolean;
  onClose: () => void;
  users: User[];
  parentId?: string;
}

export function TaskCreateDialog({
  open,
  onClose,
  users,
  parentId,
}: TaskCreateDialogProps) {
  const [submitting, setSubmitting] = useState(false);

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
      status: "open",
      priority: "medium",
      assigned_to: null,
      department: "genel",
      due_date: null,
      parent_id: parentId ?? null,
      source_type: "manual",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setSubmitting(true);
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
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Yeni Görev Oluştur</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          {/* Row: Assignee + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Atanan Kişi</Label>
              <Select
                value={watch("assigned_to") ?? "unassigned"}
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
            </div>

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
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
            >
              İptal
            </Button>
            <Button
              type="submit"
              disabled={submitting}
              className="bg-vw-primary text-vw-dark hover:bg-vw-deep hover:text-white"
            >
              {submitting ? "Oluşturuluyor..." : "Oluştur"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
