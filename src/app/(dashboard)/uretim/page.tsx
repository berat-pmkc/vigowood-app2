import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Uretim" };

export default function UretimPage() {
  redirect("/uretim/kesim");
}
