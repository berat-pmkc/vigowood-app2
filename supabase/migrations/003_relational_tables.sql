-- VigoWood Platform — Katman 4: İlişkili Tablolar
-- plakalar (416), plaka_parts (406), assembly_steps (523), step_bom (1651)

---------------------------------------------------
-- 1. PLAKALAR (Cutting Plates — 416 rows)
---------------------------------------------------
CREATE TABLE public.plakalar (
  plakalar_id         TEXT PRIMARY KEY,           -- 'PL-0001'
  plaka_id            TEXT NOT NULL,              -- 'PLK-001' (same plate, different machine configs)
  plaka_adi           TEXT NOT NULL,
  sku                 TEXT REFERENCES public.products(sku) ON DELETE SET NULL,
  tipi                TEXT,                       -- '8mm MDF', '5mm MDF', etc.
  renk                TEXT,                       -- 'Ceviz', 'Ham', 'Siyah', etc.
  makine_id           TEXT NOT NULL REFERENCES public.kesim_makinesi(makine_id),
  std_kesim_suresi_dk INTEGER,                    -- standard cutting time in minutes
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plakalar_plaka_id ON public.plakalar(plaka_id);
CREATE INDEX idx_plakalar_sku ON public.plakalar(sku);
CREATE INDEX idx_plakalar_makine ON public.plakalar(makine_id);

ALTER TABLE public.plakalar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read plakalar"
  ON public.plakalar FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage plakalar"
  ON public.plakalar FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 2. PLAKA_PARTS (Plate→Part mapping — 406 rows)
---------------------------------------------------
CREATE TABLE public.plaka_parts (
  ppart_id    TEXT PRIMARY KEY,                   -- 'PPart0001'
  plaka_id    TEXT NOT NULL,                      -- references plakalar.plaka_id (not PK, many plates share plaka_id)
  part_id     TEXT NOT NULL REFERENCES public.all_parts(part_id),
  default_qty NUMERIC,                            -- default quantity per plate cut (can be decimal-ish strings in source)
  sku         TEXT REFERENCES public.products(sku) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_plaka_parts_plaka ON public.plaka_parts(plaka_id);
CREATE INDEX idx_plaka_parts_part ON public.plaka_parts(part_id);
CREATE INDEX idx_plaka_parts_sku ON public.plaka_parts(sku);

ALTER TABLE public.plaka_parts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read plaka_parts"
  ON public.plaka_parts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage plaka_parts"
  ON public.plaka_parts FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 3. ASSEMBLY_STEPS (Montaj Adımları — 523 rows)
---------------------------------------------------
CREATE TABLE public.assembly_steps (
  step_id       TEXT PRIMARY KEY,                 -- 'ASM-0001'
  sku           TEXT REFERENCES public.products(sku) ON DELETE SET NULL,
  step_name     TEXT,
  seq_no        INTEGER,                          -- step sequence within product
  is_final_step BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_assembly_steps_sku ON public.assembly_steps(sku);
CREATE INDEX idx_assembly_steps_seq ON public.assembly_steps(sku, seq_no);

ALTER TABLE public.assembly_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read assembly_steps"
  ON public.assembly_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage assembly_steps"
  ON public.assembly_steps FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));

---------------------------------------------------
-- 4. STEP_BOM (Bill of Materials — 1651 rows, DAG)
---------------------------------------------------
-- part_id can reference either:
--   1. all_parts.part_id (physical part like HP0001, LS051-P04)
--   2. assembly_steps.step_id (ASM-XXXX — output of previous step)
-- This creates a DAG (Directed Acyclic Graph) structure.

CREATE TABLE public.step_bom (
  step_bom_id         TEXT PRIMARY KEY,           -- 'SBOM-0001'
  step_id             TEXT NOT NULL REFERENCES public.assembly_steps(step_id),
  part_id             TEXT NOT NULL,              -- FK to all_parts OR assembly_steps (DAG)
  qty_per             NUMERIC NOT NULL DEFAULT 1,
  kodu                TEXT,                       -- product SKU reference
  kritik_stok_products INTEGER DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NOTE: part_id intentionally has NO FK constraint because it can reference
-- either all_parts.part_id or assembly_steps.step_id (427 ASM refs out of 1651).

CREATE INDEX idx_step_bom_step ON public.step_bom(step_id);
CREATE INDEX idx_step_bom_part ON public.step_bom(part_id);
CREATE INDEX idx_step_bom_kodu ON public.step_bom(kodu);

ALTER TABLE public.step_bom ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read step_bom"
  ON public.step_bom FOR SELECT TO authenticated USING (true);

CREATE POLICY "Yönetici can manage step_bom"
  ON public.step_bom FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.users u WHERE u.auth_id = auth.uid() AND u.role = 'Yönetici'));
