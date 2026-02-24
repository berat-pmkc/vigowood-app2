"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Paperclip,
  MessageSquare,
  ListChecks,
  GripVertical,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  type TaskPriority,
  type TaskDepartment,
} from "@/lib/constants";
import type { TaskWithRelations } from "../../actions";

interface TaskCardProps {
  task: TaskWithRelations;
  onClick: () => void;
  isDragOverlay?: boolean;
}

export function TaskCard({ task, onClick, isDragOverlay }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priorityColors = TASK_PRIORITY_COLORS[task.priority as TaskPriority];
  const deptColors = TASK_DEPARTMENT_COLORS[task.department as TaskDepartment];

  const isOverdue =
    task.due_date &&
    task.status !== "done" &&
    new Date(task.due_date) < new Date(new Date().toDateString());

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  };

  const initials = task.assignee_name
    ? task.assignee_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : null;

  return (
    <div
      ref={isDragOverlay ? undefined : setNodeRef}
      style={isDragOverlay ? undefined : style}
      className={`group cursor-pointer rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md ${
        isDragOverlay ? "rotate-2 shadow-lg" : ""
      }`}
      onClick={onClick}
    >
      {/* Drag handle + Title */}
      <div className="flex items-start gap-1">
        <button
          className="mt-0.5 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          {...(isDragOverlay ? {} : { ...attributes, ...listeners })}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <h4 className="flex-1 text-sm font-medium leading-tight">
          {task.title}
        </h4>
      </div>

      {/* Badges */}
      <div className="mt-2 flex flex-wrap gap-1">
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityColors.bg} ${priorityColors.text}`}
        >
          {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
        </span>
        <span
          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${deptColors.bg} ${deptColors.text}`}
        >
          {TASK_DEPARTMENT_LABELS[task.department as TaskDepartment]}
        </span>
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {task.due_date && (
            <span
              className={`flex items-center gap-0.5 ${
                isOverdue ? "font-medium text-red-600" : ""
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
          {(task.attachment_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" />
              {task.attachment_count ?? 0}
            </span>
          )}
          {(task.comment_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageSquare className="h-3 w-3" />
              {task.comment_count ?? 0}
            </span>
          )}
        </div>

        {/* Assignee avatar */}
        {initials && (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-vw-primary text-[9px] font-bold text-vw-dark"
            title={task.assignee_name ?? ""}
          >
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}
