"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  Send,
  Upload,
  Trash2,
  CheckCircle2,
  Circle,
  Plus,
  ShieldAlert,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  FileText,
  FileSpreadsheet,
  Link,
} from "lucide-react";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  TASK_ACTIVITY_LABELS,
  type TaskStatus,
  type TaskPriority,
  type TaskActivityAction,
} from "@/lib/constants";
import {
  getTaskById,
  getTaskComments,
  getTaskAttachments,
  getTaskActivity,
  getSubtasks,
  getAgentActionsForTask,
  getAgentInfo,
  updateTask,
  deleteTask,
  addTaskComment,
  addTaskAttachment,
  createTask,
  getTaskOutput,
  type TaskWithRelations,
  type TaskComment,
  type TaskAttachment,
  type TaskActivity as TaskActivityType,
} from "../../actions";

// ─── Types ───────────────────────────────────────────────────

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };
type AgentInfo = { id: string; name: string; code: string; department: string } | null;

interface TaskDetailSheetProps {
  taskId: string;
  users: User[];
  agents?: Agent[];
  open: boolean;
  onClose: () => void;
}

// ─── Agent Color Palette ─────────────────────────────────────

const AGENT_COLORS = [
  { bg: "#e8f4fd", text: "#1565c0", border: "#90caf9" },
  { bg: "#f3e5f5", text: "#7b1fa2", border: "#ce93d8" },
  { bg: "#e8f5e9", text: "#2e7d32", border: "#a5d6a7" },
  { bg: "#fff3e0", text: "#e65100", border: "#ffcc80" },
  { bg: "#fce4ec", text: "#c62828", border: "#f48fb1" },
  { bg: "#e0f2f1", text: "#00695c", border: "#80cbc4" },
  { bg: "#f9fbe7", text: "#558b2f", border: "#dce775" },
  { bg: "#ede7f6", text: "#4527a0", border: "#b39ddb" },
];

