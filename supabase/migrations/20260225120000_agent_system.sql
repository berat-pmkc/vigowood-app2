-- ============================================================
-- Migration: Agent System Infrastructure
-- Katman 30+: ops_agents ALTER + 7 yeni tablo
-- agent_memory, agent_actions, agent_messages,
-- job_definitions, job_runs, monitor_definitions, alerts
-- ============================================================

-- ─── 1a. ops_agents ALTER — 2 yeni kolon ───
ALTER TABLE public.ops_agents
  ADD COLUMN IF NOT EXISTS working_hours JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS stats JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.ops_agents.working_hours IS 'Mesai saatleri JSON: {"start":"08:00","end":"18:00","days":[1,2,3,4,5]}';
COMMENT ON COLUMN public.ops_agents.stats IS 'Esnek istatistik objesi: {"avg_response_time":120,"accuracy":0.95}';

-- ─── 1b. agent_memory — uzun vadeli hafıza ───
CREATE TABLE public.agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'learned_pattern',
  key TEXT NOT NULL,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  context TEXT,
  confidence NUMERIC(3,2) DEFAULT 0.50,
  source TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_agent_memory_agent_active ON public.agent_memory(agent_id, is_active);
CREATE INDEX idx_agent_memory_agent_type ON public.agent_memory(agent_id, memory_type);

CREATE TRIGGER set_agent_memory_updated_at
  BEFORE UPDATE ON public.agent_memory
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.agent_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view agent memory" ON public.agent_memory
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert agent memory" ON public.agent_memory
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage agent memory" ON public.agent_memory
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins delete agent memory" ON public.agent_memory
  FOR DELETE USING (is_admin());

-- ─── 1c. agent_actions — aksiyon logu ───
CREATE TABLE public.agent_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL DEFAULT 'query',
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,
  result TEXT NOT NULL DEFAULT 'success',
  error_message TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_estimate NUMERIC(10,4) DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_agent_actions_agent_created ON public.agent_actions(agent_id, created_at DESC);
CREATE INDEX idx_agent_actions_task ON public.agent_actions(task_id);

ALTER TABLE public.agent_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view agent actions" ON public.agent_actions
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert agent actions" ON public.agent_actions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage agent actions" ON public.agent_actions
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins delete agent actions" ON public.agent_actions
  FOR DELETE USING (is_admin());

-- ─── 1d. agent_messages — agent arası iletişim ───
CREATE TABLE public.agent_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'summary',
  subject TEXT,
  body TEXT NOT NULL,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  read_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_agent_messages_to_status ON public.agent_messages(to_agent, status);
CREATE INDEX idx_agent_messages_from_created ON public.agent_messages(from_agent, created_at DESC);

ALTER TABLE public.agent_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view agent messages" ON public.agent_messages
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert agent messages" ON public.agent_messages
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage agent messages" ON public.agent_messages
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins delete agent messages" ON public.agent_messages
  FOR DELETE USING (is_admin());

-- ─── 1e. job_definitions — zamanlanmış iş tanımları ───
CREATE TABLE public.job_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  schedule TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  creates_task BOOLEAN NOT NULL DEFAULT false,
  task_template JSONB DEFAULT '{}'::jsonb,
  config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_job_definitions_agent_active ON public.job_definitions(agent_id, is_active);

CREATE TRIGGER set_job_definitions_updated_at
  BEFORE UPDATE ON public.job_definitions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.job_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view job definitions" ON public.job_definitions
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert job definitions" ON public.job_definitions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage job definitions" ON public.job_definitions
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins delete job definitions" ON public.job_definitions
  FOR DELETE USING (is_admin());

-- ─── 1f. job_runs — iş çalışma logları ───
CREATE TABLE public.job_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES public.job_definitions(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  output_id UUID REFERENCES public.ops_outputs(id) ON DELETE SET NULL,
  input JSONB DEFAULT '{}'::jsonb,
  output JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER DEFAULT 0
);

CREATE INDEX idx_job_runs_job_started ON public.job_runs(job_id, started_at DESC);
CREATE INDEX idx_job_runs_agent_status ON public.job_runs(agent_id, status);

ALTER TABLE public.job_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view job runs" ON public.job_runs
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert job runs" ON public.job_runs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage job runs" ON public.job_runs
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins delete job runs" ON public.job_runs
  FOR DELETE USING (is_admin());

