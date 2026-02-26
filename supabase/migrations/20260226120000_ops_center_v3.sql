-- Ops Center V3: 4-column kanban, templates, recurring tasks
-- Enum swap: 6 statuses → 4 statuses + boolean flags

-- ══════════════════════════════════════════════════════════
-- 1. Add boolean flags to tasks
-- ══════════════════════════════════════════════════════════
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_waiting_approval BOOLEAN DEFAULT false;

-- ══════════════════════════════════════════════════════════
-- 2. Migrate existing data
-- ══════════════════════════════════════════════════════════
UPDATE tasks SET is_waiting_approval = true, status = 'in_progress'
WHERE status = 'waiting_approval';

UPDATE tasks SET is_blocked = true, status = 'in_progress'
WHERE status = 'blocked';

-- ══════════════════════════════════════════════════════════
-- 3. Enum swap via TEXT intermediate (avoids cross-enum comparison)
-- ══════════════════════════════════════════════════════════

-- Step 3a: Drop partial indexes that reference task_status enum
DROP INDEX IF EXISTS idx_tasks_due_date;
DROP INDEX IF EXISTS idx_tasks_status;

-- Step 3b: Convert to TEXT first
ALTER TABLE tasks
  ALTER COLUMN status DROP DEFAULT,
  ALTER COLUMN status TYPE TEXT USING status::TEXT;

-- Step 3c: Map old values to new values
UPDATE tasks SET status = 'scheduled' WHERE status = 'backlog';
UPDATE tasks SET status = 'queue' WHERE status = 'open';
-- in_progress and done stay the same

-- Step 3d: Drop old enum, create new
DROP TYPE task_status;
CREATE TYPE task_status AS ENUM ('scheduled', 'queue', 'in_progress', 'done');

-- Step 3e: Convert back to enum
ALTER TABLE tasks
  ALTER COLUMN status TYPE task_status USING status::task_status,
  ALTER COLUMN status SET DEFAULT 'queue'::task_status;

-- Step 3f: Recreate indexes
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_due_date ON tasks(due_date) WHERE status != 'done';

-- ══════════════════════════════════════════════════════════
-- 4. Drop FK on tasks.assigned_to (allows agent code assignment)
-- ══════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'tasks_assigned_to_fkey' AND table_name = 'tasks'
  ) THEN
    ALTER TABLE tasks DROP CONSTRAINT tasks_assigned_to_fkey;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════
-- 5. Task Templates
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  department task_department DEFAULT 'genel',
  priority task_priority DEFAULT 'medium',
  assignee_id TEXT,
  checklist JSONB DEFAULT '[]'::jsonb,
  created_by TEXT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_task_templates_updated_at
  BEFORE UPDATE ON task_templates
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_templates_select" ON task_templates
  FOR SELECT USING (true);

CREATE POLICY "task_templates_insert" ON task_templates
  FOR INSERT WITH CHECK (is_admin_or_engineer());

CREATE POLICY "task_templates_update" ON task_templates
  FOR UPDATE USING (is_admin_or_engineer());

CREATE POLICY "task_templates_delete" ON task_templates
  FOR DELETE USING (is_admin());

-- ══════════════════════════════════════════════════════════
-- 6. Recurring Tasks
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS recurring_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  department task_department DEFAULT 'genel',
  priority task_priority DEFAULT 'medium',
  assignee_id TEXT,
  cron_schedule TEXT NOT NULL DEFAULT '0 9 * * 1',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  run_count INT DEFAULT 0,
  created_by TEXT REFERENCES users(user_id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER set_recurring_tasks_updated_at
  BEFORE UPDATE ON recurring_tasks
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE recurring_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_tasks_select" ON recurring_tasks
  FOR SELECT USING (true);

CREATE POLICY "recurring_tasks_insert" ON recurring_tasks
  FOR INSERT WITH CHECK (is_admin_or_engineer());

CREATE POLICY "recurring_tasks_update" ON recurring_tasks
  FOR UPDATE USING (is_admin_or_engineer());

CREATE POLICY "recurring_tasks_delete" ON recurring_tasks
  FOR DELETE USING (is_admin());

-- ══════════════════════════════════════════════════════════
-- 7. Task Runs (recurring task execution history)
-- ══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_task_id UUID NOT NULL REFERENCES recurring_tasks(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE SET NULL,
  run_number INT NOT NULL DEFAULT 1,
  run_code TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'failed'))
);

ALTER TABLE task_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_runs_select" ON task_runs
  FOR SELECT USING (true);

CREATE POLICY "task_runs_insert" ON task_runs
  FOR INSERT WITH CHECK (is_admin_or_engineer());

CREATE POLICY "task_runs_update" ON task_runs
  FOR UPDATE USING (is_admin_or_engineer());

CREATE POLICY "task_runs_delete" ON task_runs
  FOR DELETE USING (is_admin());

-- ══════════════════════════════════════════════════════════
-- 8. Indexes
-- ══════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_tasks_is_blocked ON tasks(is_blocked) WHERE is_blocked = true;
CREATE INDEX IF NOT EXISTS idx_tasks_is_waiting_approval ON tasks(is_waiting_approval) WHERE is_waiting_approval = true;
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_active ON recurring_tasks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_recurring_tasks_next_run ON recurring_tasks(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_task_runs_recurring ON task_runs(recurring_task_id, run_number DESC);
