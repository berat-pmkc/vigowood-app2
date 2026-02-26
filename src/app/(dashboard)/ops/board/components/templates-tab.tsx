"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, FileText, Trash2, Edit, Zap, ListChecks } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  type TaskDepartment,
  type TaskPriority,
} from "@/lib/constants";
import {
  deleteTaskTemplate,
  createTaskFromTemplate,
} from "../../actions";
import type { TaskTemplate } from "@/lib/supabase/types";
import { TemplateDialog } from "./template-dialog";

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };

interface TemplatesTabProps {
  templates: TaskTemplate[];
  users: User[];
  agents: Agent[];
}

export function TemplatesTab({ templates, users, agents }: TemplatesTabProps) {
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [showDialog, setShowDialog] = useState(false);
  const [editTemplate, setEditTemplate] = useState<TaskTemplate | null>(null);

  const filtered = templates.filter((t) => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (deptFilter !== "all" && t.department !== deptFilter) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Bu şablonu silmek istediğinize emin misiniz?")) return;
    const result = await deleteTaskTemplate(id);
    if (result.success) {
      toast.success("Şablon silindi");
    } else {
      toast.error(result.error || "Silinemedi");
    }
  };

  const handleCreateFromTemplate = async (templateId: string) => {
    const result = await createTaskFromTemplate(templateId);
    if (result.success) {
      toast.success("Görev oluşturuldu");
    } else {
      toast.error(result.error || "Görev oluşturulamadı");
    }
  };

  return (
    <>
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-[250px]"
            placeholder="Şablon ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="h-8 rounded-md border px-2 text-sm"
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="all">Tüm Departmanlar</option>
            {Object.entries(TASK_DEPARTMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={() => { setEditTemplate(null); setShowDialog(true); }}
          className="bg-vw-primary text-vw-dark hover:bg-vw-deep hover:text-white"
        >
          <Plus className="mr-1 h-4 w-4" />
          Yeni Şablon
        </Button>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <FileText className="mb-2 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">Henüz şablon yok</p>
          <p className="text-xs text-muted-foreground">İlk şablonunuzu oluşturun</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((t) => {
            const checklist = Array.isArray(t.checklist) ? t.checklist as { text: string; done: boolean }[] : [];
            const deptColors = TASK_DEPARTMENT_COLORS[t.department as TaskDepartment];
            const prioColors = TASK_PRIORITY_COLORS[t.priority as TaskPriority];

            return (
              <div
                key={t.id}
                className="rounded-lg border border-l-4 border-l-teal-400 bg-teal-50/40 p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-medium text-sm leading-tight">{t.title}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => { setEditTemplate(t); setShowDialog(true); }}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {t.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                    {t.description}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1">
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${deptColors.bg} ${deptColors.text}`}>
                    {TASK_DEPARTMENT_LABELS[t.department as TaskDepartment]}
                  </span>
                  <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${prioColors.bg} ${prioColors.text}`}>
                    {TASK_PRIORITY_LABELS[t.priority as TaskPriority]}
                  </span>
                  {checklist.length > 0 && (
                    <span className="inline-flex items-center gap-0.5 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      <ListChecks className="h-3 w-3" />
                      {checklist.length} madde
                    </span>
                  )}
                </div>

                <div className="mt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 w-full text-xs"
                    onClick={() => handleCreateFromTemplate(t.id)}
                  >
                    <Zap className="mr-1 h-3.5 w-3.5" />
                    Görev Oluştur
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      {showDialog && (
        <TemplateDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setEditTemplate(null); }}
          template={editTemplate}
          users={users}
          agents={agents}
        />
      )}
    </>
  );
}
