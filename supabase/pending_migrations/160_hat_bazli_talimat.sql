-- =============================================================
-- 160: Hat bazlı iş talimatı — çekirdek (H1, 1/2)
--
-- Talimat artık PERSONEL değil HAT bazlıdır (docs/plan-3-hat.md):
--   talimat_hatlar          MONTAJ 1/2/3 HATTI, DÖŞEME HATTI (montaj), PAKETLEME HATTI (paketleme) + "Hat ekle"
--   talimat_satirlar.hat_id hat satırı (personel_id NULL); eski personel satırları (yalnız prova) çalışmaya devam
--                           eder ama arayüzde gösterilmez.
--   montaj_sessions / pack_events .hat_id   seansın hangi hatta yapıldığı (eski kayıtlarda NULL)
--
-- Bu dosya: tablo + kolonlar, görünümler (etkin / ilerleme / katkı / plan özeti), hat yönetimi RPC'leri,
-- satır RPC'leri (hat destekli), hat'a kopyalama, hafta kopyalama ve "tek açık seans" kuralı.
-- 161: yayın/onay/bildirim, pasif(hat), zamanlayıcı, talep çoklu hat + aşama durumları, ek seans.
-- Tüm yeni RPC'ler SECURITY DEFINER, RLS yalnızca SECURITY DEFINER yardımcılarıyla.
-- =============================================================

-- ── 1) talimat_hatlar ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.talimat_hatlar (
  hat_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad          TEXT NOT NULL UNIQUE,
  tur         TEXT NOT NULL CHECK (tur IN ('montaj', 'paketleme')),
  sira        INTEGER NOT NULL,
  aktif       BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_talimat_hatlar_sira ON public.talimat_hatlar (sira);

ALTER TABLE public.talimat_hatlar ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS talimat_hatlar_select ON public.talimat_hatlar;
CREATE POLICY talimat_hatlar_select ON public.talimat_hatlar
  FOR SELECT TO authenticated USING (public.has_production_access() OR public.is_office_user());
DROP POLICY IF EXISTS talimat_hatlar_planlayici ON public.talimat_hatlar;
CREATE POLICY talimat_hatlar_planlayici ON public.talimat_hatlar
  FOR ALL TO authenticated USING (public.is_admin_or_engineer()) WITH CHECK (public.is_admin_or_engineer());

INSERT INTO public.talimat_hatlar (ad, tur, sira) VALUES
  ('MONTAJ 1 HATTI', 'montaj', 1),
  ('MONTAJ 2 HATTI', 'montaj', 2),
  ('MONTAJ 3 HATTI', 'montaj', 3),
  ('DÖŞEME HATTI', 'montaj', 4),
  ('PAKETLEME HATTI', 'paketleme', 5)
ON CONFLICT (ad) DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'talimat_hatlar') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.talimat_hatlar;
  END IF;
END $$;

-- ── 2) Tablo/kolon değişiklikleri ─────────────────────────────
-- Satırlar
ALTER TABLE public.talimat_satirlar ALTER COLUMN personel_id DROP NOT NULL;
ALTER TABLE public.talimat_satirlar
  ADD COLUMN IF NOT EXISTS hat_id UUID REFERENCES public.talimat_hatlar(hat_id),
  -- Talep zili: bağlı hat satırının ilk seansı / tamamlanması bir kez bildirildi mi (161)
  ADD COLUMN IF NOT EXISTS asama_basladi_bildirildi BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS asama_tamamlandi_bildirildi BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.talimat_satirlar DROP CONSTRAINT IF EXISTS talimat_satir_hat_veya_personel;
ALTER TABLE public.talimat_satirlar
  ADD CONSTRAINT talimat_satir_hat_veya_personel CHECK (hat_id IS NOT NULL OR personel_id IS NOT NULL);

-- Hat satırlarında sıra hat içinde tekil (yeniden sıralama için transaction sonunda kontrol edilir).
-- hat_id NULL olan eski satırlar kısıttan etkilenmez (NULL'lar farklı sayılır).
ALTER TABLE public.talimat_satirlar DROP CONSTRAINT IF EXISTS uq_talimat_satir_hat_sira;
ALTER TABLE public.talimat_satirlar
  ADD CONSTRAINT uq_talimat_satir_hat_sira UNIQUE (plan_id, hat_id, sira) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX IF NOT EXISTS idx_talimat_satirlar_hat ON public.talimat_satirlar (plan_id, hat_id, sira) WHERE hat_id IS NOT NULL;

-- Satır kapanışı (talimat_satir_kapat; tamamlandı / tamamlanmadı + neden). Canlı şemada zaten var olabilir; idempotent.
ALTER TABLE public.talimat_satirlar
  ADD COLUMN IF NOT EXISTS kapanis TEXT,
  ADD COLUMN IF NOT EXISTS kapanis_neden TEXT,
  ADD COLUMN IF NOT EXISTS kapanis_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS kapatan TEXT;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'talimat_satirlar_kapanis_chk'
                 AND conrelid = 'public.talimat_satirlar'::regclass) THEN
    ALTER TABLE public.talimat_satirlar ADD CONSTRAINT talimat_satirlar_kapanis_chk
      CHECK (kapanis IS NULL OR kapanis IN ('tamamlandi', 'tamamlanmadi'));
  END IF;
END $$;

-- Plan: yayınlanmamış silme/sıra değişikliği olan hatlar (satır bayrağı bunu taşıyamaz)
ALTER TABLE public.talimat_planlar
  ADD COLUMN IF NOT EXISTS degisen_hatlar UUID[] NOT NULL DEFAULT '{}';

-- Yayın / hedef / onay (hat bazlı)
ALTER TABLE public.talimat_yayinlar ADD COLUMN IF NOT EXISTS hat_sayisi INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.talimat_yayin_hedefler ADD COLUMN IF NOT EXISTS hat_id UUID REFERENCES public.talimat_hatlar(hat_id);
ALTER TABLE public.talimat_yayin_hedefler DROP CONSTRAINT IF EXISTS talimat_yayin_hedefler_pkey;
ALTER TABLE public.talimat_yayin_hedefler ALTER COLUMN personel_id DROP NOT NULL;
ALTER TABLE public.talimat_yayin_hedefler DROP CONSTRAINT IF EXISTS talimat_hedef_hat_veya_personel;
ALTER TABLE public.talimat_yayin_hedefler
  ADD CONSTRAINT talimat_hedef_hat_veya_personel CHECK (hat_id IS NOT NULL OR personel_id IS NOT NULL);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.talimat_yayin_hedefler'::regclass AND contype = 'p') THEN
    ALTER TABLE public.talimat_yayin_hedefler ADD COLUMN IF NOT EXISTS hedef_id UUID NOT NULL DEFAULT gen_random_uuid();
    ALTER TABLE public.talimat_yayin_hedefler ADD PRIMARY KEY (hedef_id);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_yayin_hedef_personel ON public.talimat_yayin_hedefler (yayin_id, personel_id) WHERE hat_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_yayin_hedef_hat ON public.talimat_yayin_hedefler (yayin_id, hat_id) WHERE hat_id IS NOT NULL;

ALTER TABLE public.talimat_onaylar ADD COLUMN IF NOT EXISTS hat_id UUID REFERENCES public.talimat_hatlar(hat_id);
ALTER TABLE public.talimat_onaylar DROP CONSTRAINT IF EXISTS talimat_onaylar_pkey;
ALTER TABLE public.talimat_onaylar ALTER COLUMN personel_id DROP NOT NULL;
ALTER TABLE public.talimat_onaylar DROP CONSTRAINT IF EXISTS talimat_onay_hat_veya_personel;
ALTER TABLE public.talimat_onaylar
  ADD CONSTRAINT talimat_onay_hat_veya_personel CHECK (hat_id IS NOT NULL OR personel_id IS NOT NULL);
