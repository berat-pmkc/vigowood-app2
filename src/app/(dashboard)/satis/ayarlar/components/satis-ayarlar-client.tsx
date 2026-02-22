"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, X, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { SalesSettings, SalesChannel, BasariEsikleri } from "@/lib/sales-settings";
import type { PeriodType } from "../../actions";
import {
  updateSatisKanallari,
  updateHizmetSkulari,
  updatePazaryeriSecenekleri,
  updateBasariEsikleri,
  updateVarsayilanDonem,
} from "../actions";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "Bugün" },
  { value: "week", label: "Bu Hafta" },
  { value: "month", label: "Bu Ay" },
  { value: "all", label: "Tüm Zamanlar" },
];

interface SatisAyarlarClientProps {
  settings: SalesSettings;
}

export function SatisAyarlarClient({ settings }: SatisAyarlarClientProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
          Satış Ayarları
        </h1>
        <p className="text-sm text-muted-foreground">
          Satış kanalları, hizmet SKU&apos;ları ve diğer satış ayarlarını yönetin
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <KanallarCard initialChannels={settings.kanallari} />
        <HizmetSkuCard initialSkus={settings.hizmetSkulari} />
        <PazaryeriCard initialOptions={settings.pazaryeriSecenekleri} />
        <BasariEsikleriCard initialEsikler={settings.basariEsikleri} />
        <VarsayilanDonemCard initialDonem={settings.varsayilanDonem} />
      </div>
    </div>
  );
}

// ─── Kart 1: Satış Kanalları ──────────────────────────────────────

