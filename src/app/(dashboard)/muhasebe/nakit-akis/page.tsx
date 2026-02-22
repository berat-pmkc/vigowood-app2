import type { Metadata } from "next";
import { Landmark } from "lucide-react";

export const metadata: Metadata = {
  title: "Nakit Akış | VigoWood",
};

export default function NakitAkisPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
      <Landmark className="h-16 w-16 text-muted-foreground/40" />
      <h1 className="text-2xl font-semibold text-vw-dark">Nakit Akış Yönetimi</h1>
      <p className="text-muted-foreground">
        Bu sayfa Katman 26&apos;da geliştirilecektir.
      </p>
    </div>
  );
}