-- Realtime (talimat_onaylar yayında) UPDATE/DELETE için replica identity gerekir: vekil birincil anahtar
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.talimat_onaylar'::regclass AND contype = 'p') THEN
    ALTER TABLE public.talimat_onaylar ADD COLUMN IF NOT EXISTS onay_id UUID NOT NULL DEFAULT gen_random_uuid();
    ALTER TABLE public.talimat_onaylar ADD PRIMARY KEY (onay_id);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_onay_personel ON public.talimat_onaylar (yayin_id, personel_id) WHERE hat_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_onay_hat ON public.talimat_onaylar (yayin_id, hat_id) WHERE hat_id IS NOT NULL;

-- Pasif kapsamı: 'hat' eklendi
ALTER TABLE public.talimat_pasifler ADD COLUMN IF NOT EXISTS hat_id UUID REFERENCES public.talimat_hatlar(hat_id);
ALTER TABLE public.talimat_pasifler DROP CONSTRAINT IF EXISTS talimat_pasifler_kapsam_check;
ALTER TABLE public.talimat_pasifler DROP CONSTRAINT IF EXISTS talimat_pasif_personel;
ALTER TABLE public.talimat_pasifler DROP CONSTRAINT IF EXISTS talimat_pasif_kapsam_alan;
ALTER TABLE public.talimat_pasifler
  ADD CONSTRAINT talimat_pasifler_kapsam_check CHECK (kapsam IN ('personel', 'liste', 'hat')),
  ADD CONSTRAINT talimat_pasif_kapsam_alan CHECK (
    (kapsam = 'personel') = (personel_id IS NOT NULL) AND (kapsam = 'hat') = (hat_id IS NOT NULL));

