"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCorners,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Plus, LayoutGrid, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskStatus,
} from "@/lib/constants";
import { updateTask, createTask, type TaskWithRelations } from "../../actions";
import { KanbanColumn } from "./kanban-column";
import { TaskCard } from "./task-card";
import { TaskDetailSheet } from "./task-detail-sheet";
import { TaskCreateDialog } from "./task-create-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };

type ViewMode = "durum" | "kisi";
type AssigneeFilterMode = "all" | "users" | "agents";

interface KanbanBoardProps {
  initialTasks: TaskWithRelations[];
  users: User[];
  agents: Agent[];
}

export function KanbanBoard({ initialTasks, users, agents }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

  // View mode & filters
  const [viewMode, setViewMode] = useState<ViewMode>("durum");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilterMode, setAssigneeFilterMode] = useState<AssigneeFilterMode>("all");

  const router = useRouter();
  const agentIdSet = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.parent_id) return false; // Exclude subtasks
      if (deptFilter !== "all" && t.department !== deptFilter) return false;
      if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilterMode === "users" && t.assigned_to && agentIdSet.has(t.assigned_to)) return false;
      if (assigneeFilterMode === "agents" && t.assigned_to && !agentIdSet.has(t.assigned_to)) return false;
      return true;
    });
  }, [tasks, deptFilter, assigneeFilter, priorityFilter, assigneeFilterMode, agentIdSet]);

  const getTasksByStatus = useCallback(
    (status: TaskStatus) => filteredTasks.filter((t) => t.status === status),
    [filteredTasks]
  );

  // Person-based grouping
  const personColumns = useMemo(() => {
    if (viewMode !== "kisi") return [];

    const groups = new Map<string, { name: string; isAgent: boolean; tasks: TaskWithRelations[] }>();
    groups.set("unassigned", { name: "Atanmamış", isAgent: false, tasks: [] });

    for (const t of filteredTasks) {
      if (!t.assigned_to) {
        groups.get("unassigned")!.tasks.push(t);
      } else {
        if (!groups.has(t.assigned_to)) {
          const isAgent = agentIdSet.has(t.assigned_to);
          const agent = agents.find((a) => a.id === t.assigned_to);
          const user = users.find((u) => u.user_id === t.assigned_to);
          groups.set(t.assigned_to, {
            name: isAgent ? (agent?.name ?? t.assigned_to) : (user?.full_name ?? t.assignee_name ?? t.assigned_to),
            isAgent,
            tasks: [],
          });
        }
        groups.get(t.assigned_to)!.tasks.push(t);
      }
    }

    return [...groups.entries()].sort((a, b) => {
      if (a[0] === "unassigned") return 1;
      if (b[0] === "unassigned") return -1;
      return a[1].name.localeCompare(b[1].name, "tr");
    });
  }, [viewMode, filteredTasks, agentIdSet, agents, users]);

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (_event: DragOverEvent) => {};

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const dropTarget = over.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (viewMode === "durum") {
      const newStatus = dropTarget as TaskStatus;
      if (!TASK_STATUSES.includes(newStatus)) return;
      if (task.status === newStatus) return;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );

      const result = await updateTask(taskId, { status: newStatus });
      if (!result.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t))
        );
        toast.error(result.error || "Durum güncellenemedi");
      } else {
        toast.success(`Görev "${TASK_STATUS_LABELS[newStatus]}" durumuna taşındı`);
        router.refresh();
      }
    } else {
      // Person mode: change assigned_to
      const newAssignee = dropTarget === "unassigned" ? null : dropTarget;
      if (task.assigned_to === newAssignee) return;

      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, assigned_to: newAssignee } : t))
      );

      const result = await updateTask(taskId, { assigned_to: newAssignee });
      if (!result.success) {
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, assigned_to: task.assigned_to } : t))
        );
        toast.error(result.error || "Atama güncellenemedi");
      } else {
        toast.success("Görev atandı");
        router.refresh();
      }
    }
  };

  const handleQuickCreate = async () => {
    if (!quickTitle.trim()) return;
    const result = await createTask({ title: quickTitle.trim() });
    if (result.success) {
      toast.success("Görev oluşturuldu");
      setQuickTitle("");
      router.refresh();
    } else {
      toast.error(result.error || "Görev oluşturulamadı");
    }
  };

  return (
    <>
      {/* Filters + Controls */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-md border">
            <button
              onClick={() => setViewMode("durum")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors rounded-l-md",
                viewMode === "durum"
                  ? "bg-vw-primary text-vw-dark"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Durum
            </button>
            <button
              onClick={() => setViewMode("kisi")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors rounded-r-md border-l",
                viewMode === "kisi"
                  ? "bg-vw-primary text-vw-dark"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Kişi
            </button>
          </div>

          <Select value={deptFilter} onValueChange={setDeptFilter}>
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

          <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
            <SelectTrigger className="h-8 w-[160px]">
              <SelectValue placeholder="Atanan Kişi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Kişiler</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.user_id} value={u.user_id}>
                  {u.full_name}
                </SelectItem>
              ))}
              {agents.length > 0 && (
                <>
                  <SelectItem value="---" disabled>── Asistanlar ──</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </>
              )}
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
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

          {/* Assignee type filter */}
          <div className="flex rounded-md border">
            {(["all", "users", "agents"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setAssigneeFilterMode(mode)}
                className={cn(
                  "px-2 py-1 text-xs font-medium transition-colors",
                  mode === "all" && "rounded-l-md",
                  mode === "agents" && "rounded-r-md",
                  mode !== "all" && mode !== "agents" && "border-x",
                  assigneeFilterMode === mode
                    ? "bg-vw-primary/20 text-vw-dark"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {mode === "all" ? "Tümü" : mode === "users" ? "Çalışanlar" : "Asistanlar"}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-[200px]"
            placeholder="Hızlı görev ekle..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleQuickCreate()}
          />
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="bg-vw-primary text-vw-dark hover:bg-vw-deep hover:text-white"
          >
            <Plus className="mr-1 h-4 w-4" />
            Yeni Görev
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4">
          {viewMode === "durum"
            ? TASK_STATUSES.map((status) => {
                const columnTasks = getTasksByStatus(status);
                return (
                  <KanbanColumn
                    key={status}
                    status={status}
                    label={TASK_STATUS_LABELS[status]}
                    colors={TASK_STATUS_COLORS[status]}
                    count={columnTasks.length}
                  >
                    <SortableContext
                      items={columnTasks.map((t) => t.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {columnTasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          agents={agents}
                          onClick={() => setSelectedTaskId(task.id)}
                        />
                      ))}
                    </SortableContext>
                  </KanbanColumn>
                );
              })
            : personColumns.map(([personId, group]) => (
                <KanbanColumn
                  key={personId}
                  status={personId}
                  label={group.isAgent ? group.name : group.name}
                  colors={
                    group.isAgent
                      ? { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-300" }
                      : personId === "unassigned"
                        ? { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" }
                        : { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-300" }
                  }
                  count={group.tasks.length}
                >
                  <SortableContext
                    items={group.tasks.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {group.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        agents={agents}
                        onClick={() => setSelectedTaskId(task.id)}
                      />
                    ))}
                  </SortableContext>
                </KanbanColumn>
              ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} agents={agents} onClick={() => {}} isDragOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Sheet */}
      {selectedTaskId && (
        <TaskDetailSheet
          taskId={selectedTaskId}
          users={users}
          agents={agents}
          open={!!selectedTaskId}
          onClose={() => { setSelectedTaskId(null); router.refresh(); }}
        />
      )}

      {/* Create Dialog */}
      <TaskCreateDialog
        open={showCreateDialog}
        onClose={() => { setShowCreateDialog(false); router.refresh(); }}
        users={users}
        agents={agents}
      />
    </>
  );
}