function getAgentColor(agentId: string) {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = agentId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

// ─── Markdown Renderer ───────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="prose prose-sm max-w-none break-words
      prose-headings:font-semibold prose-headings:text-vw-dark
      prose-h1:text-xl prose-h2:text-lg prose-h3:text-base
      prose-table:text-xs prose-td:py-1 prose-th:py-1
      prose-code:bg-muted prose-code:px-1 prose-code:rounded prose-code:text-xs
      prose-pre:bg-muted prose-pre:text-xs">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// ─── File Icon ───────────────────────────────────────────────

function FileIcon({ name }: { name: string }) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return <FileText className="h-4 w-4 text-red-500" />;
  if (["xls", "xlsx", "csv"].includes(ext ?? ""))
    return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
  return <FileText className="h-4 w-4 text-vw-side" />;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main Component ──────────────────────────────────────────

export function TaskDetailSheet({
  taskId,
  users,
  agents = [],
  open,
  onClose,
}: TaskDetailSheetProps) {
  // Data state
  const [task, setTask] = useState<TaskWithRelations | null>(null);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [activity, setActivity] = useState<TaskActivityType[]>([]);
  const [subtasks, setSubtasks] = useState<TaskWithRelations[]>([]);
  const [agentActions, setAgentActions] = useState<Record<string, unknown>[]>([]);
  const [taskOutput, setTaskOutput] = useState<Record<string, unknown> | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<AgentInfo>(null);
  const [loading, setLoading] = useState(true);

  // UI state
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState("");
  const [commentText, setCommentText] = useState("");
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
  const [activityOpen, setActivityOpen] = useState(false);
  const [expandedComments, setExpandedComments] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    const [t, c, a, act, st, aa, out] = await Promise.all([
      getTaskById(taskId),
      getTaskComments(taskId),
      getTaskAttachments(taskId),
      getTaskActivity(taskId),
      getSubtasks(taskId),
      getAgentActionsForTask(taskId),
      getTaskOutput(taskId),
    ]);
    setTask(t);
    setComments(c);
    setAttachments(a);
    setActivity(act);
    setSubtasks(st);
    setAgentActions(aa as Record<string, unknown>[]);
    setTaskOutput(out as Record<string, unknown> | null);
    if (t) {
      setTitleValue(t.title);
      // Check if assigned_to is an agent
      if (t.assigned_to) {
        const agentData = await getAgentInfo(t.assigned_to);
        setAssignedAgent(agentData);
      } else {
        setAssignedAgent(null);
      }
    }
    setLoading(false);
  }, [taskId]);

  useEffect(() => {
    if (open) loadData();
  }, [open, loadData]);

  // ─── Handlers ───────────────────────────────────────────────

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

  const handleBoolToggle = async (
    field: "is_blocked" | "is_waiting_approval",
    current: boolean
  ) => {
    const result = await updateTask(taskId, { [field]: !current });
    if (result.success) loadData();
    else toast.error(result.error || "Güncelleme başarısız");
  };

  const handleDelete = async () => {
    if (!confirm("Bu görevi silmek istediğinize emin misiniz?")) return;
    const result = await deleteTask(taskId);
    if (result.success) {
      toast.success("Görev silindi");
      onClose();
    } else {
      toast.error(result.error || "Görev silinemedi");
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href + `?task=${taskId}`);
    toast.success("Bağlantı kopyalandı");
  };

  const handleCopyMarkdown = () => {
    const content =
      (taskOutput?.metadata as Record<string, unknown> | null)?.full_content as string;
    if (content) {
      navigator.clipboard.writeText(content);
      toast.success("Rapor kopyalandı");
    }
  };

  const toggleCommentExpand = (id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // ─── Derived Data ────────────────────────────────────────────

  const isAgentTask = !!assignedAgent;

  const reportContent =
    (taskOutput?.metadata as Record<string, unknown> | null)?.full_content as
      | string
      | undefined;

  const reportCreatedAt = taskOutput?.created_at as string | undefined;

  const subtaskProgress =
    subtasks.length > 0
      ? Math.round(
          (subtasks.filter((s) => s.status === "done").length / subtasks.length) * 100
        )
      : 0;

  const totalTokens = agentActions.reduce(
    (s, a) => s + ((a.tokens_used as number) ?? 0),
    0
  );
  const totalCost = agentActions.reduce(
    (s, a) => s + ((a.cost_estimate as number) ?? 0),
    0
  );
  const totalDurationMs = agentActions.reduce(
    (s, a) => s + ((a.duration_ms as number) ?? 0),
    0
  );

  const agentColor = assignedAgent ? getAgentColor(assignedAgent.id) : null;

  const filesWithUrl = (taskOutput
    ? attachments.concat([
        {
          id: taskOutput.id as string,
          task_id: taskId,
          file_url: taskOutput.file_url as string,
          file_name: taskOutput.file_name as string,
          file_size: taskOutput.file_size as number | null,
          uploaded_by: "",
          created_at: taskOutput.created_at as string,
          uploader_name: assignedAgent?.name ?? "Agent",
        } as TaskAttachment,
      ])
    : attachments
  ).filter((f) => f.file_url);

  // ─── Formatters ──────────────────────────────────────────────

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatShortDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  // ─── Render ──────────────────────────────────────────────────

  if (!open) return null;

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {/* Wider panel: max-w-2xl ≈ 672px, full screen on mobile */}
      <SheetContent className="w-full sm:max-w-2xl flex flex-col p-0 overflow-hidden">
        <SheetTitle className="sr-only">Görev Detayı</SheetTitle>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <div className="space-y-3 w-full px-6 pt-6">
              <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-full rounded bg-muted animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
              <div className="mt-6 h-40 w-full rounded bg-muted animate-pulse" />
            </div>
          </div>
        ) : task ? (
          <div className="flex flex-col h-full overflow-hidden">
            {/* ── HEADER ────────────────────────────────────────── */}
            <SheetHeader className="shrink-0 px-6 pt-5 pb-4 border-b space-y-3">
              {/* Title row */}
              <div className="flex items-start gap-2 pr-8">
                {editingTitle ? (
                  <Input
                    value={titleValue}
                    onChange={(e) => setTitleValue(e.target.value)}
                    onBlur={handleTitleSave}
                    onKeyDown={(e) => e.key === "Enter" && handleTitleSave()}
                    autoFocus
                    className="text-xl font-bold h-auto py-0 px-0 border-0 shadow-none focus-visible:ring-0"
                  />
                ) : (
                  <h2
                    className="text-xl font-bold leading-tight cursor-pointer hover:text-vw-deep transition-colors flex-1"
                    onClick={() => setEditingTitle(true)}
                    title="Başlığı düzenlemek için tıklayın"
                  >
                    {task.title}
                  </h2>
                )}
                {/* Header action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={handleCopyLink}
                    className="p-1.5 rounded text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    title="Bağlantıyı kopyala"
                  >
                    <Link className="h-4 w-4" />
                  </button>
                  <button
                    onClick={handleDelete}
                    className="p-1.5 rounded text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Görevi sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Property badges row */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Status */}
                <Select
                  value={task.status}
                  onValueChange={(v) => handleFieldUpdate("status", v)}
                >
                  <SelectTrigger className="h-7 w-auto text-xs border-0 bg-muted px-2 rounded-full">
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

                {/* Priority */}
                <Select
                  value={task.priority}
                  onValueChange={(v) => handleFieldUpdate("priority", v)}
                >
                  <SelectTrigger className="h-7 w-auto text-xs border-0 bg-muted px-2 rounded-full">
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

                {/* Assignee */}
                <Select
                  value={task.assigned_to ?? "unassigned"}
                  onValueChange={(v) =>
                    handleFieldUpdate("assigned_to", v === "unassigned" ? null : v)
                  }
                >
                  <SelectTrigger className="h-7 w-auto text-xs border-0 bg-muted px-2 rounded-full">
                    <SelectValue
                      placeholder="Atanmamış"
                    >
                      {isAgentTask ? (
                        <span className="flex items-center gap-1">
                          <span>🤖</span>
                          <span>{assignedAgent!.name}</span>
                        </span>
                      ) : undefined}
                    </SelectValue>
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
                        <SelectItem value="---" disabled>── Ajanlar ──</SelectItem>
                        {agents.map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            🤖 {a.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>

                {/* Department */}
                <Select
                  value={task.department}
                  onValueChange={(v) => handleFieldUpdate("department", v)}
                >
                  <SelectTrigger className="h-7 w-auto text-xs border-0 bg-muted px-2 rounded-full">
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

                {/* Due date */}
                <div className="relative flex items-center h-7 bg-muted rounded-full px-2 gap-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <Input
                    type="date"
                    className="h-5 w-28 text-xs border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
                    value={task.due_date ?? ""}
                    onChange={(e) =>
                      handleFieldUpdate("due_date", e.target.value || null)
                    }
                  />
                </div>

                {/* Flag badges */}
                <button
                  onClick={() => handleBoolToggle("is_blocked", task.is_blocked)}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    task.is_blocked
                      ? "bg-red-100 text-red-700"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  Engellendi
                </button>
                <button
                  onClick={() =>
                    handleBoolToggle("is_waiting_approval", task.is_waiting_approval)
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                    task.is_waiting_approval
                      ? "bg-purple-100 text-purple-700"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  Onay Bekliyor
                </button>

                {task.source_type !== "manual" && (
                  <Badge variant="outline" className="h-7 text-xs rounded-full">
                    {task.source_type === "recurring_job" ? "Tekrarlayan" : "Alarm"}
                  </Badge>
                )}
              </div>
            </SheetHeader>

            {/* ── SCROLLABLE CONTENT ─────────────────────────── */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="px-6 py-5 space-y-8">

                {/* ── SECTION 1: ANA İÇERİK ─────────────────── */}
                {isAgentTask ? (
                  /* Agent Görevi — Rapor */
                  <section>
                    {/* Agent info bar */}
                    {agentColor && assignedAgent && (
                      <div
                        className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg text-xs"
                        style={{ backgroundColor: agentColor.bg, color: agentColor.text }}
                      >
                        <span className="flex items-center gap-1.5 font-medium">
                          <span>🤖</span>
                          <span>{assignedAgent.name}</span>
                          <span className="opacity-60">tarafından üretildi</span>
                          {reportCreatedAt && (
                            <span className="opacity-60">• {formatDate(reportCreatedAt)}</span>
                          )}
                        </span>
                        {reportContent && (
                          <div className="flex items-center gap-1">
                            {!!taskOutput?.file_url && (
                              <a
                                href={taskOutput.file_url as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 rounded px-2 py-0.5 hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: agentColor.border }}
                                title="PDF İndir"
                              >
                                <Download className="h-3 w-3" />
                                PDF
                              </a>
                            )}
                            <button
                              onClick={handleCopyMarkdown}
                              className="flex items-center gap-1 rounded px-2 py-0.5 hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: agentColor.border }}
                              title="Raporu kopyala"
                            >
                              <Copy className="h-3 w-3" />
                              Kopyala
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {reportContent ? (
                      <MarkdownContent content={reportContent} />
                    ) : (
                      <div className="rounded-lg border-2 border-dashed border-muted-foreground/20 py-10 text-center text-muted-foreground">
                        <span className="text-2xl mb-2 block">
                          {task.status === "in_progress" ? "⏳" : "⏸️"}
                        </span>
                        <p className="text-sm font-medium">
                          {task.status === "queue"
                            ? "Kuyrukta bekleniyor..."
                            : task.status === "in_progress"
                              ? "Agent çalışıyor..."
                              : "Rapor bulunamadı"}
                        </p>
                        {task.status === "in_progress" && (
                          <p className="text-xs mt-1">
                            Rapor hazırlandığında burada görünecek
                          </p>
                        )}
                      </div>
                    )}
                  </section>
                ) : (
                  /* İnsan Görevi — Açıklama + Alt Görevler */
                  <section className="space-y-6">
                    {/* Description */}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                        Açıklama
                      </h3>
                      {task.description ? (
                        <MarkdownContent content={task.description} />
                      ) : (
                        <p className="text-sm text-muted-foreground italic">
                          Açıklama eklenmemiş
                        </p>
                      )}
                    </div>

                    {/* Subtasks */}
                    <div>
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        Alt Görevler
                        {subtasks.length > 0 && (
                          <span className="ml-2 normal-case font-normal">
                            ({subtasks.filter((s) => s.status === "done").length}/
                            {subtasks.length})
                          </span>
                        )}
                      </h3>

                      {subtasks.length > 0 && (
                        <div className="mb-3">
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

                      <div className="space-y-1">
                        {subtasks.map((st) => (
                          <div
                            key={st.id}
                            className="flex items-center gap-2 rounded-lg p-2 hover:bg-muted/50 transition-colors"
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

                      <div className="flex gap-2 mt-2">
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
                          className="h-8 w-8 shrink-0"
                          onClick={handleAddSubtask}
                          disabled={!newSubtaskTitle.trim()}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </section>
                )}

                {/* ── SECTION 2: DOSYALAR ─────────────────────── */}
                {filesWithUrl.length > 0 && (
                  <section>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                      Dosyalar
                    </h3>
                    <div className="space-y-2">
                      {filesWithUrl.map((f) => (
                        <div
                          key={f.id}
                          className="flex items-center gap-3 rounded-lg border px-3 py-2 hover:bg-muted/30 transition-colors"
                        >
                          <FileIcon name={f.file_name} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{f.file_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {f.uploader_name}
                              {f.file_size ? ` · ${formatFileSize(f.file_size)}` : ""}
                              {f.created_at ? ` · ${formatShortDate(f.created_at)}` : ""}
                            </p>
                          </div>
                          <a
                            href={f.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="İndir"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </div>
                      ))}
                    </div>

                    {/* Upload button */}
                    <label className="cursor-pointer mt-2 inline-block">
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        Dosya ekle
                      </span>
                    </label>
                  </section>
                )}

                {/* If no files yet, still show upload for human tasks */}
                {filesWithUrl.length === 0 && !isAgentTask && (
                  <section>
                    <label className="cursor-pointer">
                      <input type="file" className="hidden" onChange={handleFileUpload} />
                      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        Dosya ekle
                      </span>
                    </label>
                  </section>
                )}

                {/* ── SECTION 3: YORUMLAR / SOHBET ─────────────── */}
                <section>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                    Yorumlar {comments.length > 0 && `(${comments.length})`}
                  </h3>

                  {/* Comment list */}
                  <div className="space-y-4">
                    {comments.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-6">
                        Henüz yorum yok
                      </p>
                    )}
                    {comments.map((c) => {
                      const isAgent = c.is_agent ?? false;
                      const aColor = isAgent ? getAgentColor(c.author_id) : null;
                      const isLong = c.content.length > 500;
                      const isExpanded = expandedComments.has(c.id);
                      const isAgentLongReport = isAgent && c.content.length > 500;

                      return (
                        <div key={c.id} className="flex gap-3">
                          {/* Avatar */}
                          <div
                            className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-bold"
                            style={
                              isAgent && aColor
                                ? { backgroundColor: aColor.bg, color: aColor.text }
                                : {}
                            }
                          >
                            {isAgent ? (
                              <span>🤖</span>
                            ) : (
                              <span className="bg-vw-primary/20 text-vw-dark w-full h-full rounded-full flex items-center justify-center">
                                {c.author_name?.charAt(0).toUpperCase() ?? "?"}
                              </span>
                            )}
                          </div>

                          {/* Bubble */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-2 mb-1">
                              <span
                                className="text-sm font-semibold"
                                style={isAgent && aColor ? { color: aColor.text } : {}}
                              >
                                {c.author_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatShortDate(c.created_at)}
                              </span>
                            </div>

                            <div
                              className="rounded-lg px-3 py-2 text-sm"
                              style={
                                isAgent && aColor
                                  ? {
                                      backgroundColor: aColor.bg,
                                      borderLeft: `3px solid ${aColor.border}`,
                                    }
                                  : { backgroundColor: "hsl(var(--muted) / 0.5)" }
                              }
                            >
                              {isAgentLongReport && !isExpanded ? (
                                /* Agent long report — truncated */
                                <>
                                  <p className="text-sm">
                                    {c.content.slice(0, 150)}...
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    ✅ Rapor hazırlandı — yukarıdaki rapor bölümünden
                                    görüntüleyebilirsiniz
                                  </p>
                                  <button
                                    onClick={() => toggleCommentExpand(c.id)}
                                    className="mt-1 text-xs underline"
                                    style={aColor ? { color: aColor.text } : {}}
                                  >
                                    Tamamını göster
                                  </button>
                                </>
                              ) : isLong && !isExpanded ? (
                                /* Human long comment — truncated */
                                <div className="relative">
                                  <div className="prose prose-sm max-w-none break-words max-h-[150px] overflow-hidden relative">
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                      {c.content}
                                    </ReactMarkdown>
                                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/50 to-transparent" />
                                  </div>
                                  <button
                                    onClick={() => toggleCommentExpand(c.id)}
                                    className="mt-1 text-xs text-info hover:underline"
                                  >
                                    Devamını oku
                                  </button>
                                </div>
                              ) : (
                                <div className="prose prose-sm max-w-none break-words">
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                    {c.content}
                                  </ReactMarkdown>
                                </div>
                              )}

                              {isLong && isExpanded && (
                                <button
                                  onClick={() => toggleCommentExpand(c.id)}
                                  className="mt-1 text-xs text-muted-foreground hover:underline"
                                >
                                  Daralt
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Comment input */}
                  <div className="flex gap-2 mt-4">
                    <Textarea
                      placeholder="Yorum yazın veya agent'a soru sorun..."
                      className="min-h-[72px] text-sm resize-none"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
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
                      className="self-end h-9 w-9"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter gönderir · Shift+Enter yeni satır
                  </p>
                </section>

                {/* ── SECTION 4: AKTİVİTE (collapsible) ───────── */}
                <section className="pb-8">
                  <button
                    onClick={() => setActivityOpen((prev) => !prev)}
                    className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide hover:text-foreground transition-colors w-full text-left"
                  >
                    <span>Aktivite</span>
                    {activity.length > 0 && (
                      <span className="normal-case font-normal text-xs">
                        ({activity.length})
                      </span>
                    )}
                    {activityOpen ? (
                      <ChevronUp className="h-4 w-4 ml-auto" />
                    ) : (
                      <ChevronDown className="h-4 w-4 ml-auto" />
                    )}
                  </button>

                  {activityOpen && (
                    <div className="mt-4 space-y-4">
                      {/* Agent summary card (only if agent task & has actions) */}
                      {isAgentTask && agentActions.length > 0 && (
                        <div className="rounded-lg border p-3">
                          <p className="text-xs font-semibold text-muted-foreground mb-2">
                            🤖 Agent Çalışma Özeti
                          </p>
                          <div className="grid grid-cols-4 gap-2 text-center">
                            <div>
                              <p className="text-sm font-bold">
                                {totalTokens.toLocaleString("tr-TR")}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Token</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">
                                ${totalCost.toFixed(4)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">Maliyet</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">{agentActions.length}</p>
                              <p className="text-[10px] text-muted-foreground">İşlem</p>
                            </div>
                            <div>
                              <p className="text-sm font-bold">
                                {(totalDurationMs / 1000).toFixed(0)}s
                              </p>
                              <p className="text-[10px] text-muted-foreground">Süre</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Activity log */}
                      {activity.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          Henüz aktivite yok
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {activity.map((a) => (
                            <div key={a.id} className="flex items-start gap-2 text-xs">
                              <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-vw-side shrink-0" />
                              <div>
                                <span className="font-medium">{a.actor_name}</span>{" "}
                                <span className="text-muted-foreground">
                                  {TASK_ACTIVITY_LABELS[
                                    a.action as TaskActivityAction
                                  ] ?? a.action}
                                </span>
                                {a.old_value && a.new_value && (
                                  <span className="text-muted-foreground">
                                    {" "}
                                    ({a.old_value} → {a.new_value})
                                  </span>
                                )}
                                {!a.old_value && a.new_value && a.action !== "created" && (
                                  <span className="text-muted-foreground">
                                    : {a.new_value}
                                  </span>
                                )}
                                <p className="text-muted-foreground mt-0.5">
                                  {formatDate(a.created_at)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </section>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6">
            <p className="text-sm text-muted-foreground">Görev bulunamadı</p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
