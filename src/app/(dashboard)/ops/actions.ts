"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import type { TaskStatus, TaskPriority, TaskDepartment, TaskSourceType, TaskActivityAction } from "@/lib/constants";

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Yetkisiz erişim");
  return user;
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
      status: data.status ?? ("open" as TaskStatus),
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

  revalidatePath("/ops");
  revalidatePath("/ops/board");
  revalidatePath("/ops/gorevlerim");

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

  revalidatePath("/ops");
  revalidatePath("/ops/board");
  revalidatePath("/ops/gorevlerim");

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

  revalidatePath("/ops");
  revalidatePath("/ops/board");
  revalidatePath("/ops/gorevlerim");

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
  const { data: users } = await supabase
    .from("users")
    .select("user_id, full_name")
    .in("user_id", authorIds);

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);

  return comments.map((c) => ({
    ...c,
    author_name: userMap.get(c.author_id) ?? "Bilinmeyen",
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

  revalidatePath("/ops");
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

  revalidatePath("/ops");
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

  revalidatePath("/ops");
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

export async function getRecentActivity(limit = 20) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("task_activity")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) return [];

  const actorIds = [...new Set(data.map((a) => a.actor_id))];
  const taskIds = [...new Set(data.map((a) => a.task_id))];

  const [{ data: users }, { data: tasks }] = await Promise.all([
    supabase.from("users").select("user_id, full_name").in("user_id", actorIds),
    supabase.from("tasks").select("id, title").in("id", taskIds),
  ]);

  const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);
  const taskMap = new Map(tasks?.map((t) => [t.id, t.title]) ?? []);

  return data.map((a) => ({
    ...a,
    actor_name: userMap.get(a.actor_id) ?? "Bilinmeyen",
    task_title: taskMap.get(a.task_id) ?? "Silinmiş görev",
  }));
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
    .order("full_name");

  if (error) return [];
  return data;
}

// ─── Dashboard Stats ─────────────────────────────────────────

export async function getOpsStats() {
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { count: openCount },
    { count: dueTodayCount },
    { count: waitingApprovalCount },
    { count: blockedCount },
    { data: overdueTasks },
    { data: todayDoneTasks },
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
      .eq("status", "waiting_approval"),
    supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "blocked"),
    supabase
      .from("tasks")
      .select("id, title, assigned_to, due_date, priority, department")
      .lt("due_date", today)
      .not("status", "eq", "done")
      .order("due_date", { ascending: true })
      .limit(20),
    supabase
      .from("tasks")
      .select("id, title")
      .eq("status", "done")
      .gte("updated_at", `${today}T00:00:00`)
      .limit(20),
  ]);

  // Get user names for overdue
  if (overdueTasks && overdueTasks.length > 0) {
    const userIds = [...new Set(overdueTasks.map((t) => t.assigned_to).filter((x): x is string => !!x))];
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const userMap = new Map(users?.map((u) => [u.user_id, u.full_name]) ?? []);
      for (const t of overdueTasks) {
        (t as Record<string, unknown>).assignee_name = t.assigned_to
          ? userMap.get(t.assigned_to) ?? null
          : null;
      }
    }
  }

  return {
    openCount: openCount ?? 0,
    dueTodayCount: dueTodayCount ?? 0,
    waitingApprovalCount: waitingApprovalCount ?? 0,
    blockedCount: blockedCount ?? 0,
    overdueTasks: overdueTasks ?? [],
    todayDoneTasks: todayDoneTasks ?? [],
  };
}
