-- OPS Center: Kullanıcılara görev atanabilirlik bayrağı ekle
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS can_be_ops_assignee BOOLEAN NOT NULL DEFAULT false;

-- Mevcut aktif kullanıcılardan Üretim ve Hat dışındakileri OPS Center'da atanabilir yap
UPDATE users
SET can_be_ops_assignee = true
WHERE is_active = true
  AND role NOT IN ('Üretim', 'Hat');