-- Seanslar: hat
ALTER TABLE public.montaj_sessions ADD COLUMN IF NOT EXISTS hat_id UUID REFERENCES public.talimat_hatlar(hat_id) ON DELETE SET NULL;
ALTER TABLE public.pack_events     ADD COLUMN IF NOT EXISTS hat_id UUID REFERENCES public.talimat_hatlar(hat_id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_montaj_sessions_hat ON public.montaj_sessions (hat_id, sku) WHERE hat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pack_events_hat ON public.pack_events (hat_id, sku) WHERE hat_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_montaj_sessions_acik ON public.montaj_sessions (sku, step_id) WHERE durum = 'montajda';
CREATE INDEX IF NOT EXISTS idx_pack_events_acik ON public.pack_events (sku) WHERE durum = 'paketlemede';

-- Talep zili: 'asama' olayı (161'deki tetikleyicilerle) + hat bilgisi
ALTER TABLE public.talep_bildirimleri DROP CONSTRAINT IF EXISTS talep_bildirimleri_olay_check;
ALTER TABLE public.talep_bildirimleri
  ADD CONSTRAINT talep_bildirimleri_olay_check
  CHECK (olay IN ('yeni','degisti','geri_cekildi','kapandi','yeniden_acildi','asama'));
ALTER TABLE public.talep_bildirimleri
  ADD COLUMN IF NOT EXISTS hat_id UUID REFERENCES public.talimat_hatlar(hat_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS hat_adi TEXT,
  ADD COLUMN IF NOT EXISTS asama TEXT CHECK (asama IS NULL OR asama IN ('basladi','tamamlandi'));

-- ── 3) Tetikleyiciler: istasyon (hat.tur) + sayaç ─────────────
-- Hat satırında istasyon her zaman hattın türünden gelir; eski satırlarda users.station'dan (150).
CREATE OR REPLACE FUNCTION public.talimat_satir_istasyon_varsayilan()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.hat_id IS NOT NULL THEN
    SELECT h.tur INTO NEW.istasyon FROM public.talimat_hatlar h WHERE h.hat_id = NEW.hat_id;
  ELSIF TG_OP = 'INSERT' AND NEW.istasyon IS NULL AND NEW.plaka_id IS NULL AND NEW.personel_id IS NOT NULL THEN
    SELECT public.talimat_istasyon_esle(u.station::text) INTO NEW.istasyon
    FROM public.users u WHERE u.user_id = NEW.personel_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_talimat_satir_istasyon ON public.talimat_satirlar;
CREATE TRIGGER trg_talimat_satir_istasyon
  BEFORE INSERT OR UPDATE OF hat_id ON public.talimat_satirlar
  FOR EACH ROW EXECUTE FUNCTION public.talimat_satir_istasyon_varsayilan();

REVOKE ALL ON FUNCTION public.talimat_satir_istasyon_varsayilan() FROM PUBLIC, anon, authenticated;

-- Sayaç (156 semantiği korunur): yeni satırda now(); ürün/plaka değişince ve "tekrar aktif et"te (sayac_baslangic
-- değişince) yeniden başlar. Sayaç yenilenince talep zili işaretleri de sıfırlanır (yeni iş = yeni "başladı/bitti").
CREATE OR REPLACE FUNCTION public.talimat_satir_sayac_ayarla()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sayac_baslangic IS NULL THEN
      NEW.sayac_baslangic := now();
    END IF;
  ELSE
    IF (NEW.sku IS DISTINCT FROM OLD.sku OR NEW.plaka_id IS DISTINCT FROM OLD.plaka_id
        OR NEW.hat_id IS DISTINCT FROM OLD.hat_id)
       AND NEW.sayac_baslangic IS NOT DISTINCT FROM OLD.sayac_baslangic THEN
      NEW.sayac_baslangic := now();
    END IF;
    IF NEW.sayac_baslangic IS DISTINCT FROM OLD.sayac_baslangic THEN
      NEW.asama_basladi_bildirildi := false;
      NEW.asama_tamamlandi_bildirildi := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.talimat_satir_sayac_ayarla() FROM PUBLIC, anon, authenticated;

-- ── 4) Görünümler ─────────────────────────────────────────────
-- etkin: hat kolonları sona eklenir; etkin_pasif'e hat kapsamı eklendi.
CREATE OR REPLACE VIEW public.talimat_satir_etkin AS
SELECT
  s.satir_id, s.plan_id, s.personel_id, s.sira, s.istasyon, s.sku, s.plaka_id,
  s.istenen_miktar, s.not_text, s.talep_id, s.durum,
  s.pasif_neden, s.pasif_baslangic, s.pasif_until,
  s.degisti, s.onay_bekliyor, s.created_at, s.updated_at,
  p.hafta_baslangic,
  p.durum AS plan_durum,
  (p.hafta_baslangic::timestamp AT TIME ZONE 'Europe/Istanbul')        AS hafta_bas_ts,
  ((p.hafta_baslangic + 7)::timestamp AT TIME ZONE 'Europe/Istanbul')  AS hafta_son_ts,
  COALESCE(s.istasyon, CASE WHEN s.plaka_id IS NOT NULL THEN 'kesim' ELSE 'montaj' END) AS etkin_istasyon,
  (
    (s.durum = 'pasif'
       AND (s.pasif_baslangic IS NULL OR s.pasif_baslangic <= public.talimat_bugun())
       AND (s.pasif_until IS NULL OR s.pasif_until >= public.talimat_bugun()))
    OR EXISTS (
      SELECT 1 FROM public.talimat_pasifler tp
      WHERE tp.plan_id = s.plan_id
        AND tp.iptal_at IS NULL
        AND public.talimat_bugun() BETWEEN tp.baslangic AND tp.bitis
        AND (tp.kapsam = 'liste'
             OR (tp.kapsam = 'personel' AND tp.personel_id = s.personel_id)
             OR (tp.kapsam = 'hat' AND tp.hat_id = s.hat_id))
    )
  ) AS etkin_pasif,
  s.sayac_baslangic,
  GREATEST((p.hafta_baslangic::timestamp AT TIME ZONE 'Europe/Istanbul'),
           COALESCE(s.sayac_baslangic, (p.hafta_baslangic::timestamp AT TIME ZONE 'Europe/Istanbul'))) AS sayac_bas_ts,
  s.kapanis, s.kapanis_neden, s.kapanis_at, s.kapatan,
  s.hat_id,
  h.ad   AS hat_adi,
  h.tur  AS hat_tur,
  h.sira AS hat_sira,
  h.aktif AS hat_aktif
FROM public.talimat_satirlar s
JOIN public.talimat_planlar p ON p.plan_id = s.plan_id
LEFT JOIN public.talimat_hatlar h ON h.hat_id = s.hat_id;

-- ilerleme: hat satırlarında üretilen hat+tür bazlı (montaj hattı -> son aşama, paketleme hattı -> paketleme)
CREATE OR REPLACE VIEW public.talimat_satir_ilerleme AS
SELECT
  e.satir_id, e.plan_id, e.personel_id, e.sira, e.istasyon, e.etkin_istasyon,
  e.sku, e.plaka_id, e.istenen_miktar, e.not_text, e.talep_id, e.durum,
  e.pasif_neden, e.pasif_baslangic, e.pasif_until,
  e.degisti, e.onay_bekliyor,
  (e.degisti OR e.onay_bekliyor) AS kirmizi,
  e.hafta_baslangic, e.plan_durum, e.etkin_pasif,
  pr.uretilen,
  CASE WHEN e.istenen_miktar IS NOT NULL THEN e.istenen_miktar - pr.uretilen END AS fark,
  (e.durum = 'tamamlandi'
     OR (e.istenen_miktar IS NOT NULL AND pr.uretilen >= e.istenen_miktar)) AS tamamlandi_mi,
  CASE
    WHEN e.etkin_pasif THEN 'pasif'
    WHEN e.durum = 'tamamlandi'
      OR (e.istenen_miktar IS NOT NULL AND pr.uretilen >= e.istenen_miktar) THEN 'tamamlandi'
    ELSE 'aktif'
  END AS etkin_durum,
  CASE WHEN e.etkin_istasyon = 'montaj' THEN ph.paketlemeye_hazir END AS paketlemeye_hazir,
  sn.son_seans_at,
  (sn.son_seans_at IS NOT NULL) AS hafta_seans_var,
  COALESCE(sn.son_seans_at >= (public.talimat_bugun()::timestamp AT TIME ZONE 'Europe/Istanbul'), false) AS bugun_seans_var,
  pd.urun_adi,
  u.full_name AS personel_adi,
  u.station::text AS personel_istasyon,
  (SELECT pl.plaka_adi FROM public.plakalar pl WHERE pl.plaka_id = e.plaka_id LIMIT 1) AS plaka_adi,
  COALESCE((SELECT ts.miktar FROM public.urun_toplam_stok ts WHERE ts.sku = e.sku), 0) AS toplam_stok,
  e.sayac_baslangic,
  e.kapanis, e.kapanis_neden, e.kapanis_at, e.kapatan,
  ac.acik_seans_sayisi,
  e.hat_id, e.hat_adi, e.hat_tur, e.hat_sira, e.hat_aktif
FROM public.talimat_satir_etkin e
LEFT JOIN public.products pd ON pd.sku = e.sku
LEFT JOIN public.users u ON u.user_id = e.personel_id
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN e.hat_id IS NOT NULL AND e.hat_tur = 'montaj' THEN COALESCE((
      SELECT sum(ms.qty) FROM public.montaj_sessions ms
      WHERE ms.sku = e.sku AND ms.is_final_step AND ms.durum = 'tamamlandi'
        AND ms.hat_id = e.hat_id
        AND COALESCE(ms.end_time, ms.start_time) >= e.sayac_bas_ts
        AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts), 0)
    WHEN e.hat_id IS NOT NULL THEN COALESCE((
      SELECT sum(pe.qty) FROM public.pack_events pe
      WHERE pe.sku = e.sku AND pe.durum = 'tamamlandi'
        AND pe.hat_id = e.hat_id
        AND COALESCE(pe.end_time, pe.tarih) >= e.sayac_bas_ts
        AND COALESCE(pe.end_time, pe.tarih) <  e.hafta_son_ts), 0)
    WHEN e.etkin_istasyon = 'montaj' THEN COALESCE((
      SELECT sum(ms.qty) FROM public.montaj_sessions ms
      WHERE ms.sku = e.sku AND ms.is_final_step AND ms.durum = 'tamamlandi'
        AND COALESCE(ms.end_time, ms.start_time) >= e.sayac_bas_ts
        AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts), 0)
    WHEN e.etkin_istasyon = 'paketleme' THEN COALESCE((
      SELECT sum(pe.qty) FROM public.pack_events pe
      WHERE pe.sku = e.sku AND pe.durum = 'tamamlandi'
        AND COALESCE(pe.end_time, pe.tarih) >= e.sayac_bas_ts
        AND COALESCE(pe.end_time, pe.tarih) <  e.hafta_son_ts
        AND (pe.talimat_satir_id = e.satir_id
             OR public.talimat_pack_personel_mi(pe.personel, pe.workers, e.personel_id))), 0)
    ELSE COALESCE((
      SELECT sum(cb.adet) FROM public.cut_batches cb
      WHERE cb.durum = 'tamamlandi'
        AND cb.tarih >= e.sayac_bas_ts AND cb.tarih < e.hafta_son_ts
        AND (cb.talimat_satir_id = e.satir_id
             OR (cb.talimat_satir_id IS NULL AND cb.operator_id = e.personel_id
                 AND ((e.plaka_id IS NOT NULL AND cb.plaka_id = e.plaka_id)
                      OR (e.plaka_id IS NULL AND cb.sku = e.sku))))), 0)
  END AS uretilen
) pr
CROSS JOIN LATERAL (
  SELECT GREATEST(
    COALESCE((
      SELECT sum(ms.qty) FROM public.montaj_sessions ms
      WHERE ms.sku = e.sku AND ms.is_final_step AND ms.durum = 'tamamlandi'
        AND COALESCE(ms.end_time, ms.start_time) >= e.hafta_bas_ts
        AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts), 0)
    - COALESCE((
      SELECT sum(pe.qty) FROM public.pack_events pe
      WHERE pe.sku = e.sku AND pe.durum = 'tamamlandi'
        AND COALESCE(pe.end_time, pe.tarih) >= e.hafta_bas_ts
        AND COALESCE(pe.end_time, pe.tarih) <  e.hafta_son_ts), 0),
    0) AS paketlemeye_hazir
) ph
CROSS JOIN LATERAL (
  SELECT CASE
    WHEN e.hat_id IS NOT NULL AND e.hat_tur = 'montaj' THEN (
      SELECT max(ms.start_time) FROM public.montaj_sessions ms
      WHERE (ms.talimat_satir_id = e.satir_id OR (ms.hat_id = e.hat_id AND ms.sku = e.sku))
        AND ms.start_time >= e.sayac_bas_ts AND ms.start_time < e.hafta_son_ts)
    WHEN e.hat_id IS NOT NULL THEN (
      SELECT max(COALESCE(pe.start_time, pe.tarih)) FROM public.pack_events pe
      WHERE (pe.talimat_satir_id = e.satir_id OR (pe.hat_id = e.hat_id AND pe.sku = e.sku))
        AND COALESCE(pe.start_time, pe.tarih) >= e.sayac_bas_ts
        AND COALESCE(pe.start_time, pe.tarih) <  e.hafta_son_ts)
    WHEN e.etkin_istasyon = 'montaj' THEN (
      SELECT max(ms.start_time) FROM public.montaj_sessions ms
      WHERE (ms.talimat_satir_id = e.satir_id
             OR (ms.sku = e.sku
                 AND (ms.operator_id = e.personel_id
                      OR public.talimat_workers_icerir(ms.workers, e.personel_id))))
        AND ms.start_time >= e.sayac_bas_ts AND ms.start_time < e.hafta_son_ts)
    WHEN e.etkin_istasyon = 'paketleme' THEN (
      SELECT max(COALESCE(pe.start_time, pe.tarih)) FROM public.pack_events pe
      WHERE (pe.talimat_satir_id = e.satir_id
             OR (pe.sku = e.sku
                 AND public.talimat_pack_personel_mi(pe.personel, pe.workers, e.personel_id)))
        AND COALESCE(pe.start_time, pe.tarih) >= e.sayac_bas_ts
        AND COALESCE(pe.start_time, pe.tarih) <  e.hafta_son_ts)
    ELSE (
      SELECT max(cb.tarih) FROM public.cut_batches cb
      WHERE (cb.talimat_satir_id = e.satir_id
             OR (cb.operator_id = e.personel_id
                 AND ((e.plaka_id IS NOT NULL AND cb.plaka_id = e.plaka_id)
                      OR (e.plaka_id IS NULL AND cb.sku = e.sku))))
        AND cb.tarih >= e.sayac_bas_ts AND cb.tarih < e.hafta_son_ts)
  END AS son_seans_at
) sn
CROSS JOIN LATERAL (
  -- Şu an açık (montajda / paketlemede; bekletilenler dahil) seans sayısı: hat satırları için
  SELECT CASE
    WHEN e.hat_id IS NULL THEN 0
    WHEN e.hat_tur = 'montaj' THEN (
      SELECT count(*)::integer FROM public.montaj_sessions ms
      WHERE ms.durum = 'montajda'
        AND (ms.talimat_satir_id = e.satir_id OR (ms.hat_id = e.hat_id AND ms.sku = e.sku)))
    ELSE (
      SELECT count(*)::integer FROM public.pack_events pe
      WHERE pe.durum = 'paketlemede'
        AND (pe.talimat_satir_id = e.satir_id OR (pe.hat_id = e.hat_id AND pe.sku = e.sku)))
  END AS acik_seans_sayisi
) ac;

