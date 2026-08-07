-- users tablosu RLS düzeltmesi.
--
-- Uygulama katmanı kullanıcı yönetimini Yönetici + Endüstri Mühendisi'ne
-- açıyordu ama veritabanında tek yazma politikası is_admin() idi. Endüstri
-- Mühendisi "Pasife Al" dediğinde PostgREST hata döndürmeden 0 satır
-- güncelliyor, arayüz de başarı sanıp "pasife alındı" diyordu.
--
-- Ayrıca mevcut SELECT politikası yalnızca aktif kullanıcıları okutuyordu;
-- pasife alınan kişi yönetim ekranından tamamen kaybolurdu. Yönetici ve
-- Endüstri Mühendisi'nin pasifleri de görmesi gerekiyor.

DROP POLICY IF EXISTS "Admin or engineer can read all users" ON public.users;
CREATE POLICY "Admin or engineer can read all users"
  ON public.users FOR SELECT TO authenticated
  USING (public.is_admin_or_engineer());

DROP POLICY IF EXISTS "Admin or engineer can update users" ON public.users;
CREATE POLICY "Admin or engineer can update users"
  ON public.users FOR UPDATE TO authenticated
  USING (public.is_admin_or_engineer())
  WITH CHECK (public.is_admin_or_engineer());

DROP POLICY IF EXISTS "Admin or engineer can insert users" ON public.users;
CREATE POLICY "Admin or engineer can insert users"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_or_engineer());
