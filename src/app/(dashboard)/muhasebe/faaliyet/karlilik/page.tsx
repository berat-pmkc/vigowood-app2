import type { Metadata } from "next";
import { PieChart } from "lucide-react";

export const metadata: Metadata = {
  title: "Kârlılık | VigoWood",
};

export default function KarlilikPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <PieChart className="h-16 w-16 text-muted-foreground/40" />
      <h1 className="text-2xl font-semibold text-vw-dark">Kârlılık Analizi</h1>
      <p className="text-muted-foreground">
        Bu sayfa Katman 27&apos;de geliştirilecektir.
      </p>
    </div>
  );
}
