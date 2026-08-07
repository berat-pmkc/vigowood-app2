"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { uyariyiOkunduIsaretle } from "../actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, Check, Clock, UserX } from "lucide-react";

export interface UretimUyari {
  id: string;
  tur: "seans_acilmadi" | "seans_uzun_acik" | "seans_kapanmadi";
  baslik: string;
  adet: number;
  detay: Record<string, unknown>[];
  created_at: string;
}

const TUR_BILGI: Record<
  UretimUyari["tur"],
  { ikon: typeof AlertTriangle; renk: string; etiket: string }
> = {
  seans_acilmadi: { ikon: UserX, renk: "text-amber-600", etiket: "Seans açılmadı" },
  seans_uzun_acik: { ikon: Clock, renk: "text-blue-600", etiket: "Uzun süredir açık" },
  seans_kapanmadi: { ikon: AlertTriangle, renk: "text-red-600", etiket: "Kapatılmadı" },
};

/** Uyarı türüne göre satırı okunabilir metne çevirir */
function satirMetni(tur: UretimUyari["tur"], d: Record<string, unknown>): string {
  const al = (k: string) => (d[k] == null ? "" : String(d[k]));
  if (tur === "seans_acilmadi") {
    const ist = al("istasyon");
    return al("ad") + (ist ? ` · ${ist}` : "");
  }
  const parcalar = [al("ad"), al("sku"), al("adim")].filter(Boolean);
  const bas = al("baslangic");
  const sure = al("sure_saat");
  const ek = [bas ? `${bas}'den beri` : "", sure ? `${sure} saat` : ""]
    .filter(Boolean)
    .join(" · ");
  return parcalar.join(" · ") + (ek ? ` — ${ek}` : "");
}

export function UretimUyariKarti({ uyarilar }: { uyarilar: UretimUyari[] }) {
  const router = useRouter();
  const [islenen, setIslenen] = useState<string | null>(null);

  if (uyarilar.length === 0) return null;

  const okundu = async (id: string) => {
    setIslenen(id);
    const r = await uyariyiOkunduIsaretle(id);
    setIslenen(null);
    if (!r.success) {
      toast.error(r.error);
      return;
    }
    router.refresh();
  };

  return (
    <Card className="border-amber-300 bg-amber-50/40">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-600" />
          Bugün dikkat edilmesi gerekenler
          <Badge variant="outline" className="ml-1 border-amber-400 bg-white text-amber-700">
            {uyarilar.length}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-2">
        {uyarilar.map((u) => {
          const bilgi = TUR_BILGI[u.tur];
          const Ikon = bilgi.ikon;
          return (
            <Collapsible key={u.id}>
              <div className="rounded-md border bg-white">
                <div className="flex items-center gap-2 p-3">
                  <Ikon className={`size-4 shrink-0 ${bilgi.renk}`} />
                  <CollapsibleTrigger className="flex flex-1 items-center gap-2 text-left">
                    <span className="text-sm font-medium">{u.baslik}</span>
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 shrink-0 text-xs"
                    onClick={() => okundu(u.id)}
                    disabled={islenen === u.id}
                  >
                    <Check className="mr-1 size-3.5" />
                    Gördüm
                  </Button>
                </div>

                <CollapsibleContent>
                  <ul className="space-y-1 border-t px-3 py-2 text-sm text-muted-foreground">
                    {u.detay.map((d, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
                        {satirMetni(u.tur, d)}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        <p className="pt-1 text-[11px] leading-relaxed text-muted-foreground">
          Açık seanslara dokunulmuyor — seansı kapatmak üretilen adedi girmek demek,
          otomatik kapatmak boş kayıt üretirdi. İzinli veya raporlu işaretlenen personel
          uyarıya girmez.
        </p>
      </CardContent>
    </Card>
  );
}
