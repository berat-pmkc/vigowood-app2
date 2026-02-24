-- Ops Center V2: Approvals + Agents + Outputs
-- Migration: 20260224140000_ops_center_v2.sql

-- ─── Enums ────────────────────────────────────────────────────

CREATE TYPE public.approval_action_type AS ENUM (
  'task_status_change',
  'stock_adjustment',
  'shipment_release',
  'price_change',
  'bulk_operation',
  'system_config'
);

CREATE TYPE public.approval_risk_level AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE public.approval_status AS ENUM (
  'pending',
  'approved',
  'rejected',
  'revision_requested'
);

CREATE TYPE public.output_file_type AS ENUM (
  'report',
  'export',
  'pdf',
  'csv',
  'image',
  'other'
);

CREATE TYPE public.agent_status AS ENUM (
  'active',
  'paused',
  'disabled'
);

-- ─── Agents ───────────────────────────────────────────────────

CREATE TABLE public.ops_agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,           -- e.g. AGENT-ELIF
  department TEXT NOT NULL DEFAULT 'genel',
  description TEXT,
  avatar_url TEXT,
  capabilities JSONB DEFAULT '[]'::jsonb,   -- ["stok_kontrol","rapor_olustur"]
  schedule JSONB DEFAULT '{}'::jsonb,        -- {"cron":"0 8 * * *","timezone":"Europe/Istanbul"}
  status public.agent_status NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  total_tasks_completed INTEGER NOT NULL DEFAULT 0,
  total_approvals_requested INTEGER NOT NULL DEFAULT 0,
  total_outputs_generated INTEGER NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_ops_agents_status ON public.ops_agents(status);
CREATE INDEX idx_ops_agents_department ON public.ops_agents(department);

-- Trigger
CREATE TRIGGER set_ops_agents_updated_at
  BEFORE UPDATE ON public.ops_agents
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- RLS
ALTER TABLE public.ops_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view agents" ON public.ops_agents
  FOR SELECT USING (true);

CREATE POLICY "Admins manage agents" ON public.ops_agents
  FOR ALL USING (is_admin());

-- ─── Approvals ────────────────────────────────────────────────

CREATE TABLE public.ops_approvals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.ops_agents(id) ON DELETE SET NULL,
  action_type public.approval_action_type NOT NULL,
  risk_level public.approval_risk_level NOT NULL DEFAULT 'medium',
  status public.approval_status NOT NULL DEFAULT 'pending',
  title TEXT NOT NULL,
  description TEXT,
  requested_by TEXT NOT NULL,           -- user_id or agent code
  reviewer_id TEXT,                     -- user_id of reviewer
  payload JSONB DEFAULT '{}'::jsonb,    -- proposed changes
  old_payload JSONB DEFAULT '{}'::jsonb,-- current state (for comparison)
  review_note TEXT,
  requested_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_ops_approvals_status ON public.ops_approvals(status);
CREATE INDEX idx_ops_approvals_task_id ON public.ops_approvals(task_id);
CREATE INDEX idx_ops_approvals_agent_id ON public.ops_approvals(agent_id);
CREATE INDEX idx_ops_approvals_action_type ON public.ops_approvals(action_type);
CREATE INDEX idx_ops_approvals_risk_level ON public.ops_approvals(risk_level);
CREATE INDEX idx_ops_approvals_requested_by ON public.ops_approvals(requested_by);
CREATE INDEX idx_ops_approvals_reviewer_id ON public.ops_approvals(reviewer_id);
CREATE INDEX idx_ops_approvals_requested_at ON public.ops_approvals(requested_at DESC);

-- RLS
ALTER TABLE public.ops_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view approvals" ON public.ops_approvals
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create approvals" ON public.ops_approvals
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage approvals" ON public.ops_approvals
  FOR UPDATE USING (is_admin());

CREATE POLICY "Admins can delete approvals" ON public.ops_approvals
  FOR DELETE USING (is_admin());

-- ─── Outputs ──────────────────────────────────────────────────

