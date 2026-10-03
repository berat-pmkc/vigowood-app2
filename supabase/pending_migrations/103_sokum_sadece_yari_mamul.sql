-- Söküm artık yalnızca YARI MAMULLERİ kapsar (kullanıcı kararı 2026-10-03):
-- hazır elemanlar (vida, menteşe, mıknatıs...) söküm listesinde yer almaz,
-- girilmeyen hazır eleman miktarı otomatik fire SAYILMAZ.
CREATE OR REPLACE FUNCTION public.kalite_sokum(
  p_sku TEXT, p_qty NUMERIC, p_parts JSONB DEFAULT '[]'::jsonb,
  p_operator_id TEXT DEFAULT NULL, p_operator_name TEXT DEFAULT NULL, p_not TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_adi    TEXT;
  v_parent TEXT;
  r        RECORD;
  e        JSONB;
  v_exp    NUMERIC;
  v_sag    NUMERIC;
  v_fire   NUMERIC;
  v_kalan  NUMERIC;
  v_known  TEXT[];
BEGIN
  PERFORM public._klt_auth();
  IF p_qty IS NULL OR p_qty <= 0 THEN RAISE EXCEPTION 'Miktar 0''dan büyük olmalı'; END IF;
  v_adi := public._klt_item_adi('URUN', p_sku);
  PERFORM public._klt_bakiye_kontrol('URUN', p_sku, p_qty);

  SELECT array_agg(x.part_id) INTO v_known FROM public.urun_yari_mamul_listesi(p_sku) x WHERE x.part_type = 'YARIMAMUL';
  IF v_known IS NULL THEN RAISE EXCEPTION 'Ürünün sökülebilir parça listesi boş'; END IF;
  FOR e IN SELECT * FROM jsonb_array_elements(COALESCE(p_parts, '[]'::jsonb)) LOOP
    IF NOT ((e->>'part_id') = ANY (v_known)) THEN
      RAISE EXCEPTION 'Parça ürünün reçetesinde yok: %', e->>'part_id';
    END IF;
  END LOOP;

  v_parent := public._klt_ledger('URUN', p_sku, v_adi, 'UYGUNSUZ', -p_qty, 'sokum', 'kontrol',
                                 NULL, NULL, NULL, NULL, p_operator_id, p_operator_name, NULL, NULL, p_not);

  FOR r IN SELECT * FROM public.urun_yari_mamul_listesi(p_sku) WHERE part_type = 'YARIMAMUL' LOOP
    v_exp  := r.qty_per * p_qty;
    v_sag  := 0;
    v_fire := 0;
    SELECT COALESCE(sum(COALESCE((x->>'saglam')::numeric, 0)), 0),
           COALESCE(sum(COALESCE((x->>'fire')::numeric, 0)), 0)
      INTO v_sag, v_fire
      FROM jsonb_array_elements(COALESCE(p_parts, '[]'::jsonb)) x
      WHERE x->>'part_id' = r.part_id;
    IF v_sag < 0 OR v_fire < 0 THEN RAISE EXCEPTION 'Negatif miktar girilemez (%)', r.part_id; END IF;
    IF v_sag + v_fire > v_exp THEN
      RAISE EXCEPTION 'Sağlam + fire beklenenden fazla (%: beklenen %, girilen %)', r.part_id, v_exp, v_sag + v_fire;
    END IF;
    v_kalan := greatest(v_exp - v_sag - v_fire, 0);

    IF v_sag > 0 THEN
      IF r.part_type = 'YARIMAMUL' THEN
        PERFORM public._klt_ym_hareket(r.part_id, v_sag, 'IN', 'Söküm', v_parent, p_operator_id);
      ELSE
        PERFORM public._klt_hazir_hareket(r.part_id, v_sag, p_operator_id, 'Söküm — ' || p_sku || ' ' || v_parent);
      END IF;
      PERFORM public._klt_ledger('YARI_MAMUL', r.part_id, r.part_adi, 'SAGLAM', v_sag, 'sokum_saglam',
                                 'kontrol', v_parent, v_parent, NULL, NULL, p_operator_id, p_operator_name,
                                 NULL, NULL, 'Söküm: ' || p_sku);
    END IF;

    IF v_fire > 0 THEN
      PERFORM public._klt_ledger('YARI_MAMUL', r.part_id, r.part_adi, 'FIRE', v_fire, 'sokum_fire',
                                 'kontrol', v_parent, v_parent, NULL, NULL, p_operator_id, p_operator_name,
                                 NULL, NULL, 'Söküm: ' || p_sku);
    END IF;

    IF v_kalan > 0 THEN
      IF r.part_type = 'YARIMAMUL' THEN
        PERFORM public._klt_ledger('YARI_MAMUL', r.part_id, r.part_adi, 'UYGUNSUZ', v_kalan, 'giris',
                                   'kontrol', v_parent, v_parent, NULL, NULL, p_operator_id, p_operator_name,
                                   NULL, NULL, 'Söküm kalanı: ' || p_sku);
      ELSE
        PERFORM public._klt_ledger('YARI_MAMUL', r.part_id, r.part_adi, 'FIRE', v_kalan, 'sokum_fire',
                                   'kontrol', v_parent, v_parent, NULL, NULL, p_operator_id, p_operator_name,
                                   NULL, NULL, 'Söküm kalanı (hazır eleman) fire sayıldı: ' || p_sku);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'id', v_parent);
END;
$$;

GRANT EXECUTE ON FUNCTION public.kalite_sokum(TEXT,NUMERIC,JSONB,TEXT,TEXT,TEXT) TO authenticated;
