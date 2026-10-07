-- İç (yardımcı) fonksiyonlar istemciden (anon / authenticated) çağrılamamalı.
-- Schema varsayılan yetkileri yeni fonksiyonlara anon/authenticated EXECUTE verdiği için
-- "REVOKE ... FROM PUBLIC" yeterli değil; açıkça geri alınır.
-- Kapsam: adı "_" ile başlayan veya "_ic" ile biten fonksiyonlar + zamanlayıcı/uyarı üreticileri.
-- RLS / SECURITY DEFINER içinden çağrılmaları etkilenmez (sahip yetkisiyle çalışırlar).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = current_schema()
      AND p.prokind = 'f'
      AND (
        p.proname LIKE '\_%' ESCAPE '\'
        OR p.proname LIKE '%\_ic' ESCAPE '\'
        OR p.proname IN ('talimat_zamanlayici', 'uretim_uyarilari_uret')
      )
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    RAISE NOTICE 'revoked: %', r.sig;
  END LOOP;
END $$;