function KanallarCard({ initialChannels }: { initialChannels: SalesChannel[] }) {
  const [channels, setChannels] = useState<SalesChannel[]>(initialChannels);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newIhracat, setNewIhracat] = useState(false);
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(channels) !== JSON.stringify(initialChannels);

  function addChannel() {
    const id = newId.trim().toUpperCase();
    const label = newLabel.trim();
    if (!id || !label) {
      toast.error("ID ve etiket zorunludur");
      return;
    }
    if (channels.some((c) => c.id === id)) {
      toast.error("Bu ID zaten mevcut");
      return;
    }
    setChannels([...channels, { id, label, ihracat: newIhracat }]);
    setNewId("");
    setNewLabel("");
    setNewIhracat(false);
  }

  function removeChannel(id: string) {
    setChannels(channels.filter((c) => c.id !== id));
  }

  function toggleIhracat(id: string) {
    setChannels(channels.map((c) => (c.id === id ? { ...c, ihracat: !c.ihracat } : c)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateSatisKanallari(channels);
      if (result.success) toast.success("Kanallar güncellendi");
      else toast.error(result.error);
    } catch {
      toast.error("Kaydetme sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Satış Kanalları</CardTitle>
        <CardDescription>Satış raporlarında kullanılan kanal listesi</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">Etiket</th>
                <th className="px-3 py-2 text-center font-medium">İhracat</th>
                <th className="px-3 py-2 text-right font-medium">Sil</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((ch) => (
                <tr key={ch.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{ch.id}</td>
                  <td className="px-3 py-2">{ch.label}</td>
                  <td className="px-3 py-2 text-center">
                    <Checkbox
                      checked={ch.ihracat}
                      onCheckedChange={() => toggleIhracat(ch.id)}
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeChannel(ch.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Add new channel */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Kanal ID</Label>
            <Input
              value={newId}
              onChange={(e) => setNewId(e.target.value)}
              placeholder="KANAL_ID"
              className="h-8 w-[120px] text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiket</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Kanal Adı"
              className="h-8 w-[150px] text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5 pb-0.5">
            <Checkbox
              id="new-ihracat"
              checked={newIhracat}
              onCheckedChange={(v) => setNewIhracat(v === true)}
            />
            <Label htmlFor="new-ihracat" className="text-xs">İhracat</Label>
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addChannel}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {hasChanges && (
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Kart 2: Hizmet SKU'ları ──────────────────────────────────────

function HizmetSkuCard({ initialSkus }: { initialSkus: string[] }) {
  const [skus, setSkus] = useState<string[]>(initialSkus);
  const [newSku, setNewSku] = useState("");
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(skus) !== JSON.stringify(initialSkus);

  function addSku() {
    const val = newSku.trim().toUpperCase();
    if (!val) return;
    if (skus.includes(val)) {
      toast.error("Bu SKU zaten mevcut");
      return;
    }
    setSkus([...skus, val]);
    setNewSku("");
  }

  function removeSku(val: string) {
    setSkus(skus.filter((s) => s !== val));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateHizmetSkulari(skus);
      if (result.success) toast.success("Hizmet SKU'ları güncellendi");
      else toast.error(result.error);
    } catch {
      toast.error("Kaydetme sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Hizmet SKU&apos;ları</CardTitle>
        <CardDescription>Bu SKU&apos;larla başlayan ürünler stoktan düşülmez</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {skus.map((s) => (
            <Badge key={s} variant="secondary" className="gap-1 pr-1 text-xs">
              {s}
              <button
                onClick={() => removeSku(s)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newSku}
            onChange={(e) => setNewSku(e.target.value)}
            placeholder="Yeni SKU ekle..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addSku())}
          />
          <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={addSku}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {hasChanges && (
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Kart 3: Pazaryeri Seçenekleri ────────────────────────────────

function PazaryeriCard({ initialOptions }: { initialOptions: string[] }) {
  const [options, setOptions] = useState<string[]>(initialOptions);
  const [newOption, setNewOption] = useState("");
  const [saving, setSaving] = useState(false);

  const hasChanges = JSON.stringify(options) !== JSON.stringify(initialOptions);

  function addOption() {
    const val = newOption.trim();
    if (!val) return;
    if (options.includes(val)) {
      toast.error("Bu seçenek zaten mevcut");
      return;
    }
    setOptions([...options, val]);
    setNewOption("");
  }

  function removeOption(val: string) {
    setOptions(options.filter((o) => o !== val));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updatePazaryeriSecenekleri(options);
      if (result.success) toast.success("Pazaryeri seçenekleri güncellendi");
      else toast.error(result.error);
    } catch {
      toast.error("Kaydetme sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pazaryeri Seçenekleri</CardTitle>
        <CardDescription>TR Pazarlama formunda pazaryeri dropdown seçenekleri</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {options.map((o) => (
            <Badge key={o} variant="secondary" className="gap-1 pr-1 text-xs">
              {o}
              <button
                onClick={() => removeOption(o)}
                className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={newOption}
            onChange={(e) => setNewOption(e.target.value)}
            placeholder="Yeni pazaryeri ekle..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addOption())}
          />
          <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={addOption}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {hasChanges && (
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Kart 4: Başarı Eşikleri ──────────────────────────────────────

function BasariEsikleriCard({ initialEsikler }: { initialEsikler: BasariEsikleri }) {
  const [warning, setWarning] = useState(initialEsikler.warning);
  const [success, setSuccess] = useState(initialEsikler.success);
  const [saving, setSaving] = useState(false);

  const hasChanges = warning !== initialEsikler.warning || success !== initialEsikler.success;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateBasariEsikleri({ warning, success });
      if (result.success) toast.success("Eşikler güncellendi");
      else toast.error(result.error);
    } catch {
      toast.error("Kaydetme sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Başarı Oranı Eşikleri</CardTitle>
        <CardDescription>Pazarlama tablosunda ciro renklendirme eşikleri (%)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Uyarı Eşiği (%)</Label>
            <Input
              type="number"
              value={warning}
              onChange={(e) => setWarning(Number(e.target.value))}
              className="h-8"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Başarılı Eşiği (%)</Label>
            <Input
              type="number"
              value={success}
              onChange={(e) => setSuccess(Number(e.target.value))}
              className="h-8"
            />
          </div>
        </div>

        {/* Color preview */}
        <div className="rounded-lg border p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Önizleme</p>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-red-100 px-2 py-1 text-red-700">
              &lt;{warning}% Kırmızı
            </span>
            <span className="rounded bg-orange-100 px-2 py-1 text-orange-700">
              {warning}-{success}% Turuncu
            </span>
            <span className="rounded bg-emerald-100 px-2 py-1 text-emerald-700">
              &ge;{success}% Yeşil
            </span>
          </div>
        </div>

        {hasChanges && (
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Kart 5: Varsayılan Dönem ─────────────────────────────────────

function VarsayilanDonemCard({ initialDonem }: { initialDonem: PeriodType }) {
  const [donem, setDonem] = useState<PeriodType>(initialDonem);
  const [saving, setSaving] = useState(false);

  const hasChanges = donem !== initialDonem;

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateVarsayilanDonem(donem);
      if (result.success) toast.success("Varsayılan dönem güncellendi");
      else toast.error(result.error);
    } catch {
      toast.error("Kaydetme sırasında hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Varsayılan Dönem</CardTitle>
        <CardDescription>Satış dashboard açılışında seçili dönem filtresi</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Select value={donem} onValueChange={(v) => setDonem(v as PeriodType)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasChanges && (
          <div className="flex justify-end">
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
