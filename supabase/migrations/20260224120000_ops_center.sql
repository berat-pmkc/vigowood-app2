-- ============================================================
-- Ops Center: Task Management System
-- ============================================================

-- Enums
CREATE TYPE public.task_status AS ENUM (
  'backlog', 'open', 'in_progress', 'waiting_approval', 'blocked', 'done'
);

CREATE TYPE public.task_priority AS ENUM (
  'low', 'medium', 'high', 'urgent'
);

CREATE TYPE public.task_department AS ENUM (
  'uretim', 'stok', 'sevkiyat', 'muhasebe', 'pazaryeri', 'genel'
);

CREATE TYPE public.task_source_type AS ENUM (
  'manual', 'recurring_job', 'alert'
);

CREATE TYPE public.task_activity_action AS ENUM (
  'created', 'status_changed', 'assigned', 'commented', 'file_added', 'priority_changed'
);

-- ============================================================
-- tasks
-- ============================================================
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  status public.task_status NOT NULL DEFAULT 'open',
  priority public.task_priority NOT NULL DEFAULT 'medium',
  assigned_to text REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_by text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  department public.task_department NOT NULL DEFAULT 'genel',
  due_date date,
  parent_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE,
  source_type public.task_source_type NOT NULL DEFAULT 'manual',
  source_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_assigned_to ON public.tasks(assigned_to);
CREATE INDEX idx_tasks_created_by ON public.tasks(created_by);
CREATE INDEX idx_tasks_department ON public.tasks(department);
CREATE INDEX idx_tasks_parent_id ON public.tasks(parent_id);
CREATE INDEX idx_tasks_due_date ON public.tasks(due_date) WHERE status != 'done';
CREATE INDEX idx_tasks_priority ON public.tasks(priority);

CREATE TRIGGER set_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ============================================================
-- task_comments
-- ============================================================
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  author_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_comments_task_id ON public.task_comments(task_id);

-- ============================================================
-- task_attachments
-- ============================================================
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  uploaded_by text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_attachments_task_id ON public.task_attachments(task_id);

-- ============================================================
-- task_activity
-- ============================================================
CREATE TABLE public.task_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  actor_id text NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  action public.task_activity_action NOT NULL,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_activity_task_id ON public.task_activity(task_id);
CREATE INDEX idx_task_activity_created_at ON public.task_activity(created_at DESC);

-- ============================================================
-- RLS Policies
-- ============================================================
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_activity ENABLE ROW LEVEL SECURITY;

-- tasks: Yönetici her şeyi görür, diğerleri kendi atanan/oluşturduğu görevleri
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
  is_admin()
  OR assigned_to = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  OR created_by = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
);

CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (
  is_admin()
  OR created_by = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
);

CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (
  is_admin()
  OR assigned_to = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  OR created_by = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
);

CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (
  is_admin()
);

-- task_comments
CREATE POLICY "task_comments_select" ON public.task_comments FOR SELECT USING (
  is_admin()
  OR task_id IN (SELECT id FROM public.tasks WHERE
    assigned_to = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR created_by = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "task_comments_insert" ON public.task_comments FOR INSERT WITH CHECK (
  is_admin()
  OR author_id = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
);

CREATE POLICY "task_comments_delete" ON public.task_comments FOR DELETE USING (
  is_admin()
);

-- task_attachments
CREATE POLICY "task_attachments_select" ON public.task_attachments FOR SELECT USING (
  is_admin()
  OR task_id IN (SELECT id FROM public.tasks WHERE
    assigned_to = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR created_by = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "task_attachments_insert" ON public.task_attachments FOR INSERT WITH CHECK (
  is_admin()
  OR uploaded_by = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
);

CREATE POLICY "task_attachments_delete" ON public.task_attachments FOR DELETE USING (
  is_admin()
);

-- task_activity
CREATE POLICY "task_activity_select" ON public.task_activity FOR SELECT USING (
  is_admin()
  OR task_id IN (SELECT id FROM public.tasks WHERE
    assigned_to = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
    OR created_by = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
  )
);

CREATE POLICY "task_activity_insert" ON public.task_activity FOR INSERT WITH CHECK (
  is_admin()
  OR actor_id = (SELECT user_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1)
);

-- ============================================================
-- Supabase Storage bucket for task attachments
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('task-attachments', 'task-attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "task_attachments_storage_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "task_attachments_storage_insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "task_attachments_storage_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'task-attachments' AND auth.role() = 'authenticated');

-- ============================================================
-- Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_activity;
