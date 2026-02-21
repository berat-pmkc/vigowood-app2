import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Stok" };

export default function StokPage() {
  redirect("/stok/mamul");
}