-- katkı: hat satırlarında yalnız o hattın seansları
CREATE OR REPLACE VIEW public.talimat_satir_katki AS
SELECT
  e.satir_id,
  ms.operator_id AS personel_id,
  ms.step_id, ms.step_name, ms.seq_no, ms.is_final_step,
  sum(ms.qty)  AS qty,
  count(*)     AS seans_sayisi
FROM public.talimat_satir_etkin e
JOIN public.montaj_sessions ms
  ON ms.sku = e.sku
 AND ms.durum = 'tamamlandi'
 AND (e.hat_id IS NULL OR ms.hat_id = e.hat_id)
 AND COALESCE(ms.end_time, ms.start_time) >= e.sayac_bas_ts
 AND COALESCE(ms.end_time, ms.start_time) <  e.hafta_son_ts
WHERE e.etkin_istasyon = 'montaj'
GROUP BY e.satir_id, ms.operator_id, ms.step_id, ms.step_name, ms.seq_no, ms.is_final_step;

-- plan özeti: hat_sayisi + degisen_hatlar sona
CREATE OR REPLACE VIEW public.talimat_plan_ozet AS
SELECT
  p.plan_id, p.hafta_baslangic, p.durum, p.yayinlandi_at, p.pasif_at,
  p.pazartesi_bildirim_at, p.degisen_personeller, p.kaynak_plan_id, p.olusturan,
  p.created_at, p.updated_at,
  g.bitis AS guncel_bitis,
  COALESCE(g.bitis >= public.talimat_bugun(), false) AS guncel_mi,
  (SELECT count(*) FROM public.talimat_satirlar s
    WHERE s.plan_id = p.plan_id AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)) AS satir_sayisi,
  (SELECT count(*) FROM public.talimat_satirlar s
    WHERE s.plan_id = p.plan_id AND s.degisti AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)) AS degisen_satir_sayisi,
  (SELECT count(DISTINCT s.personel_id) FROM public.talimat_satirlar s
    WHERE s.plan_id = p.plan_id AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)) AS personel_sayisi,
  (SELECT count(DISTINCT s.hat_id) FROM public.talimat_satirlar s
    WHERE s.plan_id = p.plan_id AND s.hat_id IS NOT NULL AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)) AS hat_sayisi,
  p.degisen_hatlar
FROM public.talimat_planlar p
LEFT JOIN LATERAL (
  SELECT bitis FROM public.talimat_guncellik gg
  WHERE gg.plan_id = p.plan_id ORDER BY gg.created_at DESC, gg.id DESC LIMIT 1
) g ON true;

ALTER VIEW public.talimat_satir_etkin    SET (security_invoker = true);
ALTER VIEW public.talimat_satir_ilerleme SET (security_invoker = true);
ALTER VIEW public.talimat_satir_katki    SET (security_invoker = true);
ALTER VIEW public.talimat_plan_ozet      SET (security_invoker = true);
GRANT SELECT ON public.talimat_satir_etkin    TO authenticated;
GRANT SELECT ON public.talimat_satir_ilerleme TO authenticated;
GRANT SELECT ON public.talimat_satir_katki    TO authenticated;
GRANT SELECT ON public.talimat_plan_ozet      TO authenticated;

-- ── 5) Yardımcılar ────────────────────────────────────────────

-- Seansın kişileri: operatör + workers JSON ([{id,name}])
CREATE OR REPLACE FUNCTION public.talimat_seans_kisileri(p_operator TEXT, p_workers JSONB)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::text[])
  FROM (
    SELECT p_operator AS x
    UNION ALL
    SELECT w ->> 'id'
    FROM jsonb_array_elements(CASE WHEN p_workers IS NOT NULL AND jsonb_typeof(p_workers) = 'array'
                                   THEN p_workers ELSE '[]'::jsonb END) AS w
  ) q
  WHERE x IS NOT NULL AND x <> '';
$$;

-- Paketleme: operatör + personel CSV ("VW001,VW002") + workers JSON
CREATE OR REPLACE FUNCTION public.talimat_pack_kisileri(p_operator TEXT, p_personel TEXT, p_workers JSONB)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT x), '{}'::text[])
  FROM (
    SELECT unnest(public.talimat_seans_kisileri(p_operator, p_workers)) AS x
    UNION ALL
    SELECT unnest(string_to_array(replace(COALESCE(p_personel, ''), ' ', ''), ','))
  ) q
  WHERE x IS NOT NULL AND x <> '';
$$;

