import Image from "next/image";
import { Wrench } from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata = { title: "Bakım | VigoWood" };

export default function BakimPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-vw-light p-4">
      <div className="w-full max-w-md rounded-xl border border-vw-side/30 bg-white p-8 text-center shadow-sm">
        <Image
          src="/logo-yuvarlak.png"
          alt="VigoWood"
          width={72}
          height={72}
          className="mx-auto mb-4 rounded-full"
          priority
        />
        <Wrench className="mx-auto mb-3 size-8 text-vw-deep" />
        <h1 className="text-lg font-semibold text-vw-dark">
          Sistem bakımda — kısa süre içinde tekrar hizmetinizde olacağız.
        </h1>
      </div>
    </div>
  );
}
