"use client";

import { useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TalimatPersonel } from "@/lib/talimat/types";

interface Props {
  /** Plana henüz eklenmemiş personeller */
  eklenebilir: TalimatPersonel[];
  /** Seçilenleri ekler (her biri için bir boş satır); bitince çözülür */
  onEkle: (userIds: string[]) => Promise<void>;
}

/** Aranabilir çoklu personel seçici: işaretle, "Seçilenleri ekle" — ürün sorulmaz, her personele boş satır açılır. */
export function PersonelEkle({ eklenebilir, onEkle }: Props) {
  const [acik, setAcik] = useState(false);
  const [q, setQ] = useState("");
  const [secili, setSecili] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const gorunen = useMemo(() => {
    const a = q.trim().toLocaleLowerCase("tr");
    if (!a) return eklenebilir;
    return eklenebilir.filter((p) =>
      `${p.full_name} ${p.user_id} ${p.station ?? ""} ${p.role}`.toLocaleLowerCase("tr").includes(a),
    );
  }, [eklenebilir, q]);

  const hepsiSecili = gorunen.length > 0 && gorunen.every((p) => secili.has(p.user_id));

  const toggle = (id: string) =>
    setSecili((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const tumunuSec = () =>
    setSecili((prev) => {
      const n = new Set(prev);
      if (hepsiSecili) for (const p of gorunen) n.delete(p.user_id);
      else for (const p of gorunen) n.add(p.user_id);
      return n;
    });

  const ekle = async () => {
    const ids = eklenebilir.filter((p) => secili.has(p.user_id)).map((p) => p.user_id);
    if (ids.length === 0) return;
    setBusy(true);
    try {
      await onEkle(ids);
      setSecili(new Set());
      setQ("");
      setAcik(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover
      open={acik}
      onOpenChange={(o) => {
        setAcik(o);
        if (!o) setSecili(new Set());
      }}
    >
      <PopoverTrigger asChild>
        <Button size="sm" className="bg-vw-primary text-vw-dark hover:bg-vw-side">
          <UserPlus className="mr-1.5 h-4 w-4" /> Personel ekle
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <div className="space-y-2 border-b p-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Personel ara..." className="h-8" autoFocus />
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={tumunuSec}
              disabled={gorunen.length === 0}
              className="font-medium text-vw-deep hover:underline disabled:opacity-40"
            >
              {hepsiSecili ? "Seçimi temizle" : "Tümünü seç"}
            </button>
            <span className="text-muted-foreground">{secili.size} seçili</span>
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-1">
          {gorunen.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {eklenebilir.length === 0 ? "Eklenebilecek personel yok" : "Eşleşen personel yok"}
            </p>
          ) : (
            gorunen.map((p) => (
              <label
                key={p.user_id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox checked={secili.has(p.user_id)} onCheckedChange={() => toggle(p.user_id)} />
                <span className="flex-1 truncate">{p.full_name}</span>
                <span className="text-[11px] text-muted-foreground">{p.station ?? p.role}</span>
              </label>
            ))
          )}
        </div>
        <div className="border-t p-2">
          <Button
            size="sm"
            className="w-full bg-vw-deep text-white hover:bg-vw-dark"
            disabled={secili.size === 0 || busy}
            onClick={ekle}
          >
            {busy ? "Ekleniyor..." : `Seçilenleri ekle${secili.size ? ` (${secili.size})` : ""}`}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
