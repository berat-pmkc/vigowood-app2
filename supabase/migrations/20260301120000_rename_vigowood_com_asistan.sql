-- =====================================================
-- Rename vigowood-com-asistan → pazaryeri-asistan
-- ops_agents code, name, description güncelleme
-- Eski agent_system kayıtlarına DOKUNMA
-- =====================================================

UPDATE public.ops_agents
SET
  code = 'pazaryeri-asistan',
  name = 'Pazaryeri Asistanı',
  description = 'İkas ve Trendyol satış kanallarını analiz eder',
  updated_at = now()
WHERE code = 'vigowood-com-asistan';