-- ─── 1g. monitor_definitions — izleme tanımları ───
CREATE TABLE public.monitor_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  monitor_type TEXT NOT NULL DEFAULT 'threshold',
  query_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  threshold_rule JSONB DEFAULT '{}'::jsonb,
  on_trigger JSONB DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'medium',
  cooldown_minutes INTEGER NOT NULL DEFAULT 360,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_monitor_definitions_agent_active ON public.monitor_definitions(agent_id, is_active);

CREATE TRIGGER set_monitor_definitions_updated_at
  BEFORE UPDATE ON public.monitor_definitions
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.monitor_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view monitor definitions" ON public.monitor_definitions
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert monitor definitions" ON public.monitor_definitions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage monitor definitions" ON public.monitor_definitions
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins delete monitor definitions" ON public.monitor_definitions
  FOR DELETE USING (is_admin());

-- ─── 1h. alerts — uyarı kayıtları ───
CREATE TABLE public.alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monitor_id UUID REFERENCES public.monitor_definitions(id) ON DELETE SET NULL,
  agent_id TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  dedup_key TEXT,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  acknowledged_by TEXT,
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_alerts_agent_status ON public.alerts(agent_id, status);
CREATE INDEX idx_alerts_severity_status ON public.alerts(severity, status);
CREATE INDEX idx_alerts_dedup_key ON public.alerts(dedup_key);

ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view alerts" ON public.alerts
  FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert alerts" ON public.alerts
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage alerts" ON public.alerts
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins delete alerts" ON public.alerts
  FOR DELETE USING (is_admin());

-- ─── 1i. Realtime ───
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_runs;

-- ─── 1j. Seed Data — Örnek job_definitions ───
INSERT INTO public.job_definitions (agent_id, name, description, schedule, creates_task, task_template, config) VALUES
(
  'AGENT-ELIF',
  'Günlük Stok Raporu',
  'Her gün sabah 09:00''da kritik stok seviyelerini kontrol eder ve rapor oluşturur',
  '0 9 * * *',
  true,
  '{"title": "Günlük Stok Raporu", "department": "stok", "priority": "medium", "description": "Otomatik stok seviye kontrolü ve rapor oluşturma"}'::jsonb,
  '{"check_critical_stock": true, "include_trends": true, "notify_on_critical": true}'::jsonb
),
(
  'AGENT-KEREM',
  'Haftalık Üretim Özeti',
  'Her Pazartesi sabah 10:00''da geçen haftanın üretim verilerini özetler',
  '0 10 * * 1',
  true,
  '{"title": "Haftalık Üretim Özeti", "department": "uretim", "priority": "low", "description": "Otomatik haftalık üretim performans raporu"}'::jsonb,
  '{"include_efficiency": true, "include_bottlenecks": true, "compare_previous_week": true}'::jsonb
);

-- ─── 1k. Seed Data — Örnek monitor_definitions ───
INSERT INTO public.monitor_definitions (agent_id, name, description, monitor_type, query_config, threshold_rule, on_trigger, severity, cooldown_minutes) VALUES
(
  'AGENT-ELIF',
  'Kritik Stok Seviyesi',
  'Parça stokları kritik seviyenin altına düştüğünde alarm verir',
  'threshold',
  '{"table": "all_parts", "column": "aktif_stok", "compare_column": "hazir_eleman_kritik_stok", "condition": "less_than"}'::jsonb,
  '{"operator": "lt", "field": "aktif_stok", "reference_field": "hazir_eleman_kritik_stok"}'::jsonb,
  '{"create_alert": true, "notify_agents": ["AGENT-KEREM"], "create_task": true}'::jsonb,
  'high',
  360
),
(
  'AGENT-ZEYNEP',
  'Yüksek İade Oranı',
  'İade oranı %5''i geçtiğinde alarm verir',
  'threshold',
  '{"table": "iade_giris", "aggregation": "count", "period": "7d", "compare_to": "stock_movements"}'::jsonb,
  '{"operator": "gt", "value": 5, "unit": "percent"}'::jsonb,
  '{"create_alert": true, "severity_escalation": true, "notify_agents": ["AGENT-ELIF", "AGENT-CAN"]}'::jsonb,
  'medium',
  720
);
