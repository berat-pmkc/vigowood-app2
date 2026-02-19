-- VigoWood Platform — Katman 5: İşlem Tabloları
-- cut_batches (748), cut_lines (1575), clean (1538), pack_events (712)
-- hazir_eleman_akis (105), iade_giris (128), attendance (1891), notifications (2)
-- stock_movements (20752), yari_mamul_stok (234141)

---------------------------------------------------
-- 1. CUT_BATCHES (Kesim Partileri — 748 rows)
---------------------------------------------------
CREATE TABLE public.cut_batches (
  cut_id      TEXT PRIMARY KEY,                    -- 'KES-0001'
  tarih       TIMESTAMPTZ NOT NULL,
  sku         TEXT,                                -- products ref (soft FK)
  plaka_id    TEXT,                                -- plakalar.plaka_id ref (not PK, no FK)
  makine_id   TEXT REFERENCES public.kesim_makinesi(makine_id) ON DELETE SET NULL,
  adet        NUMERIC NOT NULL DEFAULT 0,
  operator_id TEXT,                                -- users.user_id (VW###)
  plk_notu    TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cut_batches_tarih ON public.cut_batches(tarih);
CREATE INDEX idx_cut_batches_sku ON public.cut_batches(sku);
CREATE INDEX idx_cut_batches_plaka ON public.cut_batches(plaka_id);
CREATE INDEX idx_cut_batches_makine ON public.cut_batches(makine_id);
CREATE INDEX idx_cut_batches_operator ON public.cut_batches(operator_id);

ALTER TABLE public.cut_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cut_batches"
  ON public.cut_batches FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage cut_batches"
  ON public.cut_batches FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 2. CUT_LINES (Kesim Satırları — 1575 rows)
---------------------------------------------------
CREATE TABLE public.cut_lines (
  cut_line_id TEXT PRIMARY KEY,                    -- 'K-0001'
  cut_id      TEXT NOT NULL REFERENCES public.cut_batches(cut_id) ON DELETE CASCADE,
  tarih       TIMESTAMPTZ NOT NULL,
  part_id     TEXT,                                -- all_parts ref (nullable, 40 nulls)
  adet        NUMERIC NOT NULL DEFAULT 0,
  not_text    TEXT,
  renk        TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cut_lines_cut ON public.cut_lines(cut_id);
CREATE INDEX idx_cut_lines_tarih ON public.cut_lines(tarih);
CREATE INDEX idx_cut_lines_part ON public.cut_lines(part_id);
CREATE INDEX idx_cut_lines_renk ON public.cut_lines(renk);

ALTER TABLE public.cut_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read cut_lines"
  ON public.cut_lines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage cut_lines"
  ON public.cut_lines FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 3. CLEAN (Temizlik — 1538 rows)
-- CleanID is a batch reference (NOT unique), CutlineID is unique per row
---------------------------------------------------
CREATE TABLE public.clean (
  cutline_id     TEXT PRIMARY KEY REFERENCES public.cut_lines(cut_line_id) ON DELETE CASCADE,
  clean_batch_id TEXT NOT NULL,                    -- CleanID from data (groups records)
  start_time     TIMESTAMPTZ,
  end_time       TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'Open',     -- 'Open', 'Closed'
  not_text       TEXT,
  email          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clean_batch ON public.clean(clean_batch_id);
CREATE INDEX idx_clean_status ON public.clean(status);
CREATE INDEX idx_clean_start ON public.clean(start_time);

ALTER TABLE public.clean ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read clean"
  ON public.clean FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage clean"
  ON public.clean FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 4. PACK_EVENTS (Paketleme — 712 rows)
-- Personel is comma-separated VW### IDs (stored as TEXT for now)
---------------------------------------------------
CREATE TABLE public.pack_events (
  session_id  TEXT PRIMARY KEY,                    -- 'PKT-20251209-113006'
  email       TEXT,
  tarih       TIMESTAMPTZ,
  sku         TEXT,                                -- products ref (soft FK)
  personel    TEXT,                                -- comma-separated VW### IDs
  start_time  TIMESTAMPTZ,
  end_time    TIMESTAMPTZ,
  qty         NUMERIC NOT NULL DEFAULT 0,
  not_text    TEXT,
  status      TEXT NOT NULL DEFAULT 'Open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pack_events_tarih ON public.pack_events(tarih);
CREATE INDEX idx_pack_events_sku ON public.pack_events(sku);
CREATE INDEX idx_pack_events_status ON public.pack_events(status);

ALTER TABLE public.pack_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read pack_events"
  ON public.pack_events FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage pack_events"
  ON public.pack_events FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 5. HAZIR_ELEMAN_AKIS (Hazır Eleman Akışı — 105 rows)
---------------------------------------------------
CREATE TABLE public.hazir_eleman_akis (
  hakis_id    TEXT PRIMARY KEY,                    -- 'HA-20251209-151047'
  tarih       TIMESTAMPTZ NOT NULL,
  part_id     TEXT,                                -- all_parts ref (HP#### pattern)
  qty         NUMERIC NOT NULL DEFAULT 0,
  operator    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_hazir_eleman_tarih ON public.hazir_eleman_akis(tarih);
CREATE INDEX idx_hazir_eleman_part ON public.hazir_eleman_akis(part_id);

ALTER TABLE public.hazir_eleman_akis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read hazir_eleman_akis"
  ON public.hazir_eleman_akis FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage hazir_eleman_akis"
  ON public.hazir_eleman_akis FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 6. IADE_GIRIS (İade Girişi — 128 rows)
---------------------------------------------------
CREATE TABLE public.iade_giris (
  iade_id     TEXT PRIMARY KEY,                    -- 'IAD-20251201-174046'
  tarih       TIMESTAMPTZ,
  sku         TEXT,                                -- products ref (soft FK)
  qty         NUMERIC NOT NULL DEFAULT 0,
  durum       TEXT,                                -- 'Kullanilabilir', 'Kullanilamaz'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_iade_giris_tarih ON public.iade_giris(tarih);
CREATE INDEX idx_iade_giris_sku ON public.iade_giris(sku);
CREATE INDEX idx_iade_giris_durum ON public.iade_giris(durum);

ALTER TABLE public.iade_giris ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read iade_giris"
  ON public.iade_giris FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage iade_giris"
  ON public.iade_giris FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 7. ATTENDANCE (Yoklama — 1891 rows)
-- Employee is name string (not VW### ID) — needs mapping
---------------------------------------------------
CREATE TABLE public.attendance (
  att_id      TEXT PRIMARY KEY,                    -- UUID-like short hash
  tarih       DATE NOT NULL,
  employee    TEXT NOT NULL,                       -- full name, needs user mapping later
  department  TEXT,                                -- 'Kesim', 'Temizlik', 'Montaj', 'Paketleme', 'Paketleme Hatti'
  start_time  TIME,
  end_time    TIME,
  not_text    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_attendance_tarih ON public.attendance(tarih);
CREATE INDEX idx_attendance_employee ON public.attendance(employee);
CREATE INDEX idx_attendance_dept ON public.attendance(department);

ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read attendance"
  ON public.attendance FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 8. NOTIFICATIONS (Bildirimler — 2 rows)
-- TargetUser is comma-separated VW### IDs (stored as TEXT for now)
---------------------------------------------------
CREATE TABLE public.notifications (
  notif_id    TEXT PRIMARY KEY,                    -- 'NOT-20251205-181212'
  title       TEXT NOT NULL,
  message     TEXT,
  target_user TEXT,                                -- comma-separated VW### IDs
  status      TEXT NOT NULL DEFAULT 'Yeni',        -- 'Yeni', 'Okundu'
  created_by  TEXT,                                -- email
  attachments TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_status ON public.notifications(status);
CREATE INDEX idx_notifications_created ON public.notifications(created_at);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read notifications"
  ON public.notifications FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage notifications"
  ON public.notifications FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 9. STOCK_MOVEMENTS (Mamül Stok Hareketleri — 20752 rows)
-- MovID has duplicates, using UUID surrogate PK
---------------------------------------------------
CREATE TABLE public.stock_movements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mov_id      TEXT,                                -- original ID from source
  tarih       TIMESTAMPTZ,
  sku         TEXT,                                -- products ref (soft FK)
  qty         NUMERIC NOT NULL DEFAULT 0,          -- negative = sales out, positive = production in
  source      TEXT,                                -- 'Paketleme', 'Satis', 'iade', 'Duzeltme'
  source_row_id TEXT,                              -- PKT-xxx, VEA-xxx, IAD-xxx etc.
  batch_id    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_mov_tarih ON public.stock_movements(tarih);
CREATE INDEX idx_stock_mov_sku ON public.stock_movements(sku);
CREATE INDEX idx_stock_mov_source ON public.stock_movements(source);
CREATE INDEX idx_stock_mov_mov_id ON public.stock_movements(mov_id);
CREATE INDEX idx_stock_mov_batch ON public.stock_movements(batch_id);

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read stock_movements"
  ON public.stock_movements FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage stock_movements"
  ON public.stock_movements FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 10. YARI_MAMUL_STOK (Yarı Mamül Stok — 234141 rows)
---------------------------------------------------
CREATE TABLE public.yari_mamul_stok (
  yms_id      TEXT PRIMARY KEY,                    -- random string ID
  tarih       TIMESTAMPTZ,
  part_id     TEXT,                                -- all_parts ref (soft FK)
  part_adi    TEXT,
  sku         TEXT,                                -- products ref (soft FK)
  qty         NUMERIC NOT NULL DEFAULT 0,
  direction   TEXT,                                -- 'IN', 'OUT'
  source      TEXT,                                -- 'Temizlik', 'Montaj', 'Paketleme', 'Asama', 'Kesim', 'Kutu Uretim'
  source_id   TEXT,
  operator    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_yms_tarih ON public.yari_mamul_stok(tarih);
CREATE INDEX idx_yms_part ON public.yari_mamul_stok(part_id);
CREATE INDEX idx_yms_sku ON public.yari_mamul_stok(sku);
CREATE INDEX idx_yms_direction ON public.yari_mamul_stok(direction);
CREATE INDEX idx_yms_source ON public.yari_mamul_stok(source);
CREATE INDEX idx_yms_source_id ON public.yari_mamul_stok(source_id);

ALTER TABLE public.yari_mamul_stok ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read yari_mamul_stok"
  ON public.yari_mamul_stok FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage yari_mamul_stok"
  ON public.yari_mamul_stok FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));
