-- Fix: Montaj seans iptali sessizce başarısız oluyordu
--
-- SORUN
-- montaj_sessions_delete politikası is_admin() (yalnızca 'Yönetici') kullanıyordu.
-- Uygulama katmanındaki cancelMontajSession ise requireProductionAccess() ile
-- korunuyordu (Yönetici, Endüstri Mühendisi, Hat, Üretim).
--
-- Bu uyumsuzluk yüzünden Yönetici olmayan bir üretim kullanıcısı seansı iptal
-- ettiğinde: uygulama kontrolü geçiliyor, DELETE çalışıyor, RLS satırı sessizce
-- filtreliyor (0 satır etkileniyor, HATA DÖNMÜYOR), action success:true dönüyor.
-- Arayüz "Seans iptal edildi" diyor ama seans veritabanında duruyor.
--
-- ÇÖZÜM
-- İptal yıkıcı bir işlem olduğu için ofis rolleriyle sınırlandırıldı:
--   is_admin_or_engineer() = Yönetici + Endüstri Mühendisi
-- Saha rolleri (Hat, Üretim) seans açıp kapatmaya devam eder, iptal edemez.
--
-- Uygulama tarafındaki karşılığı: PRODUCTION_CANCEL_ROLES (src/lib/constants.ts)
-- DİKKAT: Bu iki katman birlikte değiştirilmelidir. Yalnızca birini değiştirmek
-- yukarıdaki sessiz hatayı geri getirir.

DROP POLICY IF EXISTS "montaj_sessions_delete" ON public.montaj_sessions;

CREATE POLICY "montaj_sessions_delete" ON public.montaj_sessions
  FOR DELETE USING (is_admin_or_engineer());
