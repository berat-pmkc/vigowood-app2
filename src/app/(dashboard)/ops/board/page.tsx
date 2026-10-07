import Link from "next/link";
import { redirect } from "next/navigation";
import { Briefcase, HardHat, ChevronRight } from "lucide-react";

export default async function OpsBoardLandingPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; view?: string }>;
}) {
  const params = await searchParams;
  // Eski bağlantılar (?tab=sablonlar, ?view=liste) görev panosuna yönlenir
  if (params.tab || params.view) {
    const qs = new URLSearchParams();
    if (params.tab) qs.set("tab", params.tab);
    if (params.view) qs.set("view", params.view);
    redirect(`/ops/board/gorevler?${qs.toString()}`);
  }

  const cards = [
    {
      href: "/ops/board/beyaz-yaka",
      title: "Beyaz Yaka Görev İş Talimatları",
      desc: "Ofis görevleri ve görev panosu",
      icon: Briefcase,
      className: "bg-vw-light text-vw-dark border-vw-side/40 hover:border-vw-side",
    },
    {
      href: "/ops/board/mavi-yaka",
      title: "Mavi Yaka Görev İş Talimatları",
      desc: "Haftalık üretim planı: personel, sıra, miktar ve yayın",
      icon: HardHat,
      className: "bg-vw-primary text-vw-dark border-vw-side hover:border-vw-deep",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">İş Talimatları</h1>
        <p className="text-sm text-muted-foreground">Görev türünü seçin</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className={`group flex min-h-[180px] flex-col justify-between rounded-2xl border-2 p-6 shadow-sm transition-all hover:shadow-md ${c.className}`}
            >
              <Icon className="h-10 w-10 opacity-80" />
              <div>
                <div className="text-xl font-bold leading-tight">{c.title}</div>
                <div className="mt-1 text-sm opacity-80">{c.desc}</div>
              </div>
              <div className="flex items-center justify-end text-sm font-medium opacity-70 group-hover:opacity-100">
                Aç <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
