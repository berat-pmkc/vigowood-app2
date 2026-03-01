"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type {
  TaskStatus,
  TaskPriority,
  TaskDepartment,
  TaskSourceType,
  TaskActivityAction,
  OutputFileType,
  AgentStatus,
} from "@/lib/constants";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Yetkisiz erişim");
  return user;
}

// Agent code aliases — eski kayıtlarla geriye uyumluluk
const AGENT_CODE_ALIASES: Record<string, string[]> = {
  "pazaryeri-asistan": ["vigowood-com-asistan"],
};

// Reverse map: eski code → güncel code
const AGENT_CODE_REVERSE: Record<string, string> = {};
for (const [current, aliases] of Object.entries(AGENT_CODE_ALIASES)) {
  for (const alias of aliases) {
    AGENT_CODE_REVERSE[alias] = current;
  }
}

/** Bir agent code için tüm bilinen code'ları döndürür (mevcut + eski) */
function getAgentCodes(code: string): string[] {
  return [code, ...(AGENT_CODE_ALIASES[code] ?? [])];
}

/** Eski code'u güncel code'a normalize eder */
function normalizeAgentCode(code: string): string {
  return AGENT_CODE_REVERSE[code] ?? code;
}

// ─── Task Types ─────────────────────────────────────────────

export type TaskWithRelations = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  created_by: string;
  department: TaskDepartment;
  due_date: string | null;
  parent_id: string | null;
  source_type: string;
  source_id: string | null;
  is_blocked: boolean;
  is_waiting_approval: boolean;
  created_at: string;
  updated_at: string;
  assignee_name?: string | null;
  creator_name?: string | null;
  subtask_count?: number;
  subtask_done_count?: number;
  attachment_count?: number;
  comment_count?: number;
};

export type TaskComment = {
  id: string;
  task_id: string;
  author_id: string;
  content: string;
  created_at: string;
  is_agent?: boolean;
  author_name?: string;
};

export type TaskAttachment = {
  id: string;
  task_id: string;
  file_url: string;
  file_name: string;
  file_size: number | null;
  uploaded_by: string;
  created_at: string;
  uploader_name?: string;
};

export type TaskActivity = {
  id: string;
  task_id: string;
  actor_id: string;
  action: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
  actor_name?: string;
};

// ─── Fetch Tasks ─────────────────────────────────────────────

export async function getTasks(filters?: {
  department?: string;
  assigned_to?: string;
  priority?: string;
  status?: string;
  excludeDone?: boolean;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.department && filters.department !== "all") {
    query = query.eq("department", filters.department as TaskDepartment);
  }
  if (filters?.assigned_to) {
    query = query.eq("assigned_to", filters.assigned_to);
  }
  if (filters?.priority && filters.priority !== "all") {
    query = query.eq("priority", filters.priority as TaskPriority);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status as TaskStatus);
  }
  if (filters?.excludeDone) {
    query = query.neq("status", "done" as TaskStatus);
  }

  const { data: tasks, error } = await query;
  if (error) throw error;

  if (!tasks || tasks.length === 0) return [];

  // Get user names for assigned_to and created_by
  const userIds = new Set<string>();
  for (const t of tasks) {
    if (t.assigned_to) userIds.add(t.assigned_to);
    if (t.created_by) userIds.add(t.created_by);
  }

  const { data: users } = await supabase
    .from("users")
    .select("user_id, full_name")
    .in("user_id", Array.from(userIds));

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);

  // Get subtask counts
  const taskIds = tasks.map((t) => t.id);
  const { data: subtasks } = await supabase
    .from("tasks")
    .select("parent_id, status")
    .in("parent_id", taskIds);

  const subtaskCounts = new Map<string, { total: number; done: number }>();
  for (const st of subtasks ?? []) {
    if (!st.parent_id) continue;
    const existing = subtaskCounts.get(st.parent_id) ?? { total: 0, done: 0 };
    existing.total++;
    if (st.status === "done") existing.done++;
    subtaskCounts.set(st.parent_id, existing);
  }

  // Get attachment counts
  const { data: attachCounts } = await supabase
    .from("task_attachments")
    .select("task_id")
    .in("task_id", taskIds);

  const attachMap = new Map<string, number>();
  for (const a of attachCounts ?? []) {
    attachMap.set(a.task_id, (attachMap.get(a.task_id) ?? 0) + 1);
  }

  // Get comment counts
  const { data: commentCounts } = await supabase
    .from("task_comments")
    .select("task_id")
    .in("task_id", taskIds);

  const commentMap = new Map<string, number>();
  for (const c of commentCounts ?? []) {
    commentMap.set(c.task_id, (commentMap.get(c.task_id) ?? 0) + 1);
  }

  return tasks.map((t) => ({
    ...t,
    assignee_name: t.assigned_to ? userMap.get(t.assigned_to) ?? null : null,
    creator_name: userMap.get(t.created_by) ?? null,
    subtask_count: subtaskCounts.get(t.id)?.total ?? 0,
    subtask_done_count: subtaskCounts.get(t.id)?.done ?? 0,
    attachment_count: attachMap.get(t.id) ?? 0,
    comment_count: commentMap.get(t.id) ?? 0,
  })) as TaskWithRelations[];
}

