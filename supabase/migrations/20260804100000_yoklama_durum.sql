-- Yoklamaya durum alanı eklenir.
--
-- Şimdiye kadar yoklama sadece giriş/çıkış saatinden ibaretti. Gelmeyen
-- personel hiç kaydedilmiyordu, dolayısıyla geçmişe dönük bakıldığında
-- "izinli miydi, raporlu muydu, yoksa mazeretsiz mi gelmedi" ayırt
-- edilemiyordu. Bu kolon o ayrımı kayıt altına alır.
--
-- geldi    : normal çalışma günü, giriş/çıkış saati girilir
-- izinli   : ücretli/ücretsiz izin — devamsızlık sayılmaz
-- raporlu  : sağlık raporu — izinden ayrı takip edilir
-- devamsiz : mazeretsiz gelmedi

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS durum TEXT NOT NULL DEFAULT 'geldi';

-- Mevcut kayıtların hepsi fiilen gelinen günler
UPDATE public.attendance SET durum = 'geldi' WHERE durum IS NULL;

ALTER TABLE public.attendance
  DROP CONSTRAINT IF EXISTS attendance_durum_check;

ALTER TABLE public.attendance
  ADD CONSTRAINT attendance_durum_check
  CHECK (durum IN ('geldi', 'izinli', 'raporlu', 'devamsiz'));

-- Devamsızlık raporları çalışan + tarih aralığı üzerinden sorgulanacak
CREATE INDEX IF NOT EXISTS idx_attendance_employee_tarih
  ON public.attendance (employee, tarih DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_durum
  ON public.attendance (durum) WHERE durum <> 'geldi';

COMMENT ON COLUMN public.attendance.durum IS
  'geldi | izinli | raporlu | devamsiz — gelmeyen günlerin mazeret durumu';
