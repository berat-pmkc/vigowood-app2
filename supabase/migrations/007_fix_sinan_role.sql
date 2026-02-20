-- Fix: sinan@vigowood.com rolü "E-Ticaret Müdürü" → "Yönetici"
UPDATE public.users
SET role = 'Yönetici', updated_at = now()
WHERE user_id = 'VW006' AND email = 'sinan@vigowood.com';
