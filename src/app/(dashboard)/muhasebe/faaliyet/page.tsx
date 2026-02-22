import type { Metadata } from "next";
import { Receipt } from "lucide-react";

export const metadata: Metadata = {
  title: "Faaliyet Hesapları | VigoWood",
};

export default function FaaliyetPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <Receipt className="h-16 w-16 text-muted-foreground/40" />
      <h1 className="text-2xl font-semibold text-vw-dark">Faaliyet Hesapları</h1>
      <p className="text-muted-foreground">
        Bu sayfa Katman 27&apos;de geliştirilecektir.
      </p>
    </div>
  );
}