export async function getTaskById(taskId: string) {
  const supabase = await createClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (error) return null;

  // Get user names
  const userIds = [task.created_by];
  if (task.assigned_to) userIds.push(task.assigned_to);

  const { data: users } = await supabase
    .from("users")
    .select("user_id, full_name")
    .in("user_id", userIds);

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);

  return {
    ...task,
    assignee_name: task.assigned_to ? userMap.get(task.assigned_to) ?? null : null,
    creator_name: userMap.get(task.created_by) ?? null,
  } as TaskWithRelations;
}

// ─── Create Task ─────────────────────────────────────────────

export async function createTask(data: {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigned_to?: string | null;
  department?: TaskDepartment;
  due_date?: string | null;
  parent_id?: string | null;
  source_type?: TaskSourceType;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const sourceType: TaskSourceType = data.source_type ?? "manual";

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      title: data.title,
      description: data.description ?? null,
      status: data.status ?? ("queue" as TaskStatus),
      priority: data.priority ?? ("medium" as TaskPriority),
      assigned_to: data.assigned_to ?? null,
      created_by: user.user_id,
      department: data.department ?? ("genel" as TaskDepartment),
      due_date: data.due_date ?? null,
      parent_id: data.parent_id ?? null,
      source_type: sourceType,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  // Log activity
  await supabase.from("task_activity").insert({
    task_id: task.id,
    actor_id: user.user_id,
    action: "created" as TaskActivityAction,
    new_value: data.title,
  });

  revalidatePath("/ops/board");


  return { success: true, taskId: task.id };
}

// ─── Update Task ─────────────────────────────────────────────

export async function updateTask(
  taskId: string,
  data: {
    title?: string;
    description?: string | null;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigned_to?: string | null;
    department?: TaskDepartment;
    due_date?: string | null;
    is_blocked?: boolean;
    is_waiting_approval?: boolean;
  }
) {
  const user = await requireUser();
  const supabase = await createClient();

  // Get current task for activity log
  const { data: current } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (!current) return { success: false, error: "Görev bulunamadı" };

  const { error } = await supabase
    .from("tasks")
    .update(data)
    .eq("id", taskId);

  if (error) return { success: false, error: error.message };

  // Log activities
  const activities: Array<{
    task_id: string;
    actor_id: string;
    action: TaskActivityAction;
    old_value: string | null;
    new_value: string | null;
  }> = [];

  if (data.status && data.status !== current.status) {
    activities.push({
      task_id: taskId,
      actor_id: user.user_id,
      action: "status_changed",
      old_value: current.status,
      new_value: data.status,
    });
  }

  if (data.priority && data.priority !== current.priority) {
    activities.push({
      task_id: taskId,
      actor_id: user.user_id,
      action: "priority_changed",
      old_value: current.priority,
      new_value: data.priority,
    });
  }

  if (data.assigned_to !== undefined && data.assigned_to !== current.assigned_to) {
    activities.push({
      task_id: taskId,
      actor_id: user.user_id,
      action: "assigned",
      old_value: current.assigned_to,
      new_value: data.assigned_to,
    });
  }

  if (activities.length > 0) {
    await supabase.from("task_activity").insert(activities);
  }

  revalidatePath("/ops/board");


  return { success: true };
}

// ─── Delete Task ─────────────────────────────────────────────

export async function deleteTask(taskId: string) {
  const user = await requireUser();
  if (user.role !== "Yönetici" && user.role !== "Endüstri Mühendisi") {
    return { success: false, error: "Sadece yöneticiler görev silebilir" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/board");


  return { success: true };
}

// ─── Comments ────────────────────────────────────────────────

export async function getTaskComments(taskId: string) {
  const supabase = await createClient();

  const { data: comments, error } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) return [];

  const authorIds = [...new Set(comments.map((c) => c.author_id))];

  const [{ data: users }, { data: agents }] = await Promise.all([
    supabase
      .from("users")
      .select("user_id, full_name")
      .in("user_id", authorIds),
    supabase
      .from("ops_agents")
      .select("id, name")
      .in("id", authorIds),
  ]);

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);
  const agentMap = new Map(agents?.map((a) => [a.id, a.name]) ?? []);

  return comments.map((c) => ({
    ...c,
    author_name: userMap.get(c.author_id) ?? agentMap.get(c.author_id) ?? "Sistem",
    is_agent: agentMap.has(c.author_id),
  })) as TaskComment[];
}

export async function addTaskComment(taskId: string, content: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("task_comments").insert({
    task_id: taskId,
    author_id: user.user_id,
    content,
  });

  if (error) return { success: false, error: error.message };

  // Log activity
  await supabase.from("task_activity").insert({
    task_id: taskId,
    actor_id: user.user_id,
    action: "commented" as TaskActivityAction,
    new_value: content.slice(0, 100),
  });

  revalidatePath("/ops/board");
  return { success: true };
}

// ─── Attachments ─────────────────────────────────────────────

export async function getTaskAttachments(taskId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_attachments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) return [];

  const uploaderIds = [...new Set(data.map((a) => a.uploaded_by))];
  const { data: users } = await supabase
    .from("users")
    .select("user_id, full_name")
    .in("user_id", uploaderIds);

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);

  return data.map((a) => ({
    ...a,
    uploader_name: userMap.get(a.uploaded_by) ?? "Bilinmeyen",
  })) as TaskAttachment[];
}

