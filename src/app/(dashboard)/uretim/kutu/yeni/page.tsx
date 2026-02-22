import { redirect } from "next/navigation";

// Eski form sayfası kaldırıldı — dashboard dialog'una yönlendir
export default function YeniKutuPage() {
  redirect("/uretim/kutu");
}
