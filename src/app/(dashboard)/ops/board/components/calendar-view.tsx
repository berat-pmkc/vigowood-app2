"use client";

import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Bot, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_STATUS_COLORS,
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  type TaskStatus,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { TaskWithRelations, BoardStats } from "../../actions";
import { TaskDetailSheet } from "./task-detail-sheet";
import { BoardStatsBar, type QuickFilter } from "./board-stats-bar";

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };
type AssigneeFilterMode = "all" | "users" | "agents";

const DAY_NAMES = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const MONTH_NAMES = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

interface CalendarViewProps {
  tasks: TaskWithRelations[];
  users: User[];
  agents: Agent[];
  stats: BoardStats;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return toDateKey(new Date());
}

export function CalendarView({ tasks, users, agents, stats }: CalendarViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());

  // Filters
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilterMode, setAssigneeFilterMode] = useState<AssigneeFilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const agentIdSet = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLocaleLowerCase("tr");
    return tasks.filter((t) => {
      if (deptFilter !== "all" && t.department !== deptFilter) return false;
      if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilterMode === "users" && t.assigned_to && agentIdSet.has(t.assigned_to)) return false;
      if (assigneeFilterMode === "agents" && t.assigned_to && !agentIdSet.has(t.assigned_to)) return false;
      if (q && !t.title.toLocaleLowerCase("tr").includes(q)) return false;
      if (quickFilter === "overdue" && !(t.due_date && t.due_date < todayStr && t.status !== "done")) return false;
      if (quickFilter === "blocked" && !t.is_blocked) return false;
      if (quickFilter === "due_today" && t.due_date !== todayStr) return false;
      return true;
    });
  }, [tasks, deptFilter, assigneeFilter, priorityFilter, assigneeFilterMode, agentIdSet, searchQuery, quickFilter, todayStr]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    // Monday = 0, Sunday = 6
    let startDow = firstDay.getDay() - 1;
    if (startDow < 0) startDow = 6;

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Previous month padding
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }

    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }

    // Next month padding (fill to complete rows)
    const remaining = days.length <= 35 ? 35 - days.length : 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  // Group tasks by date key
  const tasksByDate = useMemo(() => {
    const map = new Map<string, TaskWithRelations[]>();
    for (const task of filteredTasks) {
      if (!task.due_date) continue;
      const key = toDateKey(new Date(task.due_date));
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(task);
    }
    return map;
  }, [filteredTasks]);

  // Tasks without due_date
  const undatedTasks = useMemo(
    () => filteredTasks.filter((t) => !t.due_date),
    [filteredTasks]
  );

  const today = todayKey();

  return (
    <>
      {/* Stats Bar */}
      <BoardStatsBar stats={stats} activeFilter={quickFilter} onFilterChange={setQuickFilter} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-[160px] pl-8"
            placeholder="Görev ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
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

        <span className="text-xs text-muted-foreground">
          {filteredTasks.length} görev
        </span>
      </div>

      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h2 className="min-w-[160px] text-center text-lg font-semibold text-vw-dark">
              {MONTH_NAMES[month]} {year}
            </h2>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={goToday}>
            Bugün
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="overflow-x-auto rounded-lg border bg-card">
          {/* Day names header */}
          <div className="grid grid-cols-7 border-b bg-muted/50">
            {DAY_NAMES.map((name) => (
              <div
                key={name}
                className="px-2 py-2 text-center text-xs font-medium text-muted-foreground"
              >
                {name}
              </div>
            ))}
          </div>

          {/* Weeks */}
          <div className="grid grid-cols-7">
            {calendarDays.map(({ date, isCurrentMonth }, i) => {
              const key = toDateKey(date);
              const isToday = key === today;
              const dayTasks = tasksByDate.get(key) ?? [];

              return (
                <div
                  key={i}
                  className={cn(
                    "min-h-[100px] border-b border-r p-1 transition-colors",
                    !isCurrentMonth && "bg-muted/20",
                    isToday && "bg-blue-50/50",
                    i % 7 === 6 && "border-r-0"
                  )}
                >
                  {/* Day number */}
                  <div className="mb-1 flex justify-end">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs",
                        isToday
                          ? "bg-vw-primary font-bold text-vw-dark"
                          : isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/50"
                      )}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Task chips */}
                  <div className="flex flex-col gap-0.5">
                    {dayTasks.slice(0, 3).map((task) => (
                      <TaskChip
                        key={task.id}
                        task={task}
                        agentIdSet={agentIdSet}
                        onClick={() => setSelectedTaskId(task.id)}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="px-1 text-[10px] text-muted-foreground">
                        +{dayTasks.length - 3} daha
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Undated tasks */}
        {undatedTasks.length > 0 && (
          <div className="rounded-lg border bg-card p-3">
            <h3 className="mb-2 text-sm font-medium text-muted-foreground">
              Tarihi Belirsiz ({undatedTasks.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {undatedTasks.map((task) => (
                <TaskChip
                  key={task.id}
                  task={task}
                  agentIdSet={agentIdSet}
                  onClick={() => setSelectedTaskId(task.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedTaskId && (
        <TaskDetailSheet
          taskId={selectedTaskId}
          users={users}
          agents={agents}
          open={!!selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
        />
      )}
    </>
  );
}

function TaskChip({
  task,
  agentIdSet,
  onClick,
}: {
  task: TaskWithRelations;
  agentIdSet: Set<string>;
  onClick: () => void;
}) {
  const colors = TASK_STATUS_COLORS[task.status as TaskStatus];
  const isAgent = task.assigned_to ? agentIdSet.has(task.assigned_to) : false;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-tight truncate max-w-full text-left transition-opacity hover:opacity-80",
        colors.bg,
        colors.text
      )}
      title={task.title}
    >
      {isAgent && <Bot className="h-2.5 w-2.5 shrink-0" />}
      {task.is_blocked && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
      )}
      {task.is_waiting_approval && (
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-purple-500 shrink-0" />
      )}
      <span className="truncate">{task.title}</span>
    </button>
  );
}