GRANT EXECUTE ON FUNCTION public.talimat_seans_kisileri(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.talimat_pack_kisileri(TEXT, TEXT, JSONB) TO authenticated;

-- Genel sıra yerleştirici: grup = (hat_id) veya (personel_id). p_satir verilirse o satır p_hedef konumuna girer.
-- Sırası değişen satırlar yayınlanmış planda degisti=true olur (boş satırlar hariç).
CREATE OR REPLACE FUNCTION public.talimat_sira_yerlestir_g(
  p_plan UUID, p_hat UUID, p_personel TEXT, p_satir UUID DEFAULT NULL, p_hedef INTEGER DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_yayinda BOOLEAN;
BEGIN
  SELECT durum = 'yayinda' INTO v_yayinda FROM public.talimat_planlar WHERE plan_id = p_plan;

  WITH diger AS (
    SELECT satir_id, row_number() OVER (ORDER BY sira, created_at) AS r
    FROM public.talimat_satirlar
    WHERE plan_id = p_plan
      AND hat_id IS NOT DISTINCT FROM p_hat
      AND personel_id IS NOT DISTINCT FROM p_personel
      AND satir_id IS DISTINCT FROM p_satir
  ),
  hepsi AS (
    SELECT satir_id, r::numeric AS k FROM diger
    UNION ALL
    SELECT p_satir,
           LEAST(GREATEST(COALESCE(p_hedef, 1), 1), (SELECT count(*) + 1 FROM diger))::numeric - 0.5
    WHERE p_satir IS NOT NULL
  ),
  sirali AS (
    SELECT satir_id, row_number() OVER (ORDER BY k) AS yeni FROM hepsi
  )
  UPDATE public.talimat_satirlar s
  SET sira = sirali.yeni,
      degisti = s.degisti OR (COALESCE(v_yayinda, false) AND s.sira <> sirali.yeni
                              AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL))
  FROM sirali
  WHERE s.satir_id = sirali.satir_id AND s.sira <> sirali.yeni;
END;
$$;

-- Personel sürümü: NULL personel (hat satırı) yok sayılır (talimat_satir_kapat / yeniden_aktif hat satırında NULL gönderebilir)
CREATE OR REPLACE FUNCTION public.talimat_degisen_isaretle(p_plan UUID, p_personel TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.talimat_planlar
  SET degisen_personeller = array_append(degisen_personeller, p_personel)
  WHERE plan_id = p_plan AND durum = 'yayinda' AND p_personel IS NOT NULL
    AND NOT (p_personel = ANY (degisen_personeller));
$$;

-- Yayınlanmamış değişikliği olan hat/personeli plana işle (silme/sıra kayması için)
CREATE OR REPLACE FUNCTION public.talimat_degisen_grup_isaretle(p_plan UUID, p_hat UUID, p_personel TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_hat IS NOT NULL THEN
    UPDATE public.talimat_planlar
    SET degisen_hatlar = array_append(degisen_hatlar, p_hat)
    WHERE plan_id = p_plan AND durum = 'yayinda' AND NOT (p_hat = ANY (degisen_hatlar));
  ELSIF p_personel IS NOT NULL THEN
    PERFORM public.talimat_degisen_isaretle(p_plan, p_personel);
  END IF;
END;
$$;

-- Plandaki her AKTİF hat için en az bir (boş) satır sağlar. Dönen: eklenen satır sayısı.
CREATE OR REPLACE FUNCTION public.talimat_plan_hat_hazirla_ic(p_plan UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INTEGER := 0;
  v_durum TEXT;
BEGIN
  SELECT durum INTO v_durum FROM public.talimat_planlar WHERE plan_id = p_plan;
  IF v_durum IS NULL OR v_durum = 'pasif' THEN RETURN 0; END IF;

  INSERT INTO public.talimat_satirlar (plan_id, hat_id, sira, istasyon)
  SELECT p_plan, h.hat_id, 1, h.tur
  FROM public.talimat_hatlar h
  WHERE h.aktif
    AND NOT EXISTS (SELECT 1 FROM public.talimat_satirlar s WHERE s.plan_id = p_plan AND s.hat_id = h.hat_id);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_plan_hat_satirlari_hazirla(p_plan UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  RETURN public.talimat_plan_hat_hazirla_ic(p_plan);
END;
$$;

-- ── 6) Hat yönetimi RPC'leri (planlayıcı) ─────────────────────

CREATE OR REPLACE FUNCTION public.hat_ekle(p_ad TEXT, p_tur TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ad TEXT := btrim(COALESCE(p_ad, ''));
  v_id UUID;
  r RECORD;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  IF v_ad = '' THEN RAISE EXCEPTION 'Hat adı boş olamaz'; END IF;
  IF p_tur IS NULL OR p_tur NOT IN ('montaj', 'paketleme') THEN
    RAISE EXCEPTION 'Geçersiz hat türü: % (montaj|paketleme)', p_tur;
  END IF;
  IF EXISTS (SELECT 1 FROM public.talimat_hatlar WHERE lower(ad) = lower(v_ad)) THEN
    RAISE EXCEPTION 'Bu isimde hat zaten var';
  END IF;

  INSERT INTO public.talimat_hatlar (ad, tur, sira)
  VALUES (v_ad, p_tur, COALESCE((SELECT max(sira) FROM public.talimat_hatlar), 0) + 1)
  RETURNING hat_id INTO v_id;

  -- Yeni hat mevcut (pasif olmayan) planlarda hemen görünsün: 1 boş satır
  FOR r IN SELECT plan_id FROM public.talimat_planlar WHERE durum <> 'pasif' LOOP
    PERFORM public.talimat_plan_hat_hazirla_ic(r.plan_id);
  END LOOP;
  RETURN v_id;
END;
$$;

-- Yalnızca gelen (NULL olmayan) alanlar değişir. Tür değişirse hattın satırlarının istasyonu da güncellenir.
CREATE OR REPLACE FUNCTION public.hat_guncelle(
  p_hat UUID, p_ad TEXT DEFAULT NULL, p_tur TEXT DEFAULT NULL, p_sira INTEGER DEFAULT NULL, p_aktif BOOLEAN DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_h public.talimat_hatlar%ROWTYPE;
  v_ad TEXT := NULLIF(btrim(COALESCE(p_ad, '')), '');
  r RECORD;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_h FROM public.talimat_hatlar WHERE hat_id = p_hat FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Hat bulunamadı'; END IF;
  IF p_tur IS NOT NULL AND p_tur NOT IN ('montaj', 'paketleme') THEN
    RAISE EXCEPTION 'Geçersiz hat türü: % (montaj|paketleme)', p_tur;
  END IF;
  IF v_ad IS NOT NULL AND EXISTS (SELECT 1 FROM public.talimat_hatlar WHERE lower(ad) = lower(v_ad) AND hat_id <> p_hat) THEN
    RAISE EXCEPTION 'Bu isimde hat zaten var';
  END IF;

  UPDATE public.talimat_hatlar
  SET ad = COALESCE(v_ad, ad), tur = COALESCE(p_tur, tur),
      sira = COALESCE(p_sira, sira), aktif = COALESCE(p_aktif, aktif)
  WHERE hat_id = p_hat;

  IF p_tur IS NOT NULL AND p_tur <> v_h.tur THEN
    UPDATE public.talimat_satirlar SET istasyon = p_tur WHERE hat_id = p_hat;
  END IF;
  IF COALESCE(p_aktif, v_h.aktif) THEN
    FOR r IN SELECT plan_id FROM public.talimat_planlar WHERE durum <> 'pasif' LOOP
      PERFORM public.talimat_plan_hat_hazirla_ic(r.plan_id);
    END LOOP;
  END IF;
END;
$$;

-- Hattı pasife al / geri aç (satırlar silinmez; arayüz pasif hatları göstermez)
CREATE OR REPLACE FUNCTION public.hat_pasif(p_hat UUID, p_pasif BOOLEAN DEFAULT true)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.hat_guncelle(p_hat, NULL, NULL, NULL, NOT COALESCE(p_pasif, true));
END;
$$;

-- ── 7) Plan ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.talimat_plan_getir_veya_olustur(p_hafta DATE DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hafta DATE := date_trunc('week', COALESCE(p_hafta, public.talimat_bugun())::timestamp)::date;
  v_id UUID;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT plan_id INTO v_id FROM public.talimat_planlar WHERE hafta_baslangic = v_hafta;
  IF v_id IS NULL THEN
    INSERT INTO public.talimat_planlar (hafta_baslangic, durum, olusturan)
    VALUES (v_hafta, 'taslak', public.talimat_kullanici_id())
    RETURNING plan_id INTO v_id;
  END IF;
  -- Her aktif hat için en az 1 boş satır (idempotent; pasif planda işlem yapmaz)
  PERFORM public.talimat_plan_hat_hazirla_ic(v_id);
  RETURN v_id;
END;
$$;

-- Haftayı kopyala: hat satırları + (varsa eski) personel satırları. Hedef plan yoksa taslak oluşturulur;
-- hedefte yalnız boş hat satırları varsa onlar temizlenip yerine kopyalar yazılır; dolu hedef hata verir.
CREATE OR REPLACE FUNCTION public.talimat_kopyala_hafta(p_kaynak_plan UUID, p_hedef_hafta DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hafta DATE := date_trunc('week', p_hedef_hafta::timestamp)::date;
  v_hedef UUID;
  v_n INTEGER;
  r RECORD;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  IF NOT EXISTS (SELECT 1 FROM public.talimat_planlar WHERE plan_id = p_kaynak_plan) THEN
    RAISE EXCEPTION 'Kaynak plan bulunamadı';
  END IF;

  SELECT plan_id INTO v_hedef FROM public.talimat_planlar WHERE hafta_baslangic = v_hafta;
  IF v_hedef IS NULL THEN
    INSERT INTO public.talimat_planlar (hafta_baslangic, durum, olusturan, kaynak_plan_id)
    VALUES (v_hafta, 'taslak', public.talimat_kullanici_id(), p_kaynak_plan)
    RETURNING plan_id INTO v_hedef;
  ELSE
    IF v_hedef = p_kaynak_plan THEN RAISE EXCEPTION 'Plan kendi üzerine kopyalanamaz'; END IF;
    SELECT count(*) INTO v_n FROM public.talimat_satirlar
    WHERE plan_id = v_hedef AND (sku IS NOT NULL OR plaka_id IS NOT NULL);
    IF v_n > 0 THEN RAISE EXCEPTION 'Hedef haftanın planı dolu, kopyalanamaz'; END IF;
    IF (SELECT durum FROM public.talimat_planlar WHERE plan_id = v_hedef) = 'pasif' THEN
      RAISE EXCEPTION 'PLAN_PASIF: Hedef plan pasif';
    END IF;
    -- Boş (ürünsüz) hat satırlarını tek tek temizle; kopyalar onların yerine yazılır
    FOR r IN SELECT satir_id FROM public.talimat_satirlar WHERE plan_id = v_hedef LOOP
      DELETE FROM public.talimat_satirlar WHERE satir_id = r.satir_id;
    END LOOP;
  END IF;

  INSERT INTO public.talimat_satirlar
    (plan_id, personel_id, hat_id, sira, istasyon, sku, plaka_id, istenen_miktar, not_text, talep_id, durum, degisti)
  SELECT v_hedef, s.personel_id, s.hat_id, s.sira, s.istasyon, s.sku, s.plaka_id, s.istenen_miktar,
         s.not_text, s.talep_id, 'aktif',
         COALESCE((SELECT pp.durum = 'yayinda' FROM public.talimat_planlar pp WHERE pp.plan_id = v_hedef), false)
           AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL)
  FROM public.talimat_satirlar s
  WHERE s.plan_id = p_kaynak_plan
    AND ((s.hat_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.talimat_hatlar h WHERE h.hat_id = s.hat_id AND h.aktif))
         OR (s.hat_id IS NULL AND s.personel_id IN (SELECT user_id FROM public.users WHERE is_active = true)));

  PERFORM public.talimat_plan_hat_hazirla_ic(v_hedef);
  RETURN v_hedef;
END;
$$;

-- ── 8) Satır CRUD (hat destekli) ──────────────────────────────

-- p (jsonb) anahtarları: satir_id (güncelleme), plan_id (yeni satır), hat_id, personel_id (eski satırlar; hat satırında
-- yok sayılır), sira, kaydir, istasyon (hat satırında hat türünden gelir), sku, plaka_id, istenen_miktar, not_text,
-- talep_id, durum, pasif_neden, pasif_baslangic, pasif_until. Anahtar yoksa alan değişmez; null ise temizlenir.
-- Yeni satırda sira doluysa: kaydir=true -> araya girer, değilse SIRA_DOLU. sira yoksa hattın sonuna eklenir.
-- Satırın hattı değiştirilirse (hat_id) satır yeni hattın sonuna taşınır (sira verilirse oraya).
CREATE OR REPLACE FUNCTION public.talimat_satir_kaydet(p JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id          UUID := NULLIF(p ->> 'satir_id', '')::uuid;
  v_eski        public.talimat_satirlar%ROWTYPE;
  v_plan        public.talimat_planlar%ROWTYPE;
  v_plan_id     UUID;
  v_hat         UUID;
  v_hat_tur     TEXT;
  v_personel    TEXT;
  v_sku         TEXT;
  v_plaka       TEXT;
  v_ist         TEXT;
  v_miktar      NUMERIC;
  v_not         TEXT;
  v_talep       UUID;
  v_durum       TEXT;
  v_pneden      TEXT;
  v_pbas        DATE;
  v_puntil      DATE;
  v_sira        INTEGER := NULLIF(p ->> 'sira', '')::integer;
  v_kaydir      BOOLEAN := COALESCE((p ->> 'kaydir')::boolean, false);
  v_yayinda     BOOLEAN;
  v_degisti     BOOLEAN := false;
  v_n           INTEGER;
  v_grup_degisti BOOLEAN := false;
  v_bos         BOOLEAN;
  v_eski_bos    BOOLEAN := true;
BEGIN
  PERFORM public.talimat_yetki_planlayici();

  IF v_id IS NOT NULL THEN
    SELECT * INTO v_eski FROM public.talimat_satirlar WHERE satir_id = v_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Satır bulunamadı'; END IF;
    v_plan_id := v_eski.plan_id;
  ELSE
    v_plan_id := NULLIF(p ->> 'plan_id', '')::uuid;
    IF v_plan_id IS NULL THEN RAISE EXCEPTION 'plan_id gerekli'; END IF;
  END IF;

  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = v_plan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;
  v_yayinda := v_plan.durum = 'yayinda';

  -- Alan değerleri (anahtar varsa yeni değer, yoksa eski)
  v_hat      := CASE WHEN p ? 'hat_id' THEN NULLIF(p ->> 'hat_id', '')::uuid ELSE v_eski.hat_id END;
  v_personel := CASE WHEN v_hat IS NOT NULL THEN NULL
                     WHEN p ? 'personel_id' THEN NULLIF(p ->> 'personel_id', '')
                     ELSE v_eski.personel_id END;
  v_sku      := CASE WHEN p ? 'sku'         THEN NULLIF(p ->> 'sku', '')         ELSE v_eski.sku END;
  v_plaka    := CASE WHEN p ? 'plaka_id'    THEN NULLIF(p ->> 'plaka_id', '')    ELSE v_eski.plaka_id END;
  v_ist      := CASE WHEN p ? 'istasyon'    THEN NULLIF(p ->> 'istasyon', '')    ELSE v_eski.istasyon END;
  v_miktar   := CASE WHEN p ? 'istenen_miktar' THEN NULLIF(p ->> 'istenen_miktar', '')::numeric ELSE v_eski.istenen_miktar END;
  v_not      := CASE WHEN p ? 'not_text'    THEN NULLIF(btrim(p ->> 'not_text'), '') ELSE v_eski.not_text END;
  v_talep    := CASE WHEN p ? 'talep_id'    THEN NULLIF(p ->> 'talep_id', '')::uuid ELSE v_eski.talep_id END;
  v_durum    := CASE WHEN p ? 'durum'       THEN COALESCE(NULLIF(p ->> 'durum', ''), 'aktif') ELSE COALESCE(v_eski.durum, 'aktif') END;

  IF v_hat IS NULL AND v_personel IS NULL THEN RAISE EXCEPTION 'Hat veya personel seçilmeli'; END IF;

  IF v_hat IS NOT NULL THEN
    SELECT tur INTO v_hat_tur FROM public.talimat_hatlar
    WHERE hat_id = v_hat AND (aktif OR v_hat IS NOT DISTINCT FROM v_eski.hat_id);
    IF v_hat_tur IS NULL THEN RAISE EXCEPTION 'Hat bulunamadı veya pasif'; END IF;
    v_ist := v_hat_tur;          -- istasyon hattın türünden
    v_plaka := NULL;             -- hat satırlarında plaka yok (kesim hattı yok)
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.users
      WHERE user_id = v_personel AND is_active = true AND role::text IN ('Üretim', 'Hat')
    ) THEN
      RAISE EXCEPTION 'Geçersiz personel: % (yalnızca aktif Üretim/Hat personeli)', v_personel;
    END IF;
  END IF;

  IF v_plaka IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.plakalar WHERE plaka_id = v_plaka) THEN
      RAISE EXCEPTION 'Plaka bulunamadı: %', v_plaka;
    END IF;
    IF v_sku IS NULL THEN
      SELECT sku[1] INTO v_sku FROM public.plakalar
      WHERE plaka_id = v_plaka AND sku IS NOT NULL AND cardinality(sku) = 1 LIMIT 1;
    END IF;
  END IF;
  -- Ürün/plaka zorunlu değil: ürünsüz (boş) satır geçerlidir (ürün sonra seçilir)
  IF v_sku IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products WHERE sku = v_sku) THEN
    RAISE EXCEPTION 'Ürün bulunamadı: %', v_sku;
  END IF;
  v_bos := v_sku IS NULL AND v_plaka IS NULL;
  IF v_id IS NOT NULL THEN v_eski_bos := v_eski.sku IS NULL AND v_eski.plaka_id IS NULL; END IF;
  IF v_ist IS NOT NULL AND v_ist NOT IN ('kesim', 'montaj', 'paketleme') THEN
    RAISE EXCEPTION 'Geçersiz istasyon: %', v_ist;
  END IF;
  IF v_miktar IS NOT NULL AND v_miktar <= 0 THEN RAISE EXCEPTION 'İstenen miktar sıfırdan büyük olmalı'; END IF;
  IF v_durum NOT IN ('aktif', 'pasif', 'tamamlandi') THEN RAISE EXCEPTION 'Geçersiz durum: %', v_durum; END IF;
  IF v_talep IS NOT NULL AND v_talep IS DISTINCT FROM v_eski.talep_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.talepler WHERE talep_id = v_talep AND kapanis IS NULL) THEN
      RAISE EXCEPTION 'Talep bulunamadı veya kapalı';
    END IF;
  END IF;

  IF v_durum = 'pasif' THEN
    v_pneden := CASE WHEN p ? 'pasif_neden'     THEN NULLIF(p ->> 'pasif_neden', '')          ELSE v_eski.pasif_neden END;
    v_pbas   := CASE WHEN p ? 'pasif_baslangic' THEN NULLIF(p ->> 'pasif_baslangic', '')::date ELSE COALESCE(v_eski.pasif_baslangic, public.talimat_bugun()) END;
    v_puntil := CASE WHEN p ? 'pasif_until'     THEN NULLIF(p ->> 'pasif_until', '')::date     ELSE v_eski.pasif_until END;
  END IF;

  IF v_id IS NULL THEN
    -- ── Yeni satır ──
    SELECT count(*) INTO v_n FROM public.talimat_satirlar
    WHERE plan_id = v_plan_id AND hat_id IS NOT DISTINCT FROM v_hat AND personel_id IS NOT DISTINCT FROM v_personel;
    IF v_sira IS NOT NULL AND v_sira <= v_n AND NOT v_kaydir THEN
      RAISE EXCEPTION 'SIRA_DOLU: % numaralı öncelik dolu', v_sira;
    END IF;

    INSERT INTO public.talimat_satirlar
      (plan_id, personel_id, hat_id, sira, istasyon, sku, plaka_id, istenen_miktar, not_text, talep_id,
       durum, pasif_neden, pasif_baslangic, pasif_until, degisti)
    VALUES
      (v_plan_id, v_personel, v_hat, v_n + 1, v_ist, v_sku, v_plaka, v_miktar, v_not, v_talep,
       v_durum, v_pneden, v_pbas, v_puntil, v_yayinda AND NOT v_bos)
    RETURNING satir_id INTO v_id;

    IF v_sira IS NOT NULL AND v_sira <= v_n THEN
      PERFORM public.talimat_sira_yerlestir_g(v_plan_id, v_hat, v_personel, v_id, v_sira);
    END IF;
  ELSE
    -- ── Güncelleme ──
    v_grup_degisti := v_hat IS DISTINCT FROM v_eski.hat_id OR v_personel IS DISTINCT FROM v_eski.personel_id;

    v_degisti := v_yayinda AND NOT (v_bos AND v_eski_bos) AND (
      v_grup_degisti
      OR v_sku IS DISTINCT FROM v_eski.sku OR v_plaka IS DISTINCT FROM v_eski.plaka_id
      OR v_ist IS DISTINCT FROM v_eski.istasyon OR v_miktar IS DISTINCT FROM v_eski.istenen_miktar
      OR v_not IS DISTINCT FROM v_eski.not_text OR v_durum IS DISTINCT FROM v_eski.durum
      OR (v_durum = 'pasif' AND (v_pbas IS DISTINCT FROM v_eski.pasif_baslangic
                                 OR v_puntil IS DISTINCT FROM v_eski.pasif_until))
    );

    IF v_grup_degisti AND NOT (p ? 'durum') THEN
      -- Başka hatta/personele devredilen iş aktifleşir (talep durumu da yeniden aktif görünür)
      v_durum := 'aktif';
    END IF;
    IF v_durum <> 'pasif' THEN
      v_pneden := NULL; v_pbas := NULL; v_puntil := NULL;
    END IF;

    SELECT count(*) INTO v_n FROM public.talimat_satirlar
    WHERE plan_id = v_plan_id AND hat_id IS NOT DISTINCT FROM v_hat AND personel_id IS NOT DISTINCT FROM v_personel;

    UPDATE public.talimat_satirlar SET
      personel_id = v_personel,
      hat_id = v_hat,
      sira = CASE WHEN v_grup_degisti THEN v_n + 1 ELSE sira END,
      istasyon = v_ist, sku = v_sku, plaka_id = v_plaka, istenen_miktar = v_miktar,
      not_text = v_not, talep_id = v_talep, durum = v_durum,
      pasif_neden = v_pneden, pasif_baslangic = v_pbas, pasif_until = v_puntil,
      degisti = degisti OR v_degisti
    WHERE satir_id = v_id;

    IF v_grup_degisti THEN
      PERFORM public.talimat_sira_yerlestir_g(v_plan_id, v_eski.hat_id, v_eski.personel_id);
      IF NOT v_eski_bos THEN
        PERFORM public.talimat_degisen_grup_isaretle(v_plan_id, v_eski.hat_id, v_eski.personel_id);
      END IF;
      IF v_sira IS NOT NULL THEN
        PERFORM public.talimat_sira_yerlestir_g(v_plan_id, v_hat, v_personel, v_id, v_sira);
      END IF;
      UPDATE public.talimat_satirlar SET degisti = degisti OR (v_yayinda AND NOT v_bos) WHERE satir_id = v_id;
    ELSIF v_sira IS NOT NULL AND v_sira <> v_eski.sira THEN
      PERFORM public.talimat_sira_yerlestir_g(v_plan_id, v_hat, v_personel, v_id, v_sira);
    END IF;
  END IF;

  IF v_id IS NOT NULL AND v_bos AND NOT v_eski_bos THEN
    -- Dolu satırın ürünü kaldırıldı: tablette düşer, hat/personel değişen sayılır
    PERFORM public.talimat_degisen_grup_isaretle(v_plan_id, v_hat, v_personel);
  END IF;
  -- Hattın son satırı başka hatta taşındıysa eski hat boş satırla kalsın
  PERFORM public.talimat_plan_hat_hazirla_ic(v_plan_id);

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.talimat_satir_sil(p_satir UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.talimat_satirlar%ROWTYPE;
  v_durum TEXT;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_s FROM public.talimat_satirlar WHERE satir_id = p_satir FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Satır bulunamadı'; END IF;
  SELECT durum INTO v_durum FROM public.talimat_planlar WHERE plan_id = v_s.plan_id;
  IF v_durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

  DELETE FROM public.talimat_satirlar WHERE satir_id = p_satir;
  PERFORM public.talimat_sira_yerlestir_g(v_s.plan_id, v_s.hat_id, v_s.personel_id);
  IF v_s.sku IS NOT NULL OR v_s.plaka_id IS NOT NULL THEN
    PERFORM public.talimat_degisen_grup_isaretle(v_s.plan_id, v_s.hat_id, v_s.personel_id);
  END IF;
  -- Hattın son satırı silindiyse hat yine 1 boş satırla kalır
  PERFORM public.talimat_plan_hat_hazirla_ic(v_s.plan_id);
END;
$$;

-- Eski personel bazlı sıralama (değişmedi; yalnız eski satırlar)
-- Hat içi sıralama: dizi = o hattın TÜM satırları
CREATE OR REPLACE FUNCTION public.talimat_satir_sirala_hat(p_plan UUID, p_hat UUID, p_satir_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan public.talimat_planlar%ROWTYPE;
  v_n INTEGER;
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  SELECT * INTO v_plan FROM public.talimat_planlar WHERE plan_id = p_plan FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan bulunamadı'; END IF;
  IF v_plan.durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

  SELECT count(*) INTO v_n FROM public.talimat_satirlar WHERE plan_id = p_plan AND hat_id = p_hat;
  IF p_satir_ids IS NULL OR cardinality(p_satir_ids) <> v_n
     OR (SELECT count(DISTINCT x) FROM unnest(p_satir_ids) x) <> v_n
     OR EXISTS (
       SELECT 1 FROM unnest(p_satir_ids) x
       WHERE NOT EXISTS (SELECT 1 FROM public.talimat_satirlar s
                         WHERE s.satir_id = x AND s.plan_id = p_plan AND s.hat_id = p_hat)
     ) THEN
    RAISE EXCEPTION 'Sıralama listesi hattın tüm satırlarını içermeli';
  END IF;

  UPDATE public.talimat_satirlar s
  SET sira = o.ord::integer,
      degisti = s.degisti OR (v_plan.durum = 'yayinda' AND s.sira <> o.ord
                              AND (s.sku IS NOT NULL OR s.plaka_id IS NOT NULL))
  FROM unnest(p_satir_ids) WITH ORDINALITY AS o(id, ord)
  WHERE s.satir_id = o.id AND s.sira <> o.ord;
END;
$$;

-- Seçili satırları başka bir hattın SONUNA kopyalar (aynı plan). Hedef hattaki BOŞ satırlar önce doldurulur,
-- gerekirse yeni satır açılır. sku, istenen miktar, not ve (açık) talep bağı kopyalanır; sayaç sıfırdan başlar.
-- Dönen: yeni/doldurulan satır id'leri (verilen sırayla; boş kaynak satırlar atlanır).
CREATE OR REPLACE FUNCTION public.talimat_satirlari_hatta_kopyala(p_satir_ids UUID[], p_hedef_hat UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan UUID;
  v_planlar INTEGER;
  v_bulunan INTEGER;
  v_durum TEXT;
  r RECORD;
  v_bos UUID;
  v_id UUID;
  v_talep UUID;
  v_yeni UUID[] := '{}';
BEGIN
  PERFORM public.talimat_yetki_planlayici();
  IF p_satir_ids IS NULL OR cardinality(p_satir_ids) = 0 THEN RAISE EXCEPTION 'Kopyalanacak satır seçilmedi'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.talimat_hatlar WHERE hat_id = p_hedef_hat AND aktif) THEN
    RAISE EXCEPTION 'Hedef hat bulunamadı veya pasif';
  END IF;

  SELECT count(DISTINCT plan_id), count(*), (array_agg(plan_id))[1]
    INTO v_planlar, v_bulunan, v_plan
  FROM public.talimat_satirlar WHERE satir_id = ANY (p_satir_ids);
  IF v_bulunan <> (SELECT count(DISTINCT x) FROM unnest(p_satir_ids) x) THEN
    RAISE EXCEPTION 'Satır bulunamadı';
  END IF;
  IF v_planlar <> 1 THEN RAISE EXCEPTION 'Satırlar aynı plandan olmalı'; END IF;
  SELECT durum INTO v_durum FROM public.talimat_planlar WHERE plan_id = v_plan;
  IF v_durum = 'pasif' THEN RAISE EXCEPTION 'PLAN_PASIF: Pasif plan düzenlenemez'; END IF;

  FOR r IN
    SELECT s.*
    FROM unnest(p_satir_ids) WITH ORDINALITY AS o(id, ord)
    JOIN public.talimat_satirlar s ON s.satir_id = o.id
    WHERE s.sku IS NOT NULL
    ORDER BY o.ord
  LOOP
    v_talep := NULL;
    IF r.talep_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.talepler WHERE talep_id = r.talep_id AND kapanis IS NULL) THEN
      v_talep := r.talep_id;
    END IF;

    SELECT satir_id INTO v_bos FROM public.talimat_satirlar
    WHERE plan_id = v_plan AND hat_id = p_hedef_hat AND sku IS NULL AND plaka_id IS NULL
    ORDER BY sira LIMIT 1;

    IF v_bos IS NOT NULL THEN
      v_id := public.talimat_satir_kaydet(jsonb_build_object(
        'satir_id', v_bos, 'sku', r.sku, 'istenen_miktar', r.istenen_miktar,
        'not_text', r.not_text, 'talep_id', v_talep, 'durum', 'aktif'));
    ELSE
      v_id := public.talimat_satir_kaydet(jsonb_build_object(
        'plan_id', v_plan, 'hat_id', p_hedef_hat, 'sku', r.sku, 'istenen_miktar', r.istenen_miktar,
        'not_text', r.not_text, 'talep_id', v_talep));
    END IF;
    v_yeni := array_append(v_yeni, v_id);
  END LOOP;

  IF cardinality(v_yeni) = 0 THEN RAISE EXCEPTION 'Kopyalanacak dolu satır yok'; END IF;
  RETURN v_yeni;
END;
$$;

-- ── 9) Tek açık seans kuralı ──────────────────────────────────
-- Bir personel aynı ürünün aynı aşamasında (montaj) / aynı ürünün paketlemesinde ikinci açık seans açamaz.
-- Açık = montaj durum 'montajda' (bekletilenler dahil) / paketleme 'paketlemede'. Kişi kümesi: operatör + workers.
CREATE OR REPLACE FUNCTION public.montaj_acik_seans_kontrol()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.durum = 'montajda' AND NEW.sku IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.montaj_sessions o
      WHERE o.durum = 'montajda'
        AND o.sku = NEW.sku
        AND o.step_id IS NOT DISTINCT FROM NEW.step_id
        AND o.session_id <> NEW.session_id
        AND public.talimat_seans_kisileri(o.operator_id, o.workers)
            && public.talimat_seans_kisileri(NEW.operator_id, NEW.workers)
    ) THEN
      RAISE EXCEPTION 'Bu personelin bu ürün/aşamada açık seansı var';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.pack_acik_seans_kontrol()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.durum = 'paketlemede' AND NEW.sku IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.pack_events o
      WHERE o.durum = 'paketlemede'
        AND o.sku = NEW.sku
        AND o.session_id IS DISTINCT FROM NEW.session_id
        AND public.talimat_pack_kisileri(o.operator_id, o.personel, o.workers)
            && public.talimat_pack_kisileri(NEW.operator_id, NEW.personel, NEW.workers)
    ) THEN
      RAISE EXCEPTION 'Bu personelin bu ürün/aşamada açık seansı var';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_montaj_acik_seans ON public.montaj_sessions;
