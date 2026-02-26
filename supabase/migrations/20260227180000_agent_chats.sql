-- Agent Chat: Kullanıcılar ve agent'lar arasında sohbet mesajları
CREATE TABLE public.agent_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.ops_agents(id) ON DELETE CASCADE,
  user_id UUID,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_agent_chats_agent_id ON public.agent_chats(agent_id);
CREATE INDEX idx_agent_chats_created_at ON public.agent_chats(created_at DESC);

-- RLS
ALTER TABLE public.agent_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_agent_chats" ON public.agent_chats FOR SELECT USING (true);
CREATE POLICY "insert_agent_chats" ON public.agent_chats FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "delete_agent_chats" ON public.agent_chats FOR DELETE USING (is_admin());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_chats;
