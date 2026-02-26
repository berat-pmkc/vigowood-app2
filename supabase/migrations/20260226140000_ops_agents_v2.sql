-- =====================================================
-- Ops Agents V2: role kolonu + 6 yeni asistan
-- =====================================================

-- 1) role kolonu ekle
ALTER TABLE public.ops_agents
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'specialist';

COMMENT ON COLUMN public.ops_agents.role IS 'Asistan rolü: specialist veya orchestrator';

-- 2) Eski asistanları temizle (Elif, Kerem, Zeynep, Burak, Derya, Can)
DELETE FROM public.ops_agents
WHERE code IN ('AGENT-ELIF', 'AGENT-KEREM', 'AGENT-ZEYNEP', 'AGENT-BURAK', 'AGENT-DERYA', 'AGENT-CAN');

-- 3) 6 yeni asistan ekle (sabit UUID — tekrar çalıştırılabilir)
INSERT INTO public.ops_agents (
  id, name, code, department, description, role, avatar_url,
  capabilities, working_hours, stats, status, is_active
) VALUES
(
  'a1b2c3d4-1111-4000-8000-000000000001',
  'vigowood.com Asistanı',
  'vigowood-com-asistan',
  'pazaryeri',
  'E-ticaret operasyonlarını yönetir: İkas sipariş analizi, günlük satış raporları, pazaryeri performans takibi.',
  'specialist',
  NULL,
  '["ikas_siparis_analizi","gunluk_satis_raporu","pazaryeri_performans","kampanya_takip","musteri_analizi"]'::jsonb,
  '{"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb,
  '{"tasks_completed":0,"total_tokens":0,"total_cost":0}'::jsonb,
  'active',
  true
),
(
  'a1b2c3d4-2222-4000-8000-000000000002',
  'Stok Asistanı',
  'stok-asistan',
  'stok',
  'Stok seviyelerini izler, kritik düşüşlerde uyarı verir, yeniden sipariş önerileri sunar.',
  'specialist',
  NULL,
  '["stok_izleme","kritik_stok_uyari","yeniden_siparis_onerisi","stok_raporu","yari_mamul_analiz"]'::jsonb,
  '{"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb,
  '{"tasks_completed":0,"total_tokens":0,"total_cost":0}'::jsonb,
  'active',
  true
),
(
  'a1b2c3d4-3333-4000-8000-000000000003',
  'Üretim Asistanı',
  'uretim-asistan',
  'uretim',
  'Üretim verimlilik raporları hazırlar, darboğaz tespiti yapar, üretim hattı performansını analiz eder.',
  'specialist',
  NULL,
  '["verimlilik_raporu","darbogaz_tespit","uretim_izleme","kesim_optimizasyon","montaj_analiz"]'::jsonb,
  '{"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb,
  '{"tasks_completed":0,"total_tokens":0,"total_cost":0}'::jsonb,
  'active',
  true
),
(
  'a1b2c3d4-4444-4000-8000-000000000004',
  'Sevkiyat Asistanı',
  'sevkiyat-asistan',
  'sevkiyat',
  'Sevkiyat takibi yapar, teslimat durumu raporları oluşturur, konteyner optimizasyonu önerir.',
  'specialist',
  NULL,
  '["sevkiyat_takip","teslimat_raporu","konteyner_optimizasyon","lojistik_analiz","maliyet_takip"]'::jsonb,
  '{"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb,
  '{"tasks_completed":0,"total_tokens":0,"total_cost":0}'::jsonb,
  'active',
  true
),
(
  'a1b2c3d4-5555-4000-8000-000000000005',
  'Muhasebe Asistanı',
  'muhasebe-asistan',
  'muhasebe',
  'Finansal özetler hazırlar, nakit akışı analizi yapar, ödeme hatırlatmaları oluşturur.',
  'specialist',
  NULL,
  '["finansal_ozet","nakit_akis_analizi","odeme_hatirlatma","karlilik_raporu","borc_takip"]'::jsonb,
  '{"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb,
  '{"tasks_completed":0,"total_tokens":0,"total_cost":0}'::jsonb,
  'active',
  true
),
(
  'a1b2c3d4-6666-4000-8000-000000000006',
  'Genel Asistan',
  'genel-asistan',
  'genel',
  'Orkestratör rolü: diğer asistanlara görev atar, raporlarını toplar ve özetler, günlük brief hazırlar, asistanlar arası koordinasyon yapar, gerektiğinde görevleri yeniden önceliklendirir.',
  'orchestrator',
  NULL,
  '["gorev_atama","rapor_toplama","gunluk_brief","koordinasyon","onceliklendirme","performans_ozet"]'::jsonb,
  '{"start":"09:00","end":"18:00","days":[1,2,3,4,5]}'::jsonb,
  '{"tasks_completed":0,"total_tokens":0,"total_cost":0}'::jsonb,
  'active',
  true
)
ON CONFLICT (code) DO NOTHING;
