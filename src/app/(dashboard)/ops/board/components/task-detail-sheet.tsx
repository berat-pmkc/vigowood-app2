"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calendar,
  MessageSquare,
  Paperclip,
  Activity,
  ListChecks,
  Send,
  Upload,
  Trash2,
  CheckCircle2,
  Circle,
  Plus,
  ShieldAlert,
  Clock,
  Cpu,
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
  TASK_ACTIVITY_LABELS,
  type TaskStatus,
  type TaskPriority,
  type TaskDepartment,
  type TaskActivityAction,
} from "@/lib/constants";
import {
  getTaskById,
  getTaskComments,
  getTaskAttachments,
  getTaskActivity,
  getSubtasks,
  getAgentActionsForTask,
  updateTask,
  addTaskComment,
  addTaskAttachment,
  createTask,
  type TaskWithRelations,
  type TaskComment,
  type TaskAttachment,
  type TaskActivity as TaskActivityType,
} from "../../actions";

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };

interface TaskDetailSheetProps {
  taskId: string;
  users: User[];
  agents?: Agent[];
  open: boolean;
  onClose: () => void;
}

export function TaskDetailSheet({
  taskId,
  users,
  agents = [],
  open,
  onClose,
}: TaskDetailSheetProps) {
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activity, setActivity] = useState<TaskActivityType[]>([]);
  const [subtasks, setSubtasks] = useState<TaskWithRelations[]>([]);
  const [agentActions, setAgentActions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [commentText, setCommentText] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    const [t, c, a, act, st, aa] = await Promise.all([
      getTaskById(taskId),
      getTaskComments(taskId),
      getTaskAttachments(taskId),
      getTaskActivity(taskId),
      getSubtasks(taskId),
      getAgentActionsForTask(taskId),
    ]);
    setTask(t);
    setComments(c);
    setAttachments(a);
    setActivity(act);
    setSubtasks(st);
    setAgentActions(aa as Record<string, unknown>[]);
    if (t) setTitleValue(t.title);
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  const handleFieldUpdate = async (field: string, value: string | null) => {
    if (!task) return;
    const result = await updateTask(taskId, { [field]: value });
    if (result.success) {
      loadData();
    } else {
      toast.error(result.error || "Güncelleme başarısız");
    }
  };

  const handleTitleSave = async () => {
    if (!titleValue.trim() || titleValue === task?.title) {
      setEditingTitle(false);
      return;
    }
    await handleFieldUpdate("title", titleValue.trim());
    setEditingTitle(false);
  };

  const handleComment = async () => {
    if (!commentText.trim()) return;
    const result = await addTaskComment(taskId, commentText.trim());
    if (result.success) {
      setCommentText("");
      loadData();
    } else {
      toast.error(result.error || "Yorum eklenemedi");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    const result = await addTaskAttachment(taskId, formData);
    if (result.success) {
      toast.success("Dosya yüklendi");
      loadData();
    } else {
      toast.error(result.error || "Dosya yüklenemedi");
    }
    e.target.value = "";
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    const result = await createTask({
      title: newSubtaskTitle.trim(),
      parent_id: taskId,
    });
    if (result.success) {
      setNewSubtaskTitle("");
      loadData();
    } else {
      toast.error(result.error || "Alt görev eklenemedi");
    }
  };

  const handleSubtaskToggle = async (subtask: TaskWithRelations) => {
    const newStatus = subtask.status === "done" ? "queue" : "done";
    const result = await updateTask(subtask.id, { status: newStatus as TaskStatus });
    if (result.success) loadData();
  };

  const handleBoolToggle = async (field: "is_blocked" | "is_waiting_approval", current: boolean) => {
    const result = await updateTask(taskId, { [field]: !current });
    if (result.success) loadData();
    else toast.error(result.error || "Güncelleme başarısız");
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const subtaskProgress =
    subtasks.length > 0
      ? Math.round((subtasks.filter((s) => s.status === "done").length / subtasks.length) * 100)
      : 0;

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-hidden flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle className="sr-only">Görev Detayı</SheetTitle>
          {/* Title */}
          {task && (
            <div className="space-y-3">
              {editingTitle ? (
                <Input
                  value={titleValue}
                  onChange={(e) => setTitleValue(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                  autoFocus
                  className="text-lg font-bold"
                />
              ) : (
                <h2
                  className="cursor-pointer text-lg font-bold hover:text-vw-deep"
                  onClick={() => setEditingTitle(true)}
                >
                  {task.title}
                </h2>
              )}

              {/* Quick controls */}
              <div className="flex flex-wrap gap-2">
                <Select
                  value={task.status}
                  onValueChange={(v) => handleFieldUpdate("status", v)}
                >
                  <SelectTrigger className="h-7 w-auto text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {TASK_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={task.priority}
                  onValueChange={(v) => handleFieldUpdate("priority", v)}
                >
                  <SelectTrigger className="h-7 w-auto text-xs">
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

                <Select
                  value={task.assigned_to ?? "unassigned"}
                  onValueChange={(v) =>
                    handleFieldUpdate("assigned_to", v === "unassigned" ? null : v)
                  }
                >
                  <SelectTrigger className="h-7 w-auto text-xs">
                    <SelectValue placeholder="Atama" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Atanmamış</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.user_id} value={u.user_id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                    {agents.length > 0 && (
                      <>
                        <SelectItem value="---agents---" disabled>── Ajanlar ──</SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            🤖 {a.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>

                <Select
                  value={task.department}
                  onValueChange={(v) => handleFieldUpdate("department", v)}
                >
                  <SelectTrigger className="h-7 w-auto text-xs">
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

                <Input
                  type="date"
                  className="h-7 w-auto text-xs"
                  value={task.due_date ?? ""}
                  onChange={(e) =>
                    handleFieldUpdate("due_date", e.target.value || null)
                  }
                />
              </div>

              {/* Flag toggles */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleBoolToggle("is_blocked", task.is_blocked)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    task.is_blocked
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-gray-200 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  Engellendi
                </button>
                <button
                  onClick={() => handleBoolToggle("is_waiting_approval", task.is_waiting_approval)}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    task.is_waiting_approval
                      ? "border-purple-300 bg-purple-50 text-purple-700"
                      : "border-gray-200 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  Onay Bekliyor
                </button>
              </div>

              {/* Source badge */}
              {task.source_type !== "manual" && (
                <Badge variant="outline" className="text-xs">
                  {task.source_type === "recurring_job"
                    ? "Tekrarlayan"
                    : "Alarm"}
                </Badge>
              )}
            </div>
          )}
        </SheetHeader>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-sm text-muted-foreground">Yükleniyor...</p>
          </div>
        ) : (
          <Tabs defaultValue="comments" className="flex-1 overflow-hidden flex flex-col mt-4">
            <TabsList className="w-full shrink-0">
              <TabsTrigger value="comments" className="flex-1 text-xs">
                <MessageSquare className="mr-1 h-3 w-3" />
                Yorumlar ({comments.length})
              </TabsTrigger>
              <TabsTrigger value="files" className="flex-1 text-xs">
                <Paperclip className="mr-1 h-3 w-3" />
                Dosyalar ({attachments.length})
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-1 text-xs">
                <Activity className="mr-1 h-3 w-3" />
                Aktivite
              </TabsTrigger>
              <TabsTrigger value="subtasks" className="flex-1 text-xs">
                <ListChecks className="mr-1 h-3 w-3" />
                Alt ({subtasks.length})
              </TabsTrigger>
              <TabsTrigger value="work-log" className="flex-1 text-xs">
                <Cpu className="mr-1 h-3 w-3" />
                Günlük
              </TabsTrigger>
            </TabsList>

            {/* Comments Tab */}
            <TabsContent value="comments" className="flex-1 overflow-hidden flex flex-col mt-2">
              <ScrollArea className="flex-1">
                <div className="space-y-3 pr-3">
                  {comments.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Henüz yorum yok
                    </p>
                  )}
                  {comments.map((c) => (
                    <div key={c.id} className="rounded-lg border p-3">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {c.author_name}
                        </span>
                        <span>{formatDate(c.created_at)}</span>
                      </div>
                      <p className="mt-1 text-sm whitespace-pre-wrap">
                        {c.content}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2 pt-3 shrink-0">
                <Textarea
                  placeholder="Yorum yazın..."
                  className="min-h-[60px] text-sm"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleComment();
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleComment}
                  disabled={!commentText.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="flex-1 overflow-hidden flex flex-col mt-2">
              <ScrollArea className="flex-1">
                <div className="space-y-2 pr-3">
                  {attachments.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Henüz dosya yok
                    </p>
                  )}
                  {attachments.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div>
                        <a
                          href={a.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-info hover:underline"
                        >
                          {a.file_name}
                        </a>
                        <p className="text-xs text-muted-foreground">
                          {a.uploader_name} &middot;{" "}
                          {a.file_size
                            ? `${(a.file_size / 1024).toFixed(0)} KB`
                            : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="pt-3 shrink-0">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                  <Button variant="outline" size="sm" asChild>
                    <span>
                      <Upload className="mr-1 h-4 w-4" />
                      Dosya Yükle
                    </span>
                  </Button>
                </label>
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="flex-1 overflow-hidden mt-2">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-3">
                  {activity.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Henüz aktivite yok
                    </p>
                  )}
                  {activity.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-2 text-xs"
                    >
                      <div className="mt-0.5 h-1.5 w-1.5 rounded-full bg-vw-side shrink-0" />
                      <div>
                        <span className="font-medium">{a.actor_name}</span>{" "}
                        <span className="text-muted-foreground">
                          {TASK_ACTIVITY_LABELS[a.action as TaskActivityAction] ?? a.action}
                        </span>
                        {a.old_value && a.new_value && (
                          <span className="text-muted-foreground">
                            {" "}
                            ({a.old_value} &rarr; {a.new_value})
                          </span>
                        )}
                        {!a.old_value && a.new_value && a.action !== "created" && (
                          <span className="text-muted-foreground">
                            : {a.new_value}
                          </span>
                        )}
                        <p className="text-muted-foreground">
                          {formatDate(a.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Subtasks Tab */}
            <TabsContent value="subtasks" className="flex-1 overflow-hidden flex flex-col mt-2">
              {subtasks.length > 0 && (
                <div className="mb-2 shrink-0">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>İlerleme</span>
                    <span>{subtaskProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-vw-success transition-all"
                      style={{ width: `${subtaskProgress}%` }}
                    />
                  </div>
                </div>
              )}
              <ScrollArea className="flex-1">
                <div className="space-y-1 pr-3">
                  {subtasks.map((st) => (
                    <div
                      key={st.id}
                      className="flex items-center gap-2 rounded p-2 hover:bg-muted/50"
                    >
                      <button onClick={() => handleSubtaskToggle(st)}>
                        {st.status === "done" ? (
                          <CheckCircle2 className="h-4 w-4 text-vw-success" />
                        ) : (
                          <Circle className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          st.status === "done"
                            ? "text-muted-foreground line-through"
                            : ""
                        }`}
                      >
                        {st.title}
                      </span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              <div className="flex gap-2 pt-3 shrink-0">
                <Input
                  placeholder="Alt görev ekle..."
                  className="h-8 text-sm"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubtask();
                    }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleAddSubtask}
                  disabled={!newSubtaskTitle.trim()}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </TabsContent>

            {/* Work Log Tab */}
            <TabsContent value="work-log" className="flex-1 overflow-hidden mt-2">
              <ScrollArea className="h-full">
                <div className="space-y-2 pr-3">
                  {agentActions.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      Henüz çalışma kaydı yok
                    </p>
                  ) : (
                    <>
                      {/* Summary */}
                      <div className="mb-3 grid grid-cols-3 gap-2">
                        <div className="rounded border p-2 text-center">
                          <p className="text-lg font-bold">
                            {agentActions.reduce((s, a) => s + ((a.tokens_used as number) ?? 0), 0).toLocaleString()}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Toplam Token</p>
                        </div>
                        <div className="rounded border p-2 text-center">
                          <p className="text-lg font-bold">
                            ${agentActions.reduce((s, a) => s + ((a.cost_estimate as number) ?? 0), 0).toFixed(4)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Toplam Maliyet</p>
                        </div>
                        <div className="rounded border p-2 text-center">
                          <p className="text-lg font-bold">{agentActions.length}</p>
                          <p className="text-[10px] text-muted-foreground">İşlem</p>
                        </div>
                      </div>

                      {/* Action list */}
                      {agentActions.map((a, i) => (
                        <div key={i} className="rounded border p-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{(a.action_type as string) ?? "-"}</span>
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                              (a.result as string) === "success"
                                ? "bg-emerald-100 text-emerald-700"
                                : (a.result as string) === "error"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                            }`}>
                              {(a.result as string) ?? "-"}
                            </span>
                          </div>
                          <div className="mt-1 flex gap-3 text-muted-foreground">
                            <span>{((a.tokens_used as number) ?? 0)} token</span>
                            <span>${((a.cost_estimate as number) ?? 0).toFixed(6)}</span>
                            {a.duration_ms != null && (
                              <span>{((a.duration_ms as number) / 1000).toFixed(1)}s</span>
                            )}
                          </div>
                          {a.created_at != null && (
                            <p className="mt-0.5 text-muted-foreground">
                              {formatDate(a.created_at as string)}
                            </p>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}
