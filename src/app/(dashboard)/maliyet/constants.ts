import { ADMIN_EQUIVALENT_ROLES, type UserRole } from "@/lib/constants";
import type { UrunMaliyet, MaliyetAyarlari } from "@/lib/maliyet";

export const MALIYET_ROLES: UserRole[] = [
  ...ADMIN_EQUIVALENT_ROLES, "Endüstri Mühendisi", "Muhasebe",
];

export interface MaliyetVerisi {
  urunler: UrunMaliyet[];
  ayar: MaliyetAyarlari;
  aylar: string[];
  secilenAy: string | null;
}