CREATE TRIGGER trg_montaj_acik_seans
  BEFORE INSERT ON public.montaj_sessions
  FOR EACH ROW EXECUTE FUNCTION public.montaj_acik_seans_kontrol();

DROP TRIGGER IF EXISTS trg_pack_acik_seans ON public.pack_events;
CREATE TRIGGER trg_pack_acik_seans
  BEFORE INSERT ON public.pack_events
  FOR EACH ROW EXECUTE FUNCTION public.pack_acik_seans_kontrol();

-- ── 10) Yetkiler ──────────────────────────────────────────────
DO $$
DECLARE
  f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'hat_ekle(text,text)',
    'hat_guncelle(uuid,text,text,integer,boolean)',
    'hat_pasif(uuid,boolean)',
    'talimat_plan_hat_satirlari_hazirla(uuid)',
    'talimat_satir_sirala_hat(uuid,uuid,uuid[])',
    'talimat_satirlari_hatta_kopyala(uuid[],uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO authenticated', f);
  END LOOP;

  FOREACH f IN ARRAY ARRAY[
    'talimat_sira_yerlestir_g(uuid,uuid,text,uuid,integer)',
    'talimat_degisen_grup_isaretle(uuid,uuid,text)',
    'talimat_plan_hat_hazirla_ic(uuid)',
    'montaj_acik_seans_kontrol()',
    'pack_acik_seans_kontrol()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;
