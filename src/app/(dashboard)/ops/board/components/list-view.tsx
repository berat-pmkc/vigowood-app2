"use client";

import { useState, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Bot,
  ShieldAlert,
  Clock,
  Calendar,
  Search,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
  TASK_DEPARTMENTS,
  TASK_DEPARTMENT_LABELS,
  TASK_DEPARTMENT_COLORS,
  type TaskStatus,
  type TaskPriority,
  type TaskDepartment,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { TaskWithRelations, BoardStats } from "../../actions";
import { TaskDetailSheet } from "./task-detail-sheet";
import { BoardStatsBar, type QuickFilter } from "./board-stats-bar";

type User = { user_id: string; full_name: string; role: string };
type Agent = { id: string; name: string; code: string; department: string; status: string };

type SortField = "title" | "priority" | "department" | "created_at" | "due_date";
type SortDir = "asc" | "desc";
type AssigneeFilterMode = "all" | "users" | "agents";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

interface ListViewProps {
  tasks: TaskWithRelations[];
  users: User[];
  agents: Agent[];
  stats: BoardStats;
}

export function ListView({ tasks, users, agents, stats }: ListViewProps) {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("due_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Filters
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilterMode, setAssigneeFilterMode] = useState<AssigneeFilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");

  const agentIdSet = useMemo(() => new Set(agents.map((a) => a.id)), [agents]);
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLocaleLowerCase("tr");
    return tasks.filter((t) => {
      if (deptFilter !== "all" && t.department !== deptFilter) return false;
      if (assigneeFilter !== "all" && t.assigned_to !== assigneeFilter) return false;
      if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
      if (assigneeFilterMode === "users" && t.assigned_to && agentIdSet.has(t.assigned_to)) return false;
      if (assigneeFilterMode === "agents" && t.assigned_to && !agentIdSet.has(t.assigned_to)) return false;
      if (q && !t.title.toLocaleLowerCase("tr").includes(q)) return false;
      if (quickFilter === "overdue" && !(t.due_date && t.due_date < today && t.status !== "done")) return false;
      if (quickFilter === "blocked" && !t.is_blocked) return false;
      if (quickFilter === "due_today" && t.due_date !== today) return false;
      return true;
    });
  }, [tasks, deptFilter, assigneeFilter, priorityFilter, assigneeFilterMode, agentIdSet, searchQuery, quickFilter, today]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const toggleGroup = (status: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  };

  const sortedTasks = useMemo(() => {
    const sorted = [...filteredTasks].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "title":
          cmp = a.title.localeCompare(b.title, "tr");
          break;
        case "priority":
          cmp = (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99);
          break;
        case "department":
          cmp = (a.department ?? "").localeCompare(b.department ?? "", "tr");
          break;
        case "created_at":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "due_date": {
          const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
          const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
          cmp = da - db;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [filteredTasks, sortField, sortDir]);

  // Group by status
  const groupedTasks = useMemo(() => {
    const groups: { status: TaskStatus; tasks: TaskWithRelations[] }[] = [];
    for (const status of TASK_STATUSES) {
      const statusTasks = sortedTasks.filter((t) => t.status === status);
      if (statusTasks.length > 0) {
        groups.push({ status, tasks: statusTasks });
      }
    }
    return groups;
  }, [sortedTasks]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const isOverdue = (d: string | null, status: string) =>
    d && status !== "done" && new Date(d) < new Date(new Date().toDateString());

  const getAssigneeDisplay = (task: TaskWithRelations) => {
    if (!task.assigned_to) return null;
    if (agentIdSet.has(task.assigned_to)) {
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
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="ml-1 h-3 w-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 h-3 w-3" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3" />
    );
  };

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

      {/* Table */}
      {filteredTasks.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border bg-card py-16">
          <p className="text-sm text-muted-foreground">Görev bulunamadı</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="w-[100px] px-3 py-2 text-left font-medium text-muted-foreground">
                  Durum
                </th>
                <th className="min-w-[200px] px-3 py-2 text-left">
                  <button
                    onClick={() => toggleSort("title")}
                    className="flex items-center font-medium text-muted-foreground hover:text-foreground"
                  >
                    Başlık
                    <SortIcon field="title" />
                  </button>
                </th>
                <th className="w-[100px] px-3 py-2 text-left">
                  <button
                    onClick={() => toggleSort("priority")}
                    className="flex items-center font-medium text-muted-foreground hover:text-foreground"
                  >
                    Öncelik
                    <SortIcon field="priority" />
                  </button>
                </th>
                <th className="w-[150px] px-3 py-2 text-left font-medium text-muted-foreground">
                  Atanan
                </th>
                <th className="w-[120px] px-3 py-2 text-left">
                  <button
                    onClick={() => toggleSort("department")}
                    className="flex items-center font-medium text-muted-foreground hover:text-foreground"
                  >
                    Departman
                    <SortIcon field="department" />
                  </button>
                </th>
                <th className="w-[110px] px-3 py-2 text-left">
                  <button
                    onClick={() => toggleSort("created_at")}
                    className="flex items-center font-medium text-muted-foreground hover:text-foreground"
                  >
                    Oluşturulma
                    <SortIcon field="created_at" />
                  </button>
                </th>
                <th className="w-[110px] px-3 py-2 text-left">
                  <button
                    onClick={() => toggleSort("due_date")}
                    className="flex items-center font-medium text-muted-foreground hover:text-foreground"
                  >
                    Son Tarih
                    <SortIcon field="due_date" />
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {groupedTasks.map(({ status, tasks: groupTasks }) => {
                const colors = TASK_STATUS_COLORS[status];
                const isCollapsed = collapsedGroups.has(status);

                return (
                  <GroupRows
                    key={status}
                    label={TASK_STATUS_LABELS[status]}
                    colors={colors}
                    count={groupTasks.length}
                    isCollapsed={isCollapsed}
                    onToggle={() => toggleGroup(status)}
                  >
                    {!isCollapsed &&
                      groupTasks.map((task) => {
                        const priorityColors =
                          TASK_PRIORITY_COLORS[task.priority as TaskPriority];
                        const deptColors =
                          TASK_DEPARTMENT_COLORS[task.department as TaskDepartment];
                        const assignee = getAssigneeDisplay(task);
                        const overdue = isOverdue(task.due_date, task.status);

                        return (
                          <tr
                            key={task.id}
                            onClick={() => setSelectedTaskId(task.id)}
                            className="cursor-pointer border-b last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}
                              >
                                {TASK_STATUS_LABELS[status]}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium truncate max-w-[300px]">
                                  {task.title}
                                </span>
                                {task.is_blocked && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-red-100 px-1 py-0.5 text-[10px] font-medium text-red-700 shrink-0">
                                    <ShieldAlert className="h-3 w-3" />
                                    Engellendi
                                  </span>
                                )}
                                {task.is_waiting_approval && (
                                  <span className="inline-flex items-center gap-0.5 rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium text-purple-700 shrink-0">
                                    <Clock className="h-3 w-3" />
                                    Onay Bekliyor
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${priorityColors.bg} ${priorityColors.text}`}
                              >
                                {TASK_PRIORITY_LABELS[task.priority as TaskPriority]}
                              </span>
                            </td>
                            <td className="px-3 py-2">
                              {assignee?.type === "agent" ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                                    <Bot className="h-3 w-3" />
                                  </div>
                                  <span className="text-xs truncate max-w-[100px]">
                                    {assignee.name}
                                  </span>
                                </div>
                              ) : assignee?.type === "user" ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-vw-primary text-[8px] font-bold text-vw-dark">
                                    {assignee.initials}
                                  </div>
                                  <span className="text-xs truncate max-w-[100px]">
                                    {assignee.name}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${deptColors.bg} ${deptColors.text}`}
                              >
                                {TASK_DEPARTMENT_LABELS[task.department as TaskDepartment]}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {formatDate(task.created_at)}
                            </td>
                            <td className="px-3 py-2">
                              {task.due_date ? (
                                <span
                                  className={cn(
                                    "flex items-center gap-1 text-xs",
                                    overdue
                                      ? "font-medium text-red-600"
                                      : "text-muted-foreground"
                                  )}
                                >
                                  <Calendar className="h-3 w-3" />
                                  {formatDate(task.due_date)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </GroupRows>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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

function GroupRows({
  label,
  colors,
  count,
  isCollapsed,
  onToggle,
  children,
}: {
  label: string;
  colors: { bg: string; text: string };
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <td colSpan={7} className="px-3 py-2">
          <div className="flex items-center gap-2">
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <span
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${colors.bg} ${colors.text}`}
            >
              {label}
            </span>
            <span className="text-xs text-muted-foreground">
              {count} görev
            </span>
          </div>
        </td>
      </tr>
      {children}
    </>
  );
}
