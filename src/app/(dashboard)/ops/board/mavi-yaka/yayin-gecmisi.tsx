"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, BellOff, ChevronDown, ChevronRight, History, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { bildirimDurdur, yayinDetayGetir } from "@/lib/talimat/actions";
import { YAYIN_DURUM_LABEL } from "@/lib/talimat/constants";
import type { TalimatYayin, TalimatYayinHedefDetay } from "@/lib/talimat/types";
import { formatDate, formatTime } from "@/lib/utils";

interface Props {
  yayinlar: TalimatYayin[];
  editable: boolean;
  onChanged: () => void;
}

const DURUM_RENK: Record<string, string> = {
  bildirimsiz: "bg-[#eceff1] text-[#546e7a]",
  beklemede: "bg-[#fde8cf] text-[#b8650c]",
  gonderildi: "bg-[#dbe7f5] text-[#3368b1]",
  tamamlandi: "bg-[#e3ecd2] text-[#3caa35]",
  durduruldu: "bg-[#f5f5f5] text-[#616161]",
  geri_cekildi: "bg-[#fbdde1] text-[#c0424f]",
};

function YayinSatiri({ y, editable, onChanged }: { y: TalimatYayin; editable: boolean; onChanged: () => void }) {
  const [acik, setAcik] = useState(false);
  const [hedefler, setHedefler] = useState<TalimatYayinHedefDetay[] | null>(null);
  const [busy, setBusy] = useState(false);

  const ac = async () => {
    const yeni = !acik;
    setAcik(yeni);
    if (yeni && !hedefler) {
      const r = await yayinDetayGetir(y.yayin_id);
      setHedefler(r.success && r.data ? r.data.hedefler : []);
    }
  };

  const islem = async (geriCek: boolean) => {
    setBusy(true);
    const r = await bildirimDurdur(y.yayin_id, geriCek);
    setBusy(false);
    if (!r.success) return void toast.error(r.error);
    toast.success(geriCek ? "Bildirim geri çekildi" : "Bildirim durduruldu");
    onChanged();
  };

  const aktif = y.durum === "gonderildi" || y.durum === "beklemede";
  const geriCekilebilir = aktif || y.durum === "durduruldu";

  return (
    <div className="border-b last:border-b-0">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
        <button type="button" onClick={ac} className="text-muted-foreground" aria-label="Detay">
          {acik ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="font-medium tabular-nums">
          {formatDate(y.created_at)} {formatTime(y.created_at)}
        </span>
        <Badge className={`border-0 ${DURUM_RENK[y.durum] ?? ""}`}>{YAYIN_DURUM_LABEL[y.durum] ?? y.durum}</Badge>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {y.bildirim_gonder ? <Bell className="h-3.5 w-3.5 text-vw-warning" /> : <BellOff className="h-3.5 w-3.5" />}
          Bildirim {y.bildirim_gonder ? "açık" : "kapalı"}
          {y.sesli && " · sesli"}
          {y.otomatik && " · otomatik"}
        </span>
        <span className="text-xs text-muted-foreground">
          {y.hedef === "herkes" ? "Herkes" : "Değişenler"} · {y.satir_sayisi} satır
        </span>
        {y.bildirim_gonder && (
          <span className="text-xs font-medium tabular-nums">
            Onay {y.onay_sayisi}/{y.hedef_sayisi}
          </span>
        )}
        {editable && y.bildirim_gonder && (
          <div className="ml-auto flex gap-1">
            {aktif && (
              <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => islem(false)}>
                Durdur
              </Button>
            )}
            {geriCekilebilir && (
              <Button size="sm" variant="outline" className="h-7 text-xs text-[#c0424f]" disabled={busy} onClick={() => islem(true)}>
                Geri çek
              </Button>
            )}
          </div>
        )}
      </div>
      {acik && (
        <div className="bg-muted/30 px-10 pb-2 text-xs">
          {!hedefler ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : hedefler.length === 0 ? (
            <span className="text-muted-foreground">Hedef hat yok</span>
          ) : (
            <ul className="grid gap-x-6 gap-y-0.5 sm:grid-cols-2 lg:grid-cols-3">
              {hedefler.map((h) => (
                <li key={h.hat_id ?? h.personel_id} className="flex justify-between gap-2">
                  <span>{h.hat_adi ?? h.personel_adi ?? h.personel_id}</span>
                  <span className={h.onay_zamani ? "text-[#2f7d66]" : "text-[#c0424f]"}>
                    {h.onay_zamani ? `Görüldü ${formatTime(h.onay_zamani)}` : "Görmedi"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function YayinGecmisi({ yayinlar, editable, onChanged }: Props) {
  const [acik, setAcik] = useState(false);
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setAcik((a) => !a)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold text-vw-dark hover:bg-muted/40"
      >
        <History className="h-4 w-4" />
        Yayın geçmişi
        <span className="text-xs font-normal text-muted-foreground">({yayinlar.length})</span>
        <span className="ml-auto">{acik ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
      </button>
      {acik && (
        <div className="border-t">
          {yayinlar.length === 0 ? (
            <div className="px-3 py-4 text-sm text-muted-foreground">Henüz yayın yapılmadı.</div>
          ) : (
            yayinlar.map((y) => <YayinSatiri key={y.yayin_id} y={y} editable={editable} onChanged={onChanged} />)
          )}
        </div>
      )}
    </Card>
  );
}
