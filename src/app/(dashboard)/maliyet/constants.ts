import type { UserRole } from "@/lib/constants";
import type { UrunMaliyet, MaliyetAyarlari } from "@/lib/maliyet";

export const MALIYET_ROLES: UserRole[] = [
  "Yönetici", "Endüstri Mühendisi", "E-Ticaret Müdürü", "Muhasebe",
];

export interface MaliyetVerisi {
  urunler: UrunMaliyet[];
  ayar: MaliyetAyarlari;
  aylar: string[];
  secilenAy: string | null;
}
