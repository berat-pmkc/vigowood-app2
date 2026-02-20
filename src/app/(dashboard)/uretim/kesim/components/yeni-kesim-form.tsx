"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MakineSelector } from "./makine-selector";
import { PlakaSelector } from "./plaka-selector";
import { AdetInput } from "./adet-input";
import { PartsPreview } from "./parts-preview";
import { createCutBatch, getPlakalarForKesim } from "../actions";
import type { MakineId } from "@/lib/constants";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChevronLeft, ChevronRight, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Product {
  sku: string;
  urun_adi: string | null;
  kategori: string | null;
}

interface Plaka {
  plakalar_id: string;
  plaka_id: string;
  plaka_adi: string;
  sku: string | null;
  tipi: string | null;
  renk: string | null;
  makine_id: string;
  std_kesim_suresi_dk: number | null;
}

interface YeniKesimFormProps {
  products: Product[];
}

const STEPS = [
  { title: "Makine Seçimi", description: "Kesim yapılacak makineyi seçin" },
  { title: "Ürün Seçimi", description: "Kesilecek ürünü seçin" },
  { title: "Plaka Seçimi", description: "Plaka şablonunu seçin" },
  { title: "Adet", description: "Kaç plaka kesilecek?" },
  { title: "Önizleme", description: "Kontrol edin ve oluşturun" },
];

export function YeniKesimForm({ products }: YeniKesimFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [step, setStep] = useState(0);
  const [makineId, setMakineId] = useState<MakineId | null>(null);
  const [sku, setSku] = useState<string | null>(null);
  const [skuOpen, setSkuOpen] = useState(false);
  const [plakaId, setPlakaId] = useState<string | null>(null);
  const [plakaAdi, setPlakaAdi] = useState<string | null>(null);
  const [adet, setAdet] = useState(1);
  const [not, setNot] = useState("");
  const [plakalar, setPlakalar] = useState<Plaka[]>([]);
  const [plakaLoading, setPlakaLoading] = useState(false);

  const selectedProduct = products.find((p) => p.sku === sku);

  const canNext = () => {
    switch (step) {
      case 0: return makineId !== null;
      case 1: return sku !== null;
      case 2: return plakaId !== null;
      case 3: return adet >= 1;
      case 4: return true;
      default: return false;
    }
  };

  const handleMakineChange = (id: MakineId) => {
    setMakineId(id);
    // Reset downstream
    setSku(null);
    setPlakaId(null);
    setPlakaAdi(null);
    setPlakalar([]);
  };

  const handleSkuChange = async (newSku: string) => {
    setSku(newSku);
    setPlakaId(null);
    setPlakaAdi(null);
    setSkuOpen(false);

    // Fetch plakalar for this combination
    if (makineId) {
      setPlakaLoading(true);
      const result = await getPlakalarForKesim(makineId, newSku);
      if (result.success) setPlakalar(result.data);
      setPlakaLoading(false);
    }
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSubmit = () => {
    if (!makineId || !sku || !plakaId) return;

    startTransition(async () => {
      const result = await createCutBatch({
        makine_id: makineId,
        sku: sku,
        plaka_id: plakaId,
        adet: adet,
        plk_notu: not.trim() || null,
      });

      if (result.success) {
        toast.success("Kesim kaydı oluşturuldu");
        router.push("/uretim/kesim");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center">
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              )}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn(
                "w-8 h-0.5 mx-1",
                i < step ? "bg-primary/40" : "bg-muted"
              )} />
            )}
          </div>
        ))}
      </div>

      {/* Step title */}
      <div className="text-center">
        <h2 className="text-lg font-semibold">{STEPS[step].title}</h2>
        <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
      </div>

      {/* Step content */}
      <div className="min-h-[300px]">
        {/* Step 0: Makine */}
        {step === 0 && (
          <MakineSelector value={makineId} onChange={handleMakineChange} />
        )}

        {/* Step 1: SKU */}
        {step === 1 && (
          <div className="flex justify-center">
            <Popover open={skuOpen} onOpenChange={setSkuOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full max-w-md justify-between h-12 text-left"
                >
                  {selectedProduct
                    ? `${selectedProduct.urun_adi ?? selectedProduct.sku}`
                    : "Ürün seçin..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full max-w-md p-0" align="start">
                <Command>
                  <CommandInput placeholder="Ürün ara..." />
                  <CommandList>
                    <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                    <CommandGroup>
                      {products.map((p) => (
                        <CommandItem
                          key={p.sku}
                          value={`${p.urun_adi ?? ""} ${p.sku}`}
                          onSelect={() => handleSkuChange(p.sku)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              sku === p.sku ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div>
                            <p className="font-medium">{p.urun_adi ?? p.sku}</p>
                            <p className="text-xs text-muted-foreground">{p.sku}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        )}

        {/* Step 2: Plaka */}
        {step === 2 && (
          plakaLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <PlakaSelector
              plakalar={plakalar}
              value={plakaId}
              onChange={(id, adi) => { setPlakaId(id); setPlakaAdi(adi); }}
            />
          )
        )}

        {/* Step 3: Adet */}
        {step === 3 && (
          <div className="flex justify-center py-8">
            <AdetInput value={adet} onChange={setAdet} />
          </div>
        )}

        {/* Step 4: Preview */}
        {step === 4 && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="rounded-lg border p-4 bg-muted/30 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Makine</span>
                <span className="font-medium">{makineId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ürün</span>
                <span className="font-medium">{selectedProduct?.urun_adi ?? sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plaka</span>
                <span className="font-medium">{plakaAdi ?? plakaId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Adet</span>
                <span className="font-bold text-lg">{adet}</span>
              </div>
            </div>

            <PartsPreview plakaId={plakaId} adet={adet} />

            {/* Not alanı */}
            <div>
              <Label htmlFor="plk_notu" className="text-sm">Not (opsiyonel)</Label>
              <Input
                id="plk_notu"
                value={not}
                onChange={(e) => setNot(e.target.value)}
                placeholder="Kesim notu..."
                className="mt-1"
                maxLength={500}
              />
            </div>

            <Button
              className="w-full h-14 text-base bg-vw-success hover:bg-vw-success/90 text-white"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              ) : (
                <Check className="w-5 h-5 mr-2" />
              )}
              Kesimi Oluştur
            </Button>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            className="h-12 px-6"
            onClick={handleBack}
            disabled={step === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
          <Button
            className="h-12 px-6"
            onClick={handleNext}
            disabled={!canNext()}
          >
            İleri
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className="flex justify-start pt-2">
          <Button
            variant="outline"
            className="h-12 px-6"
            onClick={handleBack}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Geri
          </Button>
        </div>
      )}
    </div>
  );
}
