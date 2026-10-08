"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { ZamanliYayin } from "@/lib/talimat/types";

/** Pasif et / Aktif et diyaloglarının ortak "Ne zaman · İş sırası · Yayın" seçenekleri (SQL 164) */
export interface ZamanliDurum {
  zaman: "hemen" | "sec";
  /** YYYY-MM-DD (İstanbul) */
  tarih: string;
  /** HH:MM (İstanbul) */
  saat: string;
  sira: "son" | "sec";
  siraNo: number;
  yayin: ZamanliYayin;
  sesli: boolean;
}

const TZ = "Europe/Istanbul";

export function istanbulBugun(): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: TZ });
}

function istanbulSaat(ekDakika = 0): string {
  return new Date(Date.now() + ekDakika * 60000).toLocaleTimeString("sv-SE", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function varsayilanZamanli(): ZamanliDurum {
  return { zaman: "hemen", tarih: istanbulBugun(), saat: istanbulSaat(60), sira: "son", siraNo: 1, yayin: "yok", sesli: false };
}

/** Seçilen zaman gelecekte mi (hemen = true) */
export function zamanGecerliMi(d: ZamanliDurum): boolean {
  if (d.zaman === "hemen") return true;
  if (!d.tarih || !d.saat) return false;
  return new Date(`${d.tarih}T${d.saat}:00+03:00`).getTime() > Date.now() - 30_000;
}

/** Yeni (zamanlı) yolu gerektirmeyen düz "hemen, yayınsız, varsayılan sıra" mı */
export function duzIslemMi(d: ZamanliDurum): boolean {
  return d.zaman === "hemen" && d.yayin === "yok" && d.sira === "son";
}

export function zamanEtiketi(iso: string): string {
  return new Date(iso).toLocaleString("tr-TR", { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Segment<T extends string>({
  deger,
  secenekler,
  onChange,
}: {
  deger: T;
  secenekler: { k: T; l: string }[];
  onChange: (k: T) => void;
}) {
  return (
    <div className={cn("grid gap-1 rounded-md border border-vw-side/50 bg-vw-light p-1", secenekler.length === 3 ? "grid-cols-3" : "grid-cols-2")}>
      {secenekler.map((o) => (
        <button
          key={o.k}
          type="button"
          onClick={() => onChange(o.k)}
          className={cn(
            "min-h-9 rounded px-1 text-xs font-medium transition-colors sm:text-sm",
            deger === o.k ? "bg-vw-deep text-white" : "text-vw-dark hover:bg-black/5",
          )}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

interface Props {
  durum: ZamanliDurum;
  onChange: (d: ZamanliDurum) => void;
  /** Aktif et + satır: "İş sırası" bölümü */
  siraGoster?: boolean;
  /** Ne zaman bölümünü göster (personel kapsamı gibi durumlarda gizlenir) */
  zamanGoster?: boolean;
}

export function ZamanliSecenekler({ durum, onChange, siraGoster, zamanGoster = true }: Props) {
  const set = (p: Partial<ZamanliDurum>) => onChange({ ...durum, ...p });
  return (
    <div className="space-y-3">
      {zamanGoster && (
        <div className="space-y-1.5">
          <Label>Ne zaman</Label>
          <Segment
            deger={durum.zaman}
            onChange={(k) => set({ zaman: k })}
            secenekler={[
              { k: "hemen", l: "Hemen" },
              { k: "sec", l: "Tarih ve saat seç" },
            ]}
          />
          {durum.zaman === "sec" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" value={durum.tarih} min={istanbulBugun()} onChange={(e) => set({ tarih: e.target.value })} />
                <Input type="time" value={durum.saat} onChange={(e) => set({ saat: e.target.value })} />
              </div>
              <p className="text-xs text-muted-foreground">İstanbul saati. Zamanı gelince otomatik uygulanır.</p>
            </>
          )}
        </div>
      )}

      {siraGoster && (
        <div className="space-y-1.5">
          <Label>İş sırası</Label>
          <Segment
            deger={durum.sira}
            onChange={(k) => set({ sira: k })}
            secenekler={[
              { k: "son", l: "Aktiflerin sonuna" },
              { k: "sec", l: "Şu sıraya" },
            ]}
          />
          {durum.sira === "sec" && (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                className="w-24"
                value={durum.siraNo}
                onChange={(e) => set({ siraNo: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
              />
              <span className="text-xs text-muted-foreground">hattın aktif satırları arasındaki sıra (1 = en üst)</span>
            </div>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Yayın</Label>
        <Segment
          deger={durum.yayin}
          onChange={(k) => set({ yayin: k })}
          secenekler={[
            { k: "yok", l: "Yayınlama" },
            { k: "bildirimsiz", l: "Bildirimsiz yayınla" },
            { k: "bildirimli", l: "Bildirimli yayınla" },
          ]}
        />
        {durum.yayin === "bildirimli" && (
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={durum.sesli} onCheckedChange={(v) => set({ sesli: !!v })} />
            Sesli bildirim
          </label>
        )}
        {durum.yayin !== "yok" && (
          <p className="text-xs text-muted-foreground">Değişiklik uygulandıktan sonra değişen satırlar güncel olarak yayınlanır.</p>
        )}
      </div>
    </div>
  );
}
