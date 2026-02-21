-- VigoWood Platform — Katman 22: Bildirimler V2
-- notification_reads junction tablosu + updated_at + realtime

---------------------------------------------------
-- 1. notification_reads junction tablosu
---------------------------------------------------
CREATE TABLE public.notification_reads (
  id       BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  notif_id TEXT NOT NULL REFERENCES public.notifications(notif_id) ON DELETE CASCADE,
  user_id  TEXT NOT NULL,
  read_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (notif_id, user_id)
);

CREATE INDEX idx_notif_reads_user ON public.notification_reads(user_id);
CREATE INDEX idx_notif_reads_user_notif ON public.notification_reads(user_id, notif_id);

---------------------------------------------------
-- 2. RLS — notification_reads
---------------------------------------------------
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read notification_reads"
  ON public.notification_reads FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert own reads"
  ON public.notification_reads FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Admin can delete notification_reads"
  ON public.notification_reads FOR DELETE TO authenticated USING (is_admin());

---------------------------------------------------
-- 3. updated_at kolonu notifications tablosuna
---------------------------------------------------
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TRIGGER set_notifications_updated_at
  BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

---------------------------------------------------
-- 4. Admin INSERT/UPDATE policy (mevcut sadece ALL+using=is_admin)
--    Güvenlik: sadece admin bildirim oluşturabilir
---------------------------------------------------
-- Mevcut notifications policy zaten admin ALL var, ekstra gerek yok

---------------------------------------------------
-- 5. Realtime
---------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notification_reads;
