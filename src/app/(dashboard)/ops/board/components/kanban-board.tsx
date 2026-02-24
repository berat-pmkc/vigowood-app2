"use client";

import { useState, useCallback } from "react";
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
import { Plus } from "lucide-react";
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

type User = { user_id: string; full_name: string; role: string };

interface KanbanBoardProps {
  initialTasks: TaskWithRelations[];
  users: User[];
}

export function KanbanBoard({ initialTasks, users }: KanbanBoardProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskWithRelations | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

  // Filters
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor)
  );

  const filteredTasks = tasks.filter((t) => {
    if (deptFilter !== "all" && t.department !== deptFilter) return false;
    if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  const getTasksByStatus = useCallback(
    (status: TaskStatus) =>
      filteredTasks.filter((t) => t.status === status && !t.parent_id),
    [filteredTasks]
  );

  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (_event: DragOverEvent) => {
    // Visual feedback handled by DnD kit
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    if (!TASK_STATUSES.includes(newStatus as TaskStatus)) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    const result = await updateTask(taskId, { status: newStatus });
    if (!result.success) {
      // Rollback
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t))
      );
      toast.error(result.error || "Durum güncellenemedi");
    } else {
      toast.success(`Görev "${TASK_STATUS_LABELS[newStatus]}" durumuna taşındı`);
    }
  };

  const handleQuickCreate = async () => {
    if (!quickTitle.trim()) return;
    const result = await createTask({ title: quickTitle.trim() });
    if (result.success) {
      toast.success("Görev oluşturuldu");
      setQuickTitle("");
      // Refresh will be handled by revalidation, but we can add optimistic
    } else {
      toast.error(result.error || "Görev oluşturulamadı");
    }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleQuickCreate();
    }
  };

  return (
    <>
      {/* Filters + Quick Create */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-2">
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
        </div>

        <div className="flex items-center gap-2">
          <Input
            className="h-8 w-[200px]"
            placeholder="Hızlı görev ekle..."
            value={quickTitle}
            onChange={(e) => setQuickTitle(e.target.value)}
            onKeyDown={handleQuickKeyDown}
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
          {TASK_STATUSES.map((status) => {
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
                      onClick={() => setSelectedTaskId(task.id)}
                    />
                  ))}
                </SortableContext>
              </KanbanColumn>
            );
          })}
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} onClick={() => {}} isDragOverlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Task Detail Sheet */}
      {selectedTaskId && (
        <TaskDetailSheet
          taskId={selectedTaskId}
          users={users}
          open={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}

      {/* Create Dialog */}
      <TaskCreateDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        users={users}
      />
    </>
  );
}
