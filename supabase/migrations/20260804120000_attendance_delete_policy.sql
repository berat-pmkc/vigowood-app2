-- Yoklama silme yetkisi.
--
-- attendance tablosunda DELETE için yalnızca "Yönetici can manage attendance"
-- (is_admin) politikası vardı. INSERT ve UPDATE has_personel_access() ile
-- açıkken DELETE kapalıydı; Endüstri Mühendisi veya Hat sorumlusu yoklama
-- kaydını kaldırmak istediğinde PostgREST hata döndürmeden 0 satır siliyordu.
-- Uygulama da bunu başarı sayıp "kaldırıldı" diyordu ama kayıt yerinde
-- kalıyordu.
--
-- Yoklamayı girebilen rol geri de alabilmeli — personel listesindeki
-- aç/kapa davranışı zaten bunu varsayıyor.

DROP POLICY IF EXISTS "Personel access can delete attendance" ON public.attendance;
CREATE POLICY "Personel access can delete attendance"
  ON public.attendance FOR DELETE TO authenticated
  USING (public.has_personel_access());
