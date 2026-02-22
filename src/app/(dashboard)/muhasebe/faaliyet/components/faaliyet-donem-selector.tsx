"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Check, X } from "lucide-react";
import { AY_LABELS } from "@/lib/constants";
import { getOrCreateDonem } from "../actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

interface DonemOption {
  id: string;
  yil: number;
  ay_no: number;
  donem_label: string | null;
  kur_tl_usd: number;
  satis_count: number;
  maliyet_count: number;
  karlilik_count: number;
}

interface Props {
  donemler: DonemOption[];
  selectedDonemId: string;
  onDonemChange: (donemId: string) => void;
}

export function FaaliyetDonemSelector({ donemler, selectedDonemId, onDonemChange }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newYil, setNewYil] = useState(new Date().getFullYear());
  const [newAy, setNewAy] = useState(new Date().getMonth() + 1);
  const [newKur, setNewKur] = useState(0);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (newKur <= 0) {
      toast.error("Kur bilgisi giriniz");
      return;
    }
    setLoading(true);
    const res = await getOrCreateDonem(newYil, newAy, newKur);
    setLoading(false);
    if (res.success) {
      toast.success(`${AY_LABELS[newAy - 1]} ${newYil} donemi olusturuldu`);
      setOpen(false);
      const url = new URL(window.location.href);
      url.searchParams.set("donem", res.id);
      router.push(url.pathname + url.search);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  };

  const selectedDonem = donemler.find((d) => d.id === selectedDonemId);

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedDonemId} onValueChange={onDonemChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Donem secin" />
        </SelectTrigger>
        <SelectContent>
          {donemler.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <div className="flex items-center gap-2">
                <span>{d.donem_label ?? `${d.yil}-${d.ay_no}`}</span>
                <div className="flex gap-0.5">
                  {d.satis_count > 0 && (
                    <Check className="h-3 w-3 text-vw-success" />
                  )}
                  {d.maliyet_count > 0 && (
                    <Check className="h-3 w-3 text-vw-info" />
                  )}
                </div>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedDonem && (
        <span className="hidden text-xs text-muted-foreground sm:inline">
          Kur: {selectedDonem.kur_tl_usd.toFixed(2)} TL/$
        </span>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Donem Olustur</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Yil</Label>
                <Input
                  type="number"
                  value={newYil}
                  onChange={(e) => setNewYil(Number(e.target.value))}
                  min={2020}
                  max={2100}
                />
              </div>
              <div className="space-y-2">
                <Label>Ay</Label>
                <Select
                  value={String(newAy)}
                  onValueChange={(v) => setNewAy(Number(v))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AY_LABELS.map((label, i) => (
                      <SelectItem key={i} value={String(i + 1)}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>USD/TRY Kur</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="ornegin: 36.50"
                value={newKur || ""}
                onChange={(e) => setNewKur(Number(e.target.value))}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                <X className="mr-1 h-4 w-4" />
                Iptal
              </Button>
              <Button onClick={handleCreate} disabled={loading}>
                <Plus className="mr-1 h-4 w-4" />
                {loading ? "Olusturuluyor..." : "Olustur"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
