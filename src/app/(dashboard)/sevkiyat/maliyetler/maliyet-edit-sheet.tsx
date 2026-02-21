"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MALIYET_PARA_BIRIMLERI } from "@/lib/constants";
import {
  getSevkiyatMaliyet,
  upsertSevkiyatMaliyet,
  getLatestKur,
  type DovizKuruRow,
} from "../actions";
import { DollarSign, Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const MALIYET_FIELDS = [
  { key: "navlun", label: "Navlun", defaultCur: "USD" },
  { key: "ic_nakliye", label: "İç Nakliye", defaultCur: "TRY" },
  { key: "ara_depo", label: "Ara Depo", defaultCur: "TRY" },
  { key: "amazon_pickup", label: "Amazon Pickup", defaultCur: "USD" },
  { key: "ydg", label: "YDG", defaultCur: "USD" },
  { key: "tr_gumruk", label: "TR Gümrük", defaultCur: "TRY" },
  { key: "diger", label: "Diğer", defaultCur: "TRY" },
] as const;

interface MaliyetEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sevkiyatId: string;
  sevkiyatAdi: string;
  totalDesi: number;
  sonKur: DovizKuruRow | null;
  onSaved: () => void;
}

export function MaliyetEditSheet({
  open,
  onOpenChange,
  sevkiyatId,
  sevkiyatAdi,
  totalDesi,
  sonKur,
  onSaved,
}: MaliyetEditSheetProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState<Record<string, number | string>>({});
  const [kur, setKur] = useState<DovizKuruRow | null>(sonKur);

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    async function load() {
      const [maliyetRes, kurRes] = await Promise.all([
        getSevkiyatMaliyet(sevkiyatId),
        getLatestKur(),
      ]);

      if (maliyetRes.success && maliyetRes.data) {
        const d = maliyetRes.data;
        const v: Record<string, number | string> = {};
        for (const f of MALIYET_FIELDS) {
          v[f.key] = (d as unknown as Record<string, unknown>)[f.key] as number ?? 0;
          v[`${f.key}_currency`] = (d as unknown as Record<string, unknown>)[`${f.key}_currency`] as string ?? f.defaultCur;
        }
        v.not_text = d.not_text ?? "";
        setValues(v);
      } else {
        const v: Record<string, number | string> = {};
        for (const f of MALIYET_FIELDS) {
          v[f.key] = 0;
          v[`${f.key}_currency`] = f.defaultCur;
        }
        v.not_text = "";
        setValues(v);
      }

      if (kurRes.success && kurRes.data) {
        setKur(kurRes.data);
      }
      setLoading(false);
    }
    load();
  }, [open, sevkiyatId]);

  const handleSave = async () => {
    setSaving(true);
    const payload: Record<string, unknown> = {};
    for (const f of MALIYET_FIELDS) {
      payload[f.key] = Number(values[f.key]) || 0;
      payload[`${f.key}_currency`] = values[`${f.key}_currency`] || f.defaultCur;
    }
    payload.not_text = values.not_text || null;

    const result = await upsertSevkiyatMaliyet(sevkiyatId, payload);
    if (result.success) {
      toast.success("Maliyetler kaydedildi");
      onSaved();
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
    setSaving(false);
  };

  const toUsd = (amount: number, currency: string): number => {
    if (!kur || amount === 0) return 0;
    if (currency === "USD") return amount;
    if (currency === "TRY" && kur.usd_try) return amount / kur.usd_try;
    if (currency === "EUR" && kur.eur_usd) return amount * kur.eur_usd;
    if (currency === "GBP" && kur.gbp_usd) return amount * kur.gbp_usd;
    return 0;
  };

  let totalUsd = 0;
  for (const f of MALIYET_FIELDS) {
    totalUsd += toUsd(Number(values[f.key]) || 0, (values[`${f.key}_currency`] as string) || f.defaultCur);
  }
  const desiUsd = totalDesi > 0 ? totalUsd / totalDesi : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Maliyet Düzenle
          </SheetTitle>
          <SheetDescription>
            {sevkiyatId} — {sevkiyatAdi}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-1 gap-3">
              {MALIYET_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-xs">{field.label}</Label>
                  <div className="flex gap-1.5">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-8 text-xs flex-1"
                      value={values[field.key] || ""}
                      onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                    />
                    <Select
                      value={(values[`${field.key}_currency`] as string) || field.defaultCur}
                      onValueChange={(v) => setValues((prev) => ({ ...prev, [`${field.key}_currency`]: v }))}
                    >
                      <SelectTrigger className="h-8 w-20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MALIYET_PARA_BIRIMLERI.map((c) => (
                          <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Not</Label>
              <Textarea
                rows={2}
                className="text-xs"
                placeholder="Maliyet notu..."
                value={(values.not_text as string) || ""}
                onChange={(e) => setValues((v) => ({ ...v, not_text: e.target.value }))}
              />
            </div>

            {/* Toplam satırı */}
            <div className="flex flex-wrap items-center gap-3 pt-3 border-t">
              <div className="text-sm">
                <span className="text-muted-foreground">Toplam (USD):</span>{" "}
                <span className="font-bold">${totalUsd.toFixed(2)}</span>
              </div>
              {totalDesi > 0 && (
                <Badge variant="outline" className="text-xs">
                  ${desiUsd.toFixed(2)} / desi
                </Badge>
              )}
              {totalDesi > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({totalDesi.toFixed(1)} desi)
                </span>
              )}
              {!kur && (
                <span className="text-xs text-amber-600">Kur bilgisi yok</span>
              )}
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
              Kaydet
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
