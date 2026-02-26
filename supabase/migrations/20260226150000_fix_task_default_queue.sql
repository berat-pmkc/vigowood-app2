-- Fix: tasks.status default'u kesinlikle 'queue' olsun
ALTER TABLE tasks ALTER COLUMN status SET DEFAULT 'queue'::task_status;
