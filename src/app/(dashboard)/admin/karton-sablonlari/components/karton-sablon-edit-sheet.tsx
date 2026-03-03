"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MultiSkuSelect } from "@/components/shared/multi-sku-select";
import { kartonSablonCreateSchema, type KartonSablonCreateData } from "@/lib/validations";
import { KUTU_TURLERI } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import {
  createKartonSablon,
  updateKartonSablon,
  getKartonTipParts,
  getProductsForSelect,
} from "../actions";
import { toast } from "sonner";
import type { KartonSablonRow } from "./karton-sablon-columns";

interface KartonSablonEditSheetProps {
  sablon: KartonSablonRow | null;
  mode: "create" | "edit";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

export function KartonSablonEditSheet({
  sablon,
  mode,
  open,
  onOpenChange,
  onSaved,
}: KartonSablonEditSheetProps) {
  const [isPending, startTransition] = useTransition();
  const isCreate = mode === "create";
  const [tipParts, setTipParts] = useState<{ part_id: string; part_adi: string }[]>([]);
  const [tipPartOpen, setTipPartOpen] = useState(false);
  const [products, setProducts] = useState<{ sku: string; urun_adi: string | null }[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<KartonSablonCreateData>({
    resolver: zodResolver(kartonSablonCreateSchema) as never,
  });

  const selectedTipPartId = watch("tip_part_id");
  const selectedSkus = watch("sku") ?? [];
  const selectedTur = watch("tur");

  // Load dropdown data on open
  useEffect(() => {
    if (open) {
      getKartonTipParts().then((r) => {
        if (r.success) setTipParts(r.data);
      });
      getProductsForSelect().then((r) => {
        if (r.success) setProducts(r.data);
      });
    }
  }, [open]);

  useEffect(() => {
    if (isCreate) {
      reset({
        sku: [],
        tur: undefined,
        tip_part_id: "",
        en: null,
        boy: null,
        kutu_sure_dk: null,
      });
    } else if (sablon) {
      const ks = (sablon.kesim_sureleri ?? {}) as Record<string, number | null>;
      reset({
        sku: (sablon.sku as string[] | null) ?? [],
        tur: (sablon.renk === "İç Kutu" || sablon.renk === "Dış Koli") ? sablon.renk : undefined,
        tip_part_id: sablon.tip_part_id || "",
        en: sablon.en ?? null,
        boy: sablon.boy ?? null,
        kutu_sure_dk: ks["KUTU"] ?? null,
      });
    }
  }, [sablon, isCreate, reset, open]);

  const onSubmit = (data: KartonSablonCreateData) => {
    startTransition(async () => {
      if (isCreate) {
        const result = await createKartonSablon(data);
        if (result.success) {
          toast.success("Karton şablon oluşturuldu");
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      } else {
        if (!sablon) return;
        const result = await updateKartonSablon(sablon.plakalar_id, data);
        if (result.success) {
          toast.success("Karton şablon güncellendi");
          onOpenChange(false);
          onSaved();
        } else {
          toast.error(result.error);
        }
      }
    });
  };

  const selectedTipPart = tipParts.find((p) => p.part_id === selectedTipPartId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="px-6 pt-6">
          <SheetTitle className="text-lg">
            {isCreate ? "Yeni Karton Şablon" : "Şablon Düzenle"}
          </SheetTitle>
          <SheetDescription>
            {isCreate
              ? "Kutu-koli üretim hattı için karton kesim şablonu"
              : `${sablon?.plakalar_id}`}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-6 pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {/* Multi-SKU selection */}
              <div className="space-y-2">
                <Label>SKU (Ürünler)</Label>
                <MultiSkuSelect
                  products={products}
                  selected={selectedSkus}
                  onChange={(skus) =>
                    setValue("sku", skus, { shouldValidate: true })
                  }
                  placeholder="Ürün SKU seçin..."
                />
                {errors.sku && (
                  <p className="text-sm text-destructive">{errors.sku.message}</p>
                )}
              </div>

              {/* Tür dropdown */}
              <div className="space-y-2">
                <Label>Tür</Label>
                <Select
                  value={selectedTur || ""}
                  onValueChange={(v) =>
                    setValue("tur", v as "İç Kutu" | "Dış Koli", { shouldValidate: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Tür seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {KUTU_TURLERI.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.tur && (
                  <p className="text-sm text-destructive">{errors.tur.message}</p>
                )}
              </div>

              {/* Tip (Karton Malzeme) combobox */}
              <div className="space-y-2">
                <Label>Tip (Karton Malzeme)</Label>
                <Popover open={tipPartOpen} onOpenChange={setTipPartOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedTipPart ? (
                        <span className="truncate">{selectedTipPart.part_adi}</span>
                      ) : (
                        <span className="text-muted-foreground">Karton tipi seçin...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Karton ara..." />
                      <CommandList>
                        <CommandEmpty>Karton bulunamadı</CommandEmpty>
                        <CommandGroup heading="Karton Parçaları">
                          {tipParts.map((part) => (
                            <CommandItem
                              key={part.part_id}
                              value={`${part.part_id} ${part.part_adi}`}
                              onSelect={() => {
                                setValue("tip_part_id", part.part_id, {
                                  shouldValidate: true,
                                });
                                setTipPartOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedTipPartId === part.part_id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <span className="truncate">{part.part_adi}</span>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.tip_part_id && (
                  <p className="text-sm text-destructive">{errors.tip_part_id.message}</p>
                )}
              </div>

              {/* En / Boy */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>En (cm)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    {...register("en", {
                      setValueAs: (v) =>
                        v === "" || v === null || v === undefined ? null : Number(v),
                    })}
                    placeholder="—"
                  />
                  {errors.en && (
                    <p className="text-sm text-destructive">{errors.en.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Boy (cm)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min={0}
                    {...register("boy", {
                      setValueAs: (v) =>
                        v === "" || v === null || v === undefined ? null : Number(v),
                    })}
                    placeholder="—"
                  />
                  {errors.boy && (
                    <p className="text-sm text-destructive">{errors.boy.message}</p>
                  )}
                </div>
              </div>

              {/* Kesim süresi */}
              <div className="space-y-2">
                <Label>Kesim Süresi (dk)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min={0}
                  {...register("kutu_sure_dk", {
                    setValueAs: (v) =>
                      v === "" || v === null || v === undefined ? null : Number(v),
                  })}
                  placeholder="—"
                />
                {errors.kutu_sure_dk && (
                  <p className="text-sm text-destructive">{errors.kutu_sure_dk.message}</p>
                )}
              </div>
            </div>

            {/* Read-only info — edit mode */}
            {!isCreate && sablon && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    Bilgiler (salt okunur)
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Şablon ID</span>
                      <p className="font-mono font-medium">{sablon.plakalar_id}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Oluşturulma</span>
                      <p className="font-medium">{formatDate(sablon.created_at)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <Separator />

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                İptal
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Kaydediliyor..."
                  : isCreate
                    ? "Oluştur"
                    : "Kaydet"}
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