export async function addTaskAttachment(taskId: string, formData: FormData) {
  const user = await requireUser();
  const supabase = await createClient();

  const file = formData.get("file") as File;
  if (!file) return { success: false, error: "Dosya seçilmedi" };

  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${taskId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("task-attachments")
    .upload(path, file);

  if (uploadError) return { success: false, error: uploadError.message };

  const { data: urlData } = supabase.storage
    .from("task-attachments")
    .getPublicUrl(path);

  const { error } = await supabase.from("task_attachments").insert({
    task_id: taskId,
    file_url: urlData.publicUrl,
    file_name: file.name,
    file_size: file.size,
    uploaded_by: user.user_id,
  });

  if (error) return { success: false, error: error.message };

  // Log activity
  await supabase.from("task_activity").insert({
    task_id: taskId,
    actor_id: user.user_id,
    action: "file_added" as TaskActivityAction,
    new_value: file.name,
  });

  revalidatePath("/ops/board");
  return { success: true };
}

export async function deleteTaskAttachment(attachmentId: string) {
  const user = await requireUser();
  if (user.role !== "Yönetici" && user.role !== "Endüstri Mühendisi") {
    return { success: false, error: "Yetkiniz yok" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/board");
  return { success: true };
}

// ─── Activity ────────────────────────────────────────────────

export async function getTaskActivity(taskId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_activity")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) return [];

  const actorIds = [...new Set(data.map((a) => a.actor_id))];
  const { data: users } = await supabase
    .from("users")
    .select("user_id, full_name")
    .in("user_id", actorIds);

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);

  return data.map((a) => ({
    ...a,
    actor_name: userMap.get(a.actor_id) ?? "Bilinmeyen",
  })) as TaskActivity[];
}


// ─── Subtasks ────────────────────────────────────────────────

export async function getSubtasks(parentId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("parent_id", parentId)
    .order("created_at", { ascending: true });

  if (error) return [];

  const userIds = new Set<string>();
  for (const t of data) {
    if (t.assigned_to) userIds.add(t.assigned_to);
    if (t.created_by) userIds.add(t.created_by);
  }

  const { data: users } = await supabase
    .from("users")
    .select("user_id, full_name")
    .in("user_id", Array.from(userIds));

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);

  return data.map((t) => ({
    ...t,
    assignee_name: t.assigned_to ? userMap.get(t.assigned_to) ?? null : null,
    creator_name: userMap.get(t.created_by) ?? null,
    subtask_count: 0,
    subtask_done_count: 0,
    attachment_count: 0,
    comment_count: 0,
  })) as TaskWithRelations[];
}

// ─── Users List (for assignment) ─────────────────────────────

export async function getAssignableUsers() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("users")
    .select("user_id, full_name, role")
    .eq("is_active", true)
    .eq("can_be_ops_assignee", true)
    .order("full_name");

  if (error) return [];
  return data;
}

