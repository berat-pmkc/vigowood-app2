"use client";

import { useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Calendar,
  Paperclip,
  MessageSquare,
  ListChecks,
  GripVertical,
  Bot,
  ShieldAlert,
  Clock,
} from "lucide-react";
import {
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  type TaskPriority,
  type TaskDepartment,
} from "@/lib/constants";
import type { TaskWithRelations } from "../../actions";

type Agent = { id: string; name: string; code: string; department: string; status: string };

interface TaskCardProps {
  task: TaskWithRelations;
  agents: Agent[];
  onClick: () => void;
  isDragOverlay?: boolean;
}

export function TaskCard({ task, agents, onClick, isDragOverlay }: TaskCardProps) {
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

  const agentIdSet = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);
  const isAgentAssigned = task.assigned_to ? agentIdSet.has(task.assigned_to) : false;

  const assigneeDisplay = useMemo(() => {
    if (!task.assigned_to) return null;
    if (isAgentAssigned) {
      const agent = agents.find((a) => a.id === task.assigned_to);
      return { type: "agent" as const, name: agent?.name ?? task.assigned_to };
    }
    return {
      type: "user" as const,
      name: task.assignee_name ?? task.assigned_to,
      initials: task.assignee_name
        ? task.assignee_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()
        : "??",
    };
  }, [task.assigned_to, task.assignee_name, isAgentAssigned, agents]);

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
        {task.is_blocked && (
          <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
            <ShieldAlert className="h-3 w-3" />
            Engellendi
          </span>
        )}
        {task.is_waiting_approval && (
          <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
            <Clock className="h-3 w-3" />
            Onay Bekliyor
          </span>
        )}
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
        {assigneeDisplay?.type === "agent" ? (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-violet-700"
            title={assigneeDisplay.name}
          >
            <Bot className="h-3.5 w-3.5" />
          </div>
        ) : assigneeDisplay?.type === "user" ? (
          <div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-vw-primary text-[9px] font-bold text-vw-dark"
            title={assigneeDisplay.name}
          >
            {assigneeDisplay.initials}
          </div>
        ) : null}
      </div>
    </div>
  );
}
