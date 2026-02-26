import {
  LayoutDashboard,
  Scissors,
  SprayCan,
  Wrench,
  Package,
  Box,
  Warehouse,
  Layers,
  Component,
  RotateCcw,
  ShoppingCart,
  Truck,
  BarChart3,
  Users,
  ClipboardList,
  Settings,
  Bell,
  LayoutTemplate,
  DollarSign,
  Receipt,
  Coins,
  FileText,
  Target,
  Megaphone,
  Landmark,
  CreditCard,
  PieChart,
  Store,
  ShoppingBag,
  Globe,
  MessageSquareText,
  Kanban,
  Inbox,
  CheckCircle2,
  Bot,
  FileOutput,
  Activity,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/lib/constants";

export type NavItem = {
  title: string;
  href: string;
  icon: LucideIcon;
  roles: UserRole[] | "all";
  badge?: string;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

/** All roles that can see management/office sections */
const MANAGEMENT_ROLES: UserRole[] = [
  "Yönetici",
  "Endüstri Mühendisi",
  "E-Ticaret Müdürü",
  "Dış Ticaret Müdürü",
  "Muhasebe",
  "Pazaryeri Sorumlusu",
  "Mimar",
  "Sevkiyat Sorumlusu",
];

const ALL_INTERNAL: UserRole[] = [...MANAGEMENT_ROLES, "Hat"];

const SEVK_ROLES: UserRole[] = ["Yönetici", "Endüstri Mühendisi", "Sevkiyat Sorumlusu", "E-Ticaret Müdürü", "Dış Ticaret Müdürü"];

const FINANCE_ROLES: UserRole[] = ["Yönetici", "Muhasebe", "E-Ticaret Müdürü"];

const MARKETPLACE_ROLES: UserRole[] = ["Yönetici", "E-Ticaret Müdürü", "Dış Ticaret Müdürü", "Pazaryeri Sorumlusu"];

/** Onay sayfasını görebilecek roller */
const APPROVAL_NAV_ROLES: UserRole[] = ["Yönetici", "Endüstri Mühendisi", "E-Ticaret Müdürü", "Dış Ticaret Müdürü"];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Ana Sayfa",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        roles: "all",
      },
    ],
  },
  {
    label: "Ops Center",
    items: [
      { title: "Genel Bakış", href: "/ops", icon: BarChart3, roles: "all" },
      { title: "Board", href: "/ops/board", icon: Kanban, roles: "all" },
      { title: "Görevlerim", href: "/ops/gorevlerim", icon: Inbox, roles: "all" },
      { title: "Onaylar", href: "/ops/onaylar", icon: CheckCircle2, roles: APPROVAL_NAV_ROLES },
      { title: "Raporlar", href: "/ops/raporlar", icon: FileOutput, roles: "all" },
      { title: "Ajanlar", href: "/ops/ajanlar", icon: Bot, roles: APPROVAL_NAV_ROLES },
      { title: "Kullanım", href: "/ops/kullanim", icon: Activity, roles: APPROVAL_NAV_ROLES },
    ],
  },
  {
    label: "Üretim",
    items: [
      { title: "Kesim", href: "/uretim/kesim", icon: Scissors, roles: [...ALL_INTERNAL, "Üretim"] },
      { title: "Temizlik", href: "/uretim/temizlik", icon: SprayCan, roles: [...ALL_INTERNAL, "Üretim"] },
      { title: "Montaj", href: "/uretim/montaj", icon: Wrench, roles: [...ALL_INTERNAL, "Üretim"] },
      { title: "Paketleme", href: "/uretim/paketleme", icon: Package, roles: [...ALL_INTERNAL, "Üretim"] },
      { title: "Kutu-Koli", href: "/uretim/kutu", icon: Box, roles: [...ALL_INTERNAL, "Üretim"] },
    ],
  },
  {
    label: "Stok",
    items: [
      { title: "Ürün Stok", href: "/stok/mamul", icon: Warehouse, roles: ALL_INTERNAL },
      { title: "Yarı Mamül", href: "/stok/yari-mamul", icon: Layers, roles: ALL_INTERNAL },
      { title: "Hazır Eleman", href: "/stok/hazir-eleman", icon: Component, roles: ALL_INTERNAL },
      { title: "İade Giriş", href: "/stok/iade", icon: RotateCcw, roles: ALL_INTERNAL },
    ],
  },
  {
    label: "Satış",
    items: [
      { title: "Satışlar", href: "/satis", icon: ShoppingCart, roles: MANAGEMENT_ROLES },
      { title: "Raporlar", href: "/satis/raporlar", icon: FileText, roles: MANAGEMENT_ROLES },
      { title: "Pazarlama", href: "/satis/pazarlama", icon: Target, roles: MANAGEMENT_ROLES },
      { title: "Kampanyalar", href: "/satis/kampanyalar", icon: Megaphone, roles: MANAGEMENT_ROLES },
      { title: "Ayarlar", href: "/satis/ayarlar", icon: Settings, roles: ["Yönetici", "Endüstri Mühendisi"] },
    ],
  },
  {
    label: "Pazaryeri",
    items: [
      { title: "Genel Bakış", href: "/pazaryeri/genel", icon: Store, roles: MARKETPLACE_ROLES },
      { title: "Trendyol", href: "/pazaryeri/trendyol", icon: ShoppingBag, roles: MARKETPLACE_ROLES },
      { title: "vigowood.com", href: "/pazaryeri/vigowood-com", icon: Globe, roles: MARKETPLACE_ROLES },
    ],
  },
  {
    label: "Sevkiyat",
    items: [
      { title: "Sevkiyatlar", href: "/sevkiyat", icon: Truck, roles: SEVK_ROLES },
      { title: "Şablonlar", href: "/sevkiyat/sablonlar", icon: LayoutTemplate, roles: SEVK_ROLES },
      { title: "Fiyatlar", href: "/sevkiyat/fiyatlar", icon: DollarSign, roles: SEVK_ROLES },
      { title: "Maliyetler", href: "/sevkiyat/maliyetler", icon: Receipt, roles: ["Yönetici", "Endüstri Mühendisi"] },
      { title: "Kurlar", href: "/sevkiyat/kurlar", icon: Coins, roles: SEVK_ROLES },
      { title: "Ayarlar", href: "/sevkiyat/ayarlar", icon: Settings, roles: ["Yönetici", "Endüstri Mühendisi"] },
    ],
  },
  {
    label: "Muhasebe",
    items: [
      { title: "Nakit Akış", href: "/muhasebe/nakit-akis", icon: Landmark, roles: FINANCE_ROLES },
      { title: "Ödemeler", href: "/muhasebe/odemeler", icon: CreditCard, roles: FINANCE_ROLES },
      { title: "Faaliyet Hesapları", href: "/muhasebe/faaliyet", icon: Receipt, roles: FINANCE_ROLES },
      { title: "Kârlılık", href: "/muhasebe/faaliyet/karlilik", icon: PieChart, roles: FINANCE_ROLES },
    ],
  },
  {
    label: "Analiz",
    items: [
      { title: "Raporlar", href: "/analiz", icon: BarChart3, roles: MANAGEMENT_ROLES },
    ],
  },
  {
    label: "Personel",
    items: [
      { title: "Personel Listesi", href: "/personel/liste", icon: ClipboardList, roles: ["Yönetici", "Endüstri Mühendisi", "E-Ticaret Müdürü", "Dış Ticaret Müdürü", "Hat"] },
      { title: "Yoklama", href: "/personel", icon: Users, roles: ["Yönetici", "Endüstri Mühendisi", "E-Ticaret Müdürü", "Dış Ticaret Müdürü", "Hat"] },
    ],
  },
  {
    label: "Yönetim",
    items: [
      { title: "Admin", href: "/admin", icon: Settings, roles: ["Yönetici", "Endüstri Mühendisi"] },
      { title: "Bildirimler", href: "/bildirimler", icon: Bell, roles: "all" },
    ],
  },
];

/** Filter nav groups by user role — returns only groups that have visible items */
export function getFilteredNavGroups(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.roles === "all" || item.roles.includes(role)
    ),
  })).filter((group) => group.items.length > 0);
}