CREATE TABLE public.ops_outputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  agent_id UUID REFERENCES public.ops_agents(id) ON DELETE SET NULL,
  file_type public.output_file_type NOT NULL DEFAULT 'report',
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT,
  description TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,   -- {"pages":5,"format":"A4","generated_by":"stok-rapor-agent"}
  created_by TEXT NOT NULL,             -- user_id or agent code
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_ops_outputs_task_id ON public.ops_outputs(task_id);
CREATE INDEX idx_ops_outputs_agent_id ON public.ops_outputs(agent_id);
CREATE INDEX idx_ops_outputs_file_type ON public.ops_outputs(file_type);
CREATE INDEX idx_ops_outputs_created_by ON public.ops_outputs(created_by);
CREATE INDEX idx_ops_outputs_created_at ON public.ops_outputs(created_at DESC);

-- RLS
ALTER TABLE public.ops_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can view outputs" ON public.ops_outputs
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create outputs" ON public.ops_outputs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete outputs" ON public.ops_outputs
  FOR DELETE USING (is_admin());

-- ─── Realtime ─────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_approvals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ops_agents;

-- ─── Seed: 6 Virtual Agents ──────────────────────────────────

INSERT INTO public.ops_agents (name, code, department, description, capabilities, schedule, status) VALUES
(
  'Elif',
  'AGENT-ELIF',
  'stok',
  'Stok seviyelerini izler, kritik stok uyarıları oluşturur ve stok raporları hazırlar.',
  '["stok_izleme","kritik_stok_uyari","stok_raporu","yari_mamul_analiz"]'::jsonb,
  '{"cron":"0 8,14,18 * * 1-6","timezone":"Europe/Istanbul","description":"Günde 3 kez: 08:00, 14:00, 18:00"}'::jsonb,
  'active'
),
(
  'Kerem',
  'AGENT-KEREM',
  'uretim',
  'Üretim hattını izler, darboğazları tespit eder ve üretim verimliliği raporları oluşturur.',
  '["uretim_izleme","darbogaz_tespit","verimlilik_raporu","kesim_optimizasyon"]'::jsonb,
  '{"cron":"0 7,12,17 * * 1-6","timezone":"Europe/Istanbul","description":"Günde 3 kez: 07:00, 12:00, 17:00"}'::jsonb,
  'active'
),
(
  'Zeynep',
  'AGENT-ZEYNEP',
  'pazaryeri',
  'Pazaryeri siparişlerini takip eder, sipariş durumlarını günceller ve satış raporları oluşturur.',
  '["siparis_takip","siparis_guncelle","satis_raporu","kampanya_analiz"]'::jsonb,
  '{"cron":"*/30 * * * 1-6","timezone":"Europe/Istanbul","description":"Her 30 dakikada bir"}'::jsonb,
  'active'
),
(
  'Burak',
  'AGENT-BURAK',
  'sevkiyat',
  'Sevkiyat planlamasını optimize eder, konteyner doluluk oranlarını izler ve lojistik raporları hazırlar.',
  '["sevkiyat_planlama","konteyner_optimizasyon","lojistik_raporu","teslimat_takip"]'::jsonb,
  '{"cron":"0 9,15 * * 1-5","timezone":"Europe/Istanbul","description":"Günde 2 kez: 09:00, 15:00"}'::jsonb,
  'active'
),
(
  'Derya',
  'AGENT-DERYA',
  'muhasebe',
  'Nakit akışını izler, ödeme hatırlatmaları oluşturur ve finansal raporlar hazırlar.',
  '["nakit_akis_izleme","odeme_hatirlatma","finansal_rapor","karlilik_analiz"]'::jsonb,
  '{"cron":"0 9 * * 1-5","timezone":"Europe/Istanbul","description":"Hafta içi her gün 09:00"}'::jsonb,
  'active'
),
(
  'Can',
  'AGENT-CAN',
  'genel',
  'Genel görev koordinasyonunu yapar, toplantı özetleri oluşturur ve performans raporları hazırlar.',
  '["gorev_koordinasyon","toplanti_ozet","performans_raporu","oncelik_analiz"]'::jsonb,
  '{"cron":"0 8,17 * * 1-5","timezone":"Europe/Istanbul","description":"Hafta içi 08:00 ve 17:00"}'::jsonb,
  'active'
);
