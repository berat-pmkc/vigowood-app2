-- 018: Sevkiyat item ID sequence (race condition fix)
-- Mevcut SELECT max + increment yerine atomic sequence

DO $$ DECLARE max_num INTEGER;
BEGIN
  SELECT COALESCE(
    MAX(
      CAST(
        (regexp_match(item_id, 'SVI-(\d+)'))[1]
        AS INTEGER
      )
    ), 0
  )
  INTO max_num
  FROM public.sevkiyat_items
  WHERE item_id ~ '^SVI-\d+$';

  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS public.sevkiyat_item_id_seq START WITH %s', max_num + 1);
END $$;

CREATE OR REPLACE FUNCTION public.next_sevkiyat_item_id()
RETURNS TEXT LANGUAGE sql AS $$
  SELECT 'SVI-' || LPAD(nextval('public.sevkiyat_item_id_seq')::TEXT, 6, '0');
$$;
