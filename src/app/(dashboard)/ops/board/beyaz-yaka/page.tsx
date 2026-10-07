import Link from "next/link";
import { ArrowLeft, Kanban, Hourglass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BeyazYakaPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/ops/board">
            <ArrowLeft className="mr-1 h-4 w-4" /> Geri
          </Link>
        </Button>
        <h1 className="text-2xl font-bold text-vw-dark">Beyaz Yaka Görev İş Talimatları</h1>
      </div>
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-vw-side/50 bg-vw-light/50 px-6 py-16 text-center">
        <Hourglass className="h-10 w-10 text-vw-side" />
        <div className="text-xl font-semibold text-vw-dark">Yakında</div>
        <p className="max-w-md text-sm text-muted-foreground">
          Beyaz yaka iş talimatları henüz hazır değil. Bu arada mevcut görev panosunu (Pano, Liste, Takvim) kullanabilirsiniz.
        </p>
        <Button asChild className="mt-2 bg-vw-primary text-vw-dark hover:bg-vw-side">
          <Link href="/ops/board/gorevler">
            <Kanban className="mr-2 h-4 w-4" /> Görev Panosuna Git
          </Link>
        </Button>
      </div>
    </div>
  );
}
