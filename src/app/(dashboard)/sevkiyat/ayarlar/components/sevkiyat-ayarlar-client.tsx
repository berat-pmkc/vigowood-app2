"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, X, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type {
  ShipmentSettings,
  ShipmentCountry,
  PaletAyarlari,
  KonteynerTipi,
  AracTipi,
  MaliyetAyarlari,
  MaliyetField,
  FirmaTipi,
  DurumEtiketi,
  KurAyarlari,
} from "@/lib/shipment-settings-types";
import {
  updateSevkiyatUlkeler,
  updatePaletAyarlari,
  updateKonteynerTipleri,
  updateAracTipleri,
  updateMaliyetAyarlari,
  updateFirmaTipleri,
  updateDurumAyarlari,
  updateKurAyarlari,
} from "../actions";

interface Props {
  settings: ShipmentSettings;
}

export function SevkiyatAyarlarClient({ settings }: Props) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          <Settings className="h-5 w-5 sm:h-6 sm:w-6" />
          Sevkiyat Ayarları
        </h1>
        <p className="text-sm text-muted-foreground">
          Ülke, palet, konteyner, maliyet ve diğer sevkiyat ayarlarını yönetin
        </p>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <UlkelerCard initialData={settings.ulkeler} />
        <PaletCard initialData={settings.paletAyarlari} />
        <KonteynerCard initialData={settings.konteynerTipleri} />
        <AracTipleriCard initialData={settings.aracTipleri} />
        <MaliyetCard initialData={settings.maliyetAyarlari} />
        <FirmaTipleriCard initialData={settings.firmaTipleri} />
        <DurumCard initialData={settings.durumEtiketleri} />
        <KurCard initialData={settings.kurAyarlari} />
      </div>
    </div>
  );
}

// ─── SaveButton helper ──────────────────────────────────────────

function SaveButton({ saving, onClick }: { saving: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-end">
      <Button size="sm" className="gap-1.5" onClick={onClick} disabled={saving}>
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Kaydet
      </Button>
    </div>
  );
}

// ─── 1. Ülkeler ─────────────────────────────────────────────────

function UlkelerCard({ initialData }: { initialData: ShipmentCountry[] }) {
  const [data, setData] = useState<ShipmentCountry[]>(initialData);
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(data) !== JSON.stringify(initialData);

  const empty: ShipmentCountry = { code: "", name: "", nameEN: "", currency: "", currencySymbol: "", port: "", buyer: "" };
  const [newRow, setNewRow] = useState(empty);

  function addRow() {
    if (!newRow.code || !newRow.name || !newRow.currency) {
      toast.error("Kod, isim ve para birimi zorunludur");
      return;
    }
    if (data.some((c) => c.code === newRow.code)) {
      toast.error("Bu ülke kodu zaten mevcut");
      return;
    }
    setData([...data, { ...newRow }]);
    setNewRow(empty);
  }

  function removeRow(code: string) {
    setData(data.filter((c) => c.code !== code));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateSevkiyatUlkeler(data);
      if (result.success) toast.success("Ülkeler güncellendi");
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
        <CardTitle className="text-base">Hedef Ülkeler</CardTitle>
        <CardDescription>Sevkiyat ülkeleri, para birimleri, liman ve alıcı bilgileri</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Kod</th>
                <th className="px-3 py-2 text-left font-medium">İsim</th>
                <th className="px-3 py-2 text-left font-medium">İsim (EN)</th>
                <th className="px-3 py-2 text-left font-medium">Para Birimi</th>
                <th className="px-3 py-2 text-left font-medium">Sembol</th>
                <th className="px-3 py-2 text-left font-medium">Liman</th>
                <th className="px-3 py-2 text-left font-medium">Alıcı</th>
                <th className="px-3 py-2 text-right font-medium">Sil</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.code} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs font-semibold">{c.code}</td>
                  <td className="px-3 py-2">{c.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.nameEN}</td>
                  <td className="px-3 py-2 font-mono text-xs">{c.currency}</td>
                  <td className="px-3 py-2 text-center">{c.currencySymbol}</td>
                  <td className="px-3 py-2">{c.port}</td>
                  <td className="max-w-[200px] truncate px-3 py-2 text-xs text-muted-foreground">{c.buyer}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(c.code)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Kod</Label>
            <Input value={newRow.code} onChange={(e) => setNewRow({ ...newRow, code: e.target.value.toUpperCase() })} placeholder="DE" className="h-8 w-[60px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">İsim</Label>
            <Input value={newRow.name} onChange={(e) => setNewRow({ ...newRow, name: e.target.value })} placeholder="Almanya" className="h-8 w-[100px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">İsim (EN)</Label>
            <Input value={newRow.nameEN} onChange={(e) => setNewRow({ ...newRow, nameEN: e.target.value })} placeholder="Germany" className="h-8 w-[100px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Para Birimi</Label>
            <Input value={newRow.currency} onChange={(e) => setNewRow({ ...newRow, currency: e.target.value.toUpperCase() })} placeholder="EUR" className="h-8 w-[60px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Sembol</Label>
            <Input value={newRow.currencySymbol} onChange={(e) => setNewRow({ ...newRow, currencySymbol: e.target.value })} placeholder="€" className="h-8 w-[40px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Liman</Label>
            <Input value={newRow.port} onChange={(e) => setNewRow({ ...newRow, port: e.target.value })} placeholder="Gemlik" className="h-8 w-[80px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Alıcı</Label>
            <Input value={newRow.buyer} onChange={(e) => setNewRow({ ...newRow, buyer: e.target.value })} placeholder="Firma adı" className="h-8 w-[140px] text-xs" />
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {hasChanges && <SaveButton saving={saving} onClick={handleSave} />}
      </CardContent>
    </Card>
  );
}

