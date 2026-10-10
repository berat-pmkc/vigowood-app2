-- 167: next_id — sayı p_width'ten uzunsa KESME (eski DB'de elle yapılmış düzeltme, migration dosyasında yoktu).
-- lpad uzun sayıyı keser: KES- sayacı 20261124 iken her kesim 'KES-2026' alıyor, mevcut kayıtla
-- çakışıp (duplicate key) kesim kaydı oluşmuyordu. Aynı sorun K- (cut_lines) için de geçerli.
CREATE OR REPLACE FUNCTION public.next_id(p_prefix TEXT, p_width INT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next BIGINT;
BEGIN
  INSERT INTO public.id_sequences (prefix, last_value)
  VALUES (p_prefix, 0)
  ON CONFLICT (prefix) DO NOTHING;

  UPDATE public.id_sequences
  SET last_value = last_value + 1
  WHERE prefix = p_prefix
  RETURNING last_value INTO v_next;

  RETURN p_prefix || CASE WHEN length(v_next::text) >= p_width
                          THEN v_next::text
                          ELSE lpad(v_next::text, p_width, '0') END;
END;
$$;