// ─── Board Stats (lightweight) ───────────────────────────────

export type BoardStats = {
  openCount: number;
  dueTodayCount: number;
  overdueCount: number;
  blockedCount: number;
};

export async function getBoardStats(): Promise<BoardStats> {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: openCount },
    { count: dueTodayCount },
    { count: overdueCount },
    { count: blockedCount },
  ] = await Promise.all([
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .not("status", "eq", "done"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("due_date", today)
      .not("status", "eq", "done"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .lt("due_date", today)
      .not("status", "eq", "done"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("is_blocked", true)
      .not("status", "eq", "done"),
  ]);

  return {
    openCount: openCount ?? 0,
    dueTodayCount: dueTodayCount ?? 0,
    overdueCount: overdueCount ?? 0,
    blockedCount: blockedCount ?? 0,
  };
}

// ─── Agent Types ────────────────────────────────────────────

export type OpsAgent = {
  id: string;
  name: string;
  code: string;
  department: string;
  description: string | null;
  avatar_url: string | null;
  capabilities: string[];
  schedule: Record<string, string>;
  status: AgentStatus;
  is_active: boolean;
  total_tasks_completed: number;
  total_approvals_requested: number;
  total_outputs_generated: number;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OpsOutput = {
  id: string;
  task_id: string | null;
  agent_id: string | null;
  file_type: OutputFileType;
  file_name: string;
  file_url: string;
  file_size: number | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  creator_name?: string;
  agent_name?: string;
};

// ─── Agents ─────────────────────────────────────────────────

export async function getAgents(filters?: { department?: string; status?: string }) {
  const supabase = await createClient();

  let query = supabase
    .from("ops_agents")
    .select("*")
    .order("name");

  if (filters?.department && filters.department !== "all") {
    query = query.eq("department", filters.department);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status as AgentStatus);
  }

  const { data, error } = await query;
  if (error) return [];

  return (data ?? []).map((a) => ({
    ...a,
    capabilities: Array.isArray(a.capabilities) ? a.capabilities as string[] : [],
    schedule: (a.schedule ?? {}) as Record<string, string>,
  })) as OpsAgent[];
}

export async function getAgentById(agentId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ops_agents")
    .select("*")
    .eq("id", agentId)
    .single();

  if (error || !data) return null;

  return {
    ...data,
    capabilities: Array.isArray(data.capabilities) ? data.capabilities as string[] : [],
    schedule: (data.schedule ?? {}) as Record<string, string>,
  } as OpsAgent;
}

export async function updateAgent(
  agentId: string,
  data: { status?: AgentStatus; is_active?: boolean; description?: string }
) {
  const user = await requireUser();
  if (user.role !== "Yönetici" && user.role !== "Endüstri Mühendisi") {
    return { success: false, error: "Yetkiniz yok" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ops_agents")
    .update(data)
    .eq("id", agentId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/ajanlar");
  revalidatePath("/ops/board");
  return { success: true };
}

// ─── Agent Info (for detail sheet — checks if UUID belongs to an agent) ─────

export async function getAgentInfo(agentId: string | null) {
  if (!agentId) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_agents")
    .select("id, name, code, department")
    .eq("id", agentId)
    .single();
  return data ?? null;
}

// ─── Task Output (for detail sheet) ─────────────────────────

export async function getTaskOutput(taskId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ops_outputs")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .limit(1);
  return data?.[0] ?? null;
}

// ─── Outputs ────────────────────────────────────────────────

export async function getOutputs(filters?: {
  file_type?: string;
  agent_id?: string;
}) {
  const supabase = await createClient();

  let query = supabase
    .from("ops_outputs")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters?.file_type && filters.file_type !== "all") {
    query = query.eq("file_type", filters.file_type as OutputFileType);
  }
  if (filters?.agent_id && filters.agent_id !== "all") {
    query = query.eq("agent_id", filters.agent_id);
  }

  const { data, error } = await query;
  if (error) return [];

  if (!data || data.length === 0) return [];

  const userIds = new Set<string>();
  const agentIds = new Set<string>();

  for (const o of data) {
    if (o.created_by) userIds.add(o.created_by);
    if (o.agent_id) agentIds.add(o.agent_id);
  }

  const [{ data: users }, { data: agents }] = await Promise.all([
    supabase.from("users").select("user_id, full_name").in("user_id", Array.from(userIds)),
    agentIds.size > 0
      ? supabase.from("ops_agents").select("id, name").in("id", Array.from(agentIds))
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);
  const agentMap = new Map(agents?.map((a) => [a.id, a.name]) ?? []);

  return data.map((o) => ({
    ...o,
    metadata: (o.metadata ?? {}) as Record<string, unknown>,
    creator_name: userMap.get(o.created_by) ?? agentMap.get(o.created_by) ?? o.created_by,
    agent_name: o.agent_id ? agentMap.get(o.agent_id) ?? null : null,
  })) as OpsOutput[];
}

export async function deleteOutput(outputId: string) {
  const user = await requireUser();
  if (user.role !== "Yönetici" && user.role !== "Endüstri Mühendisi") {
    return { success: false, error: "Yetkiniz yok" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("ops_outputs")
    .delete()
    .eq("id", outputId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/raporlar");
  return { success: true };
}

// ─── Assignable Agents (for task assignment) ────────────────

export async function getAssignableAgents() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("ops_agents")
    .select("id, name, code, department, status")
    .eq("is_active", true)
    .eq("status", "active")
    .order("name");

  if (error) return [];
  return data;
}


// ─── Task Templates ──────────────────────────────────────────

export async function getTaskTemplates() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_templates")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function createTaskTemplate(data: {
  title: string;
  description?: string | null;
  department?: TaskDepartment;
  priority?: TaskPriority;
  assignee_id?: string | null;
  checklist?: { text: string; done: boolean }[];
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("task_templates").insert({
    title: data.title,
    description: data.description ?? null,
    department: data.department ?? "genel",
    priority: data.priority ?? "medium",
    assignee_id: data.assignee_id ?? null,
    checklist: data.checklist ?? [],
    created_by: user.user_id,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/board");
  return { success: true };
}

export async function updateTaskTemplate(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    department?: TaskDepartment;
    priority?: TaskPriority;
    assignee_id?: string | null;
    checklist?: { text: string; done: boolean }[];
  }
) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("task_templates")
    .update(data)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/board");
  return { success: true };
}

export async function deleteTaskTemplate(id: string) {
  const user = await requireUser();
  if (user.role !== "Yönetici" && user.role !== "Endüstri Mühendisi") {
    return { success: false, error: "Yetkiniz yok" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("task_templates").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/board");
  return { success: true };
}

export async function createTaskFromTemplate(
  templateId: string,
  overrides?: {
    title?: string;
    assigned_to?: string | null;
    due_date?: string | null;
  }
) {
  const supabase = await createClient();

  const { data: template, error: tErr } = await supabase
    .from("task_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (tErr || !template) return { success: false, error: "Şablon bulunamadı" };

  return createTask({
    title: overrides?.title ?? template.title,
    description: template.description,
    status: "queue" as TaskStatus,
    priority: template.priority as TaskPriority,
    assigned_to: overrides?.assigned_to ?? template.assignee_id,
    department: template.department as TaskDepartment,
    due_date: overrides?.due_date ?? null,
  });
}

// ─── Recurring Tasks ──────────────────────────────────────────

export async function getRecurringTasks() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("recurring_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

export async function createRecurringTask(data: {
  title: string;
  description?: string | null;
  department?: TaskDepartment;
  priority?: TaskPriority;
  assignee_id?: string | null;
  cron_schedule: string;
  is_active?: boolean;
  template_id?: string | null;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const { error } = await supabase.from("recurring_tasks").insert({
    title: data.title,
    description: data.description ?? null,
    department: data.department ?? "genel",
    priority: data.priority ?? "medium",
    assignee_id: data.assignee_id ?? null,
    cron_schedule: data.cron_schedule,
    is_active: data.is_active ?? true,
    template_id: data.template_id ?? null,
    created_by: user.user_id,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/board");
  return { success: true };
}

export async function updateRecurringTask(
  id: string,
  data: {
    title?: string;
    description?: string | null;
    department?: TaskDepartment;
    priority?: TaskPriority;
    assignee_id?: string | null;
    cron_schedule?: string;
    is_active?: boolean;
  }
) {
  await requireUser();
  const supabase = await createClient();

  const { error } = await supabase
    .from("recurring_tasks")
    .update(data)
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/board");
  return { success: true };
}

export async function deleteRecurringTask(id: string) {
  const user = await requireUser();
  if (user.role !== "Yönetici" && user.role !== "Endüstri Mühendisi") {
    return { success: false, error: "Yetkiniz yok" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("recurring_tasks").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/board");
  return { success: true };
}

export async function getTaskRuns(recurringTaskId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_runs")
    .select("*")
    .eq("recurring_task_id", recurringTaskId)
    .order("run_number", { ascending: false })
    .limit(50);

  if (error) return [];
  return data ?? [];
}

// ─── Usage Stats ──────────────────────────────────────────────

export async function getAgentActionsForTask(taskId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agent_actions")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data ?? [];
}

// ─── Usage Stats ──────────────────────────────────────────────

export async function getUsageStats(period: "day" | "week" | "month" = "week") {
  const supabase = await createClient();

  const now = new Date();
  let since: Date;
  if (period === "day") {
    since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  } else if (period === "week") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const { data: actions, error } = await supabase
    .from("agent_actions")
    .select("*")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) return { totalCost: 0, agents: [], actions: [] };

  const agentStats = new Map<
    string,
    {
      agent_id: string;
      total_tokens: number;
      total_cost: number;
      action_count: number;
    }
  >();

  let totalCost = 0;

  for (const a of actions ?? []) {
    totalCost += (a.cost_estimate ?? 0);
    // Eski code'ları güncel code'a normalize et (birleştir)
    const id = normalizeAgentCode(a.agent_id ?? "unknown");
    const existing = agentStats.get(id) ?? {
      agent_id: id,
      total_tokens: 0,
      total_cost: 0,
      action_count: 0,
    };
    existing.total_tokens += (a.tokens_used ?? 0);
    existing.total_cost += (a.cost_estimate ?? 0);
    existing.action_count++;
    agentStats.set(id, existing);
  }

  // Resolve agent names
  const agentIds = [...agentStats.keys()].filter((id) => id !== "unknown");
  let agentMap = new Map<string, string>();
  if (agentIds.length > 0) {
    const { data: agents } = await supabase
      .from("ops_agents")
      .select("code, name")
      .in("code", agentIds);
    agentMap = new Map(agents?.map((a) => [a.code, a.name]) ?? []);
  }

  const agentList = [...agentStats.values()].map((s) => ({
    ...s,
    agent_name: agentMap.get(s.agent_id) ?? s.agent_id,
  }));

  return {
    totalCost,
    agents: agentList.sort((a, b) => b.total_cost - a.total_cost),
    actions: actions ?? [],
  };
}

// ─── Agent Detail Actions ──────────────────────────────────────

export type AgentMemoryItem = {
  id: string;
  agent_id: string;
  memory_type: string;
  key: string;
  value: Record<string, unknown>;
  context: string | null;
  confidence: number;
  source: string | null;
  is_active: boolean;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function getAgentMemories(agentCode: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("agent_memory")
    .select("*")
    .in("agent_id", getAgentCodes(agentCode))
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []) as AgentMemoryItem[];
}

export async function deleteAgentMemory(memoryId: string) {
  const user = await requireUser();
  if (user.role !== "Yönetici" && user.role !== "Endüstri Mühendisi") {
    return { success: false, error: "Yetkiniz yok" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("agent_memory")
    .delete()
    .eq("id", memoryId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/ops/ajanlar");
  return { success: true };
}

export type AgentPerformance = {
  totalCompletedTasks: number;
  avgTaskDurationHours: number;
  totalTokensUsed: number;
  dailyTrend: { date: string; count: number }[];
};

export async function getAgentPerformance(agentCode: string): Promise<AgentPerformance> {
  const supabase = await createClient();

  // Tasks assigned to this agent (eski + yeni code)
  const codes = getAgentCodes(agentCode);
  const { data: doneTasks } = await supabase
    .from("tasks")
    .select("created_at, updated_at")
    .in("assigned_to", codes)
    .eq("status", "done");

  const totalCompletedTasks = doneTasks?.length ?? 0;

  // Average task duration in hours
  let avgTaskDurationHours = 0;
  if (doneTasks && doneTasks.length > 0) {
    const totalMs = doneTasks.reduce((sum, t) => {
      const created = new Date(t.created_at).getTime();
      const updated = new Date(t.updated_at).getTime();
      return sum + (updated - created);
    }, 0);
    avgTaskDurationHours = totalMs / doneTasks.length / (1000 * 60 * 60);
  }

  // Total tokens from agent_actions
  const { data: actions } = await supabase
    .from("agent_actions")
    .select("tokens_used")
    .in("agent_id", codes);

  const totalTokensUsed = actions?.reduce((sum, a) => sum + (a.tokens_used ?? 0), 0) ?? 0;

  // Daily completed tasks trend (last 7 days)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const { data: recentTasks } = await supabase
    .from("tasks")
    .select("updated_at")
    .in("assigned_to", codes)
    .eq("status", "done")
    .gte("updated_at", sevenDaysAgo.toISOString());

  const trendMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    trendMap.set(d.toISOString().split("T")[0], 0);
  }
  for (const t of recentTasks ?? []) {
    const day = new Date(t.updated_at).toISOString().split("T")[0];
    if (trendMap.has(day)) {
      trendMap.set(day, (trendMap.get(day) ?? 0) + 1);
    }
  }

  const dailyTrend = [...trendMap.entries()].map(([date, count]) => ({ date, count }));

  return { totalCompletedTasks, avgTaskDurationHours, totalTokensUsed, dailyTrend };
}

export type AgentCosts = {
  totalCost: number;
  thisMonthCost: number;
  lastMonthCost: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  dailyCosts: { date: string; cost: number }[];
};

export async function getAgentCosts(agentCode: string): Promise<AgentCosts> {
  const supabase = await createClient();

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const { data: allActions } = await supabase
    .from("agent_actions")
    .select("tokens_used, cost_estimate, created_at, metadata")
    .in("agent_id", getAgentCodes(agentCode))
    .order("created_at", { ascending: false });

  let totalCost = 0;
  let thisMonthCost = 0;
  let lastMonthCost = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const dailyCostMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dailyCostMap.set(d.toISOString().split("T")[0], 0);
  }

  for (const a of allActions ?? []) {
    const cost = Number(a.cost_estimate ?? 0);
    const tokens = a.tokens_used ?? 0;
    const createdAt = new Date(a.created_at);

    totalCost += cost;

    // Estimate input/output split (70/30 ratio as typical)
    totalInputTokens += Math.round(tokens * 0.7);
    totalOutputTokens += Math.round(tokens * 0.3);

    if (createdAt >= thisMonthStart) {
      thisMonthCost += cost;
    } else if (createdAt >= lastMonthStart && createdAt < thisMonthStart) {
      lastMonthCost += cost;
    }

    if (createdAt >= thirtyDaysAgo) {
      const day = createdAt.toISOString().split("T")[0];
      if (dailyCostMap.has(day)) {
        dailyCostMap.set(day, (dailyCostMap.get(day) ?? 0) + cost);
      }
    }
  }

  const dailyCosts = [...dailyCostMap.entries()].map(([date, cost]) => ({ date, cost }));

  return { totalCost, thisMonthCost, lastMonthCost, totalInputTokens, totalOutputTokens, dailyCosts };
}

export type AgentTaskItem = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  updated_at: string;
  duration_hours: number;
};

export async function getAgentTasks(agentCode: string): Promise<AgentTaskItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, status, created_at, updated_at")
    .in("assigned_to", getAgentCodes(agentCode))
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return [];

  return (data ?? []).map((t) => {
    const created = new Date(t.created_at).getTime();
    const updated = new Date(t.updated_at).getTime();
    const duration_hours = (updated - created) / (1000 * 60 * 60);
    return { ...t, duration_hours };
  }) as AgentTaskItem[];
}
