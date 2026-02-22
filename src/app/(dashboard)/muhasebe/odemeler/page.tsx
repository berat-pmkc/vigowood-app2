import type { Metadata } from "next";
import { CreditCard } from "lucide-react";

export const metadata: Metadata = {
  title: "Ödemeler | VigoWood",
};

export default function OdemelerPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <CreditCard className="h-16 w-16 text-muted-foreground/40" />
      <h1 className="text-2xl font-semibold text-vw-dark">Ödemeler</h1>
      <p className="text-muted-foreground">
        Bu sayfa Katman 26&apos;da geliştirilecektir.
      </p>
    </div>
  );
}
