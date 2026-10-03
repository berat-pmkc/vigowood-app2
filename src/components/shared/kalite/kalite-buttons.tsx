"use client";

import { useState } from "react";
import { AlertTriangle, ClipboardCheck, Flame, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { KALITE_BUTTON_CLASS } from "@/lib/kalite/constants";
import type { KaliteItemTipi } from "@/lib/kalite/types";
import { UygunsuzGirisDialog } from "./uygunsuz-giris-dialog";
import { KontrolDialog } from "./kontrol-dialog";
import { FireDialog } from "./fire-dialog";
import { DonusumDialog } from "./donusum-dialog";

type Istasyon = "kesim" | "montaj" | "paketleme";

interface Config {
  uygunsuzLabel: string;
  uygunsuzTipi: "URUN" | "YARI_MAMUL";
  uygunsuzLock: boolean;
  fireTipler: KaliteItemTipi[];
  kontrolTipler: ("URUN" | "YARI_MAMUL")[];
}

const CONFIG: Record<Istasyon, Config> = {
  kesim: {
    uygunsuzLabel: "Uygunsuz YM",
    uygunsuzTipi: "YARI_MAMUL",
    uygunsuzLock: true,
    fireTipler: ["YARI_MAMUL", "PLAKA"],
    kontrolTipler: ["YARI_MAMUL"],
  },
  montaj: {
    uygunsuzLabel: "Uygunsuz",
    uygunsuzTipi: "YARI_MAMUL",
    uygunsuzLock: false,
    fireTipler: ["YARI_MAMUL", "URUN"],
    kontrolTipler: ["URUN", "YARI_MAMUL"],
  },
  paketleme: {
    uygunsuzLabel: "Uygunsuz Ürün",
    uygunsuzTipi: "URUN",
    uygunsuzLock: false,
    fireTipler: ["URUN", "YARI_MAMUL"],
    kontrolTipler: ["URUN", "YARI_MAMUL"],
  },
};

/**
 * İstasyon ekranı kalite butonları. "Yeni Seans" / "Tamamlananlar"
 * butonlarının SOLUNA, aynı flex satırının içine konur (satır flex-wrap olmalı).
 */
export function KaliteButtons({ istasyon, className }: { istasyon: Istasyon; className?: string }) {
  const cfg = CONFIG[istasyon];
  const [fireOpen, setFireOpen] = useState(false);
  const [kontrolOpen, setKontrolOpen] = useState(false);
  const [uygunsuzOpen, setUygunsuzOpen] = useState(false);
  const [donusumOpen, setDonusumOpen] = useState(false);

  const base = "h-10 bg-transparent";

  return (
    <>
      <Button variant="outline" className={cn(base, KALITE_BUTTON_CLASS.fire, className)} onClick={() => setFireOpen(true)}>
        <Flame className="mr-2 h-4 w-4" />
        Fire
      </Button>
      <Button variant="outline" className={cn(base, KALITE_BUTTON_CLASS.kontrol, className)} onClick={() => setKontrolOpen(true)}>
        <ClipboardCheck className="mr-2 h-4 w-4" />
        <span className="hidden sm:inline">Kontrol Edilen Uygunsuz</span>
        <span className="sm:hidden">Kontrol</span>
      </Button>
      <Button variant="outline" className={cn(base, KALITE_BUTTON_CLASS.uygunsuz, className)} onClick={() => setUygunsuzOpen(true)}>
        <AlertTriangle className="mr-2 h-4 w-4" />
        {cfg.uygunsuzLabel}
      </Button>
      {istasyon === "kesim" && (
        <Button variant="outline" className={cn(base, KALITE_BUTTON_CLASS.donustur, className)} onClick={() => setDonusumOpen(true)}>
          <RefreshCw className="mr-2 h-4 w-4" />
          YM Dönüştür
        </Button>
      )}

      <FireDialog open={fireOpen} onOpenChange={setFireOpen} kaynak={istasyon} tipler={cfg.fireTipler} />
      <KontrolDialog open={kontrolOpen} onOpenChange={setKontrolOpen} tipler={cfg.kontrolTipler} />
      <UygunsuzGirisDialog
        open={uygunsuzOpen}
        onOpenChange={setUygunsuzOpen}
        kaynak={istasyon}
        defaultTipi={cfg.uygunsuzTipi}
        lockTipi={cfg.uygunsuzLock}
        defaultStoktanDus
        title={cfg.uygunsuzLabel + " Girişi"}
      />
      {istasyon === "kesim" && <DonusumDialog open={donusumOpen} onOpenChange={setDonusumOpen} />}
    </>
  );
}
