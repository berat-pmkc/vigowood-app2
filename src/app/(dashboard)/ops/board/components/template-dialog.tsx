"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Plus, X, GripVertical } from "lucide-react";
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
} from "@/lib/constants";
import { createTaskTemplate, updateTaskTemplate } from "../../actions";
import type { TaskTemplate } from "@/lib/supabase/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };

interface TemplateDialogProps {
  open: boolean;
  onClose: () => void;
  template?: TaskTemplate | null;
  users: User[];
  agents: Agent[];
}

type FormValues = {
  title: string;
  description: string;
  department: string;
  priority: string;
  assignee_id: string;
};

export function TemplateDialog({ open, onClose, template, users, agents }: TemplateDialogProps) {
  const isEdit = !!template;
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<{ text: string; done: boolean }[]>(
    () => {
      if (template?.checklist && Array.isArray(template.checklist)) {
        return template.checklist as { text: string; done: boolean }[];
      }
      return [];
    }
  );
  const [newItem, setNewItem] = useState("");

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: {
      title: template?.title ?? "",
      description: template?.description ?? "",
      department: template?.department ?? "genel",
      priority: template?.priority ?? "medium",
      assignee_id: template?.assignee_id ?? "",
    },
  });

  const onSubmit = async (data: FormValues) => {
    setSaving(true);
    try {
      const payload = {
        title: data.title,
        description: data.description || null,
        department: data.department as "genel",
        priority: data.priority as "medium",
        assignee_id: data.assignee_id || null,
        checklist,
      };

      const result = isEdit
        ? await updateTaskTemplate(template!.id, payload)
        : await createTaskTemplate(payload);

      if (result.success) {
        toast.success(isEdit ? "Şablon güncellendi" : "Şablon oluşturuldu");
        onClose();
      } else {
        toast.error(result.error || "Bir hata oluştu");
      }
    } finally {
      setSaving(false);
    }
  };

  const addChecklistItem = () => {
    if (!newItem.trim()) return;
    setChecklist((prev) => [...prev, { text: newItem.trim(), done: false }]);
    setNewItem("");
  };

  const removeChecklistItem = (index: number) => {
    setChecklist((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Şablon Düzenle" : "Yeni Şablon"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Başlık *</Label>
            <Input {...register("title", { required: true })} placeholder="Şablon başlığı" />
          </div>

          <div>
            <Label>Açıklama</Label>
            <Textarea {...register("description")} placeholder="Açıklama" rows={3} />
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

          <div>
            <Label>Atanan</Label>
            <Tabs defaultValue="calisanlar" className="mt-1">
              <TabsList className="h-8">
                <TabsTrigger value="calisanlar" className="text-xs">Çalışanlar</TabsTrigger>
                <TabsTrigger value="asistanlar" className="text-xs">Asistanlar</TabsTrigger>
              </TabsList>
              <TabsContent value="calisanlar" className="mt-1">
                <Select value={watch("assignee_id")} onValueChange={(v) => setValue("assignee_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Çalışan seç" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Atanmamış</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TabsContent>
              <TabsContent value="asistanlar" className="mt-1">
                <Select value={watch("assignee_id")} onValueChange={(v) => setValue("assignee_id", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Asistan seç" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Atanmamış</SelectItem>
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

          {/* Checklist */}
          <div>
            <Label>Kontrol Listesi</Label>
            <div className="mt-1 space-y-1">
              {checklist.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded border px-2 py-1">
                  <GripVertical className="h-3 w-3 text-muted-foreground" />
                  <span className="flex-1 text-sm">{item.text}</span>
                  <button
                    type="button"
                    onClick={() => removeChecklistItem(idx)}
                    className="text-muted-foreground hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 text-sm"
                  placeholder="Yeni madde..."
                  value={newItem}
                  onChange={(e) => setNewItem(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addChecklistItem();
                    }
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addChecklistItem}
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
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