// ─── 2. Palet Ayarları ──────────────────────────────────────────

function PaletCard({ initialData }: { initialData: PaletAyarlari }) {
  const [data, setData] = useState<PaletAyarlari>(initialData);
  const [newBoyut, setNewBoyut] = useState("");
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(data) !== JSON.stringify(initialData);

  function addBoyut() {
    const val = newBoyut.trim();
    if (!val) return;
    if (data.boyutlar.includes(val)) {
      toast.error("Bu boyut zaten mevcut");
      return;
    }
    setData({ ...data, boyutlar: [...data.boyutlar, val] });
    setNewBoyut("");
  }

  function removeBoyut(val: string) {
    setData({ ...data, boyutlar: data.boyutlar.filter((b) => b !== val) });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updatePaletAyarlari(data);
      if (result.success) toast.success("Palet ayarları güncellendi");
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
        <CardTitle className="text-base">Palet Ayarları</CardTitle>
        <CardDescription>Palet boyutları, ağırlık ve varsayılan yükseklik</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-2 block text-xs font-medium">Boyutlar (cm)</Label>
          <div className="flex flex-wrap gap-1.5">
            {data.boyutlar.map((b) => (
              <Badge key={b} variant="secondary" className="gap-1 pr-1 text-xs">
                {b}
                <button onClick={() => removeBoyut(b)} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={newBoyut} onChange={(e) => setNewBoyut(e.target.value)} placeholder="100x120" className="h-8 w-[100px] text-xs" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addBoyut())} />
            <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={addBoyut}>
              <Plus className="h-3.5 w-3.5" />Ekle
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Palet Ağırlığı (kg)</Label>
            <Input type="number" value={data.paletWeightKg} onChange={(e) => setData({ ...data, paletWeightKg: Number(e.target.value) })} className="h-8" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Varsayılan Yükseklik (cm)</Label>
            <Input type="number" value={data.defaultYukseklik} onChange={(e) => setData({ ...data, defaultYukseklik: Number(e.target.value) })} className="h-8" />
          </div>
        </div>

        {hasChanges && <SaveButton saving={saving} onClick={handleSave} />}
      </CardContent>
    </Card>
  );
}

// ─── 3. Konteyner Tipleri ───────────────────────────────────────

function KonteynerCard({ initialData }: { initialData: KonteynerTipi[] }) {
  const [data, setData] = useState<KonteynerTipi[]>(initialData);
  const [newType, setNewType] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(data) !== JSON.stringify(initialData);

  function addRow() {
    const t = newType.trim();
    const l = newLabel.trim();
    if (!t || !l) { toast.error("Tür ve etiket zorunludur"); return; }
    if (data.some((k) => k.type === t)) { toast.error("Bu tür zaten mevcut"); return; }
    setData([...data, { type: t, label: l }]);
    setNewType("");
    setNewLabel("");
  }

  function removeRow(type: string) {
    setData(data.filter((k) => k.type !== type));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateKonteynerTipleri(data);
      if (result.success) toast.success("Konteyner tipleri güncellendi");
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
        <CardTitle className="text-base">Konteyner Tipleri</CardTitle>
        <CardDescription>Kullanılabilir konteyner tipleri</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Tür</th>
                <th className="px-3 py-2 text-left font-medium">Etiket</th>
                <th className="px-3 py-2 text-right font-medium">Sil</th>
              </tr>
            </thead>
            <tbody>
              {data.map((k) => (
                <tr key={k.type} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{k.type}</td>
                  <td className="px-3 py-2">{k.label}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(k.type)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Tür</Label>
            <Input value={newType} onChange={(e) => setNewType(e.target.value)} placeholder="40ft HC" className="h-8 w-[100px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiket</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="40' HC Konteyner" className="h-8 w-[160px] text-xs" />
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {hasChanges && <SaveButton saving={saving} onClick={handleSave} />}
      </CardContent>
    </Card>
  );
}

// ─── 4. Araç Tipleri ────────────────────────────────────────────

function AracTipleriCard({ initialData }: { initialData: AracTipi[] }) {
  const [data, setData] = useState<AracTipi[]>(initialData);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(data) !== JSON.stringify(initialData);

  function addRow() {
    const id = newId.trim();
    const label = newLabel.trim();
    if (!id || !label) { toast.error("ID ve etiket zorunludur"); return; }
    if (data.some((a) => a.id === id)) { toast.error("Bu ID zaten mevcut"); return; }
    setData([...data, { id, label }]);
    setNewId("");
    setNewLabel("");
  }

  function removeRow(id: string) {
    setData(data.filter((a) => a.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateAracTipleri(data);
      if (result.success) toast.success("Araç tipleri güncellendi");
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
        <CardTitle className="text-base">Araç Tipleri</CardTitle>
        <CardDescription>Sevkiyat araç/taşıma tipleri</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">Etiket</th>
                <th className="px-3 py-2 text-right font-medium">Sil</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{a.id}</td>
                  <td className="px-3 py-2">{a.label}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">ID</Label>
            <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="konteyner" className="h-8 w-[100px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiket</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Konteyner" className="h-8 w-[120px] text-xs" />
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {hasChanges && <SaveButton saving={saving} onClick={handleSave} />}
      </CardContent>
    </Card>
  );
}

// ─── 5. Maliyet Ayarları ────────────────────────────────────────

function MaliyetCard({ initialData }: { initialData: MaliyetAyarlari }) {
  const [data, setData] = useState<MaliyetAyarlari>(initialData);
  const [newPara, setNewPara] = useState("");
  const [newField, setNewField] = useState<MaliyetField>({ key: "", label: "", defaultCurrency: "TRY" });
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(data) !== JSON.stringify(initialData);

  function addPara() {
    const val = newPara.trim().toUpperCase();
    if (!val) return;
    if (data.paraBirimleri.includes(val)) { toast.error("Bu para birimi zaten mevcut"); return; }
    setData({ ...data, paraBirimleri: [...data.paraBirimleri, val] });
    setNewPara("");
  }

  function removePara(val: string) {
    setData({ ...data, paraBirimleri: data.paraBirimleri.filter((p) => p !== val) });
  }

  function addField() {
    if (!newField.key || !newField.label) { toast.error("Anahtar ve etiket zorunludur"); return; }
    if (data.fields.some((f) => f.key === newField.key)) { toast.error("Bu anahtar zaten mevcut"); return; }
    setData({ ...data, fields: [...data.fields, { ...newField }] });
    setNewField({ key: "", label: "", defaultCurrency: "TRY" });
  }

  function removeField(key: string) {
    setData({ ...data, fields: data.fields.filter((f) => f.key !== key) });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateMaliyetAyarlari(data);
      if (result.success) toast.success("Maliyet ayarları güncellendi");
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
        <CardTitle className="text-base">Maliyet Ayarları</CardTitle>
        <CardDescription>Maliyet alanları, para birimleri ve desi çarpanı</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Maliyet alanları */}
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Anahtar</th>
                <th className="px-3 py-2 text-left font-medium">Etiket</th>
                <th className="px-3 py-2 text-left font-medium">Varsayılan Para Birimi</th>
                <th className="px-3 py-2 text-right font-medium">Sil</th>
              </tr>
            </thead>
            <tbody>
              {data.fields.map((f) => (
                <tr key={f.key} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{f.key}</td>
                  <td className="px-3 py-2">{f.label}</td>
                  <td className="px-3 py-2 font-mono text-xs">{f.defaultCurrency}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeField(f.key)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Anahtar</Label>
            <Input value={newField.key} onChange={(e) => setNewField({ ...newField, key: e.target.value })} placeholder="navlun" className="h-8 w-[100px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiket</Label>
            <Input value={newField.label} onChange={(e) => setNewField({ ...newField, label: e.target.value })} placeholder="Navlun" className="h-8 w-[120px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Varsayılan PB</Label>
            <Input value={newField.defaultCurrency} onChange={(e) => setNewField({ ...newField, defaultCurrency: e.target.value.toUpperCase() })} placeholder="USD" className="h-8 w-[60px] text-xs" />
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addField}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {/* Para birimleri badges */}
        <div>
          <Label className="mb-2 block text-xs font-medium">Para Birimleri</Label>
          <div className="flex flex-wrap gap-1.5">
            {data.paraBirimleri.map((p) => (
              <Badge key={p} variant="secondary" className="gap-1 pr-1 text-xs">
                {p}
                <button onClick={() => removePara(p)} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <Input value={newPara} onChange={(e) => setNewPara(e.target.value)} placeholder="PLN" className="h-8 w-[80px] text-xs" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPara())} />
            <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={addPara}>
              <Plus className="h-3.5 w-3.5" />Ekle
            </Button>
          </div>
        </div>

        {/* Desi çarpanı */}
        <div className="space-y-1.5">
          <Label className="text-xs">Desi Çarpanı</Label>
          <Input type="number" step="0.01" value={data.desiCarpani} onChange={(e) => setData({ ...data, desiCarpani: Number(e.target.value) })} className="h-8 w-[120px]" />
        </div>

        {hasChanges && <SaveButton saving={saving} onClick={handleSave} />}
      </CardContent>
    </Card>
  );
}

// ─── 6. Firma Tipleri ───────────────────────────────────────────

function FirmaTipleriCard({ initialData }: { initialData: FirmaTipi[] }) {
  const [data, setData] = useState<FirmaTipi[]>(initialData);
  const [newId, setNewId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(data) !== JSON.stringify(initialData);

  function addRow() {
    const id = newId.trim();
    const label = newLabel.trim();
    if (!id || !label) { toast.error("ID ve etiket zorunludur"); return; }
    if (data.some((f) => f.id === id)) { toast.error("Bu ID zaten mevcut"); return; }
    setData([...data, { id, label }]);
    setNewId("");
    setNewLabel("");
  }

  function removeRow(id: string) {
    setData(data.filter((f) => f.id !== id));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateFirmaTipleri(data);
      if (result.success) toast.success("Firma tipleri güncellendi");
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
        <CardTitle className="text-base">Firma Tipleri</CardTitle>
        <CardDescription>Proforma / paket listesi firma profil tipleri</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">ID</th>
                <th className="px-3 py-2 text-left font-medium">Etiket</th>
                <th className="px-3 py-2 text-right font-medium">Sil</th>
              </tr>
            </thead>
            <tbody>
              {data.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="px-3 py-2 font-mono text-xs">{f.id}</td>
                  <td className="px-3 py-2">{f.label}</td>
                  <td className="px-3 py-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeRow(f.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-xs">ID</Label>
            <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="ihracatci" className="h-8 w-[100px] text-xs" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Etiket</Label>
            <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="İhracatçı" className="h-8 w-[120px] text-xs" />
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {hasChanges && <SaveButton saving={saving} onClick={handleSave} />}
      </CardContent>
    </Card>
  );
}

// ─── 7. Durum Etiketleri ────────────────────────────────────────

function DurumCard({ initialData }: { initialData: DurumEtiketi[] }) {
  const [data, setData] = useState<DurumEtiketi[]>(initialData);
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(data) !== JSON.stringify(initialData);

  function updateLabel(id: string, label: string) {
    setData(data.map((d) => (d.id === id ? { ...d, label } : d)));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateDurumAyarlari(data);
      if (result.success) toast.success("Durum etiketleri güncellendi");
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
        <CardTitle className="text-base">Durum Etiketleri</CardTitle>
        <CardDescription>Sevkiyat durum adları ve renkleri</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          {data.map((d) => (
            <div key={d.id} className="flex items-center gap-3">
              <span className={`inline-flex items-center rounded px-2 py-1 text-xs font-medium ${d.bg} ${d.text} border ${d.border}`}>
                {d.label}
              </span>
              <Input
                value={d.label}
                onChange={(e) => updateLabel(d.id, e.target.value)}
                className="h-8 flex-1 text-xs"
              />
              <span className="font-mono text-xs text-muted-foreground">{d.id}</span>
            </div>
          ))}
        </div>

        {hasChanges && <SaveButton saving={saving} onClick={handleSave} />}
      </CardContent>
    </Card>
  );
}

// ─── 8. Kur Ayarları ────────────────────────────────────────────

function KurCard({ initialData }: { initialData: KurAyarlari }) {
  const [data, setData] = useState<KurAyarlari>(initialData);
  const [newCur, setNewCur] = useState("");
  const [saving, setSaving] = useState(false);
  const hasChanges = JSON.stringify(data) !== JSON.stringify(initialData);

  function addCurrency() {
    const val = newCur.trim().toUpperCase();
    if (!val) return;
    if (data.currencies.includes(val)) { toast.error("Bu para birimi zaten mevcut"); return; }
    setData({ ...data, currencies: [...data.currencies, val] });
    setNewCur("");
  }

  function removeCurrency(val: string) {
    setData({ ...data, currencies: data.currencies.filter((c) => c !== val) });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateKurAyarlari(data);
      if (result.success) toast.success("Kur ayarları güncellendi");
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
        <CardTitle className="text-base">Döviz Kuru Ayarları</CardTitle>
        <CardDescription>Takip edilen döviz kurları</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {data.currencies.map((c) => (
            <Badge key={c} variant="secondary" className="gap-1 pr-1 text-xs">
              {c}
              <button onClick={() => removeCurrency(c)} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>

        <div className="flex gap-2">
          <Input value={newCur} onChange={(e) => setNewCur(e.target.value)} placeholder="PLN" className="h-8 w-[80px] text-xs" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCurrency())} />
          <Button size="sm" variant="outline" className="h-8 gap-1 shrink-0" onClick={addCurrency}>
            <Plus className="h-3.5 w-3.5" />Ekle
          </Button>
        </div>

        {hasChanges && <SaveButton saving={saving} onClick={handleSave} />}
      </CardContent>
    </Card>
  );
}
