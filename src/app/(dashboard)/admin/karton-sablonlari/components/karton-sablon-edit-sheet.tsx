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
import { kartonSablonCreateSchema, type KartonSablonCreateData } from "@/lib/validations";
import { formatDate } from "@/lib/utils";
import { createKartonSablon, updateKartonSablon, getKutuKartonParts } from "../actions";
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
  const [parts, setParts] = useState<{ part_id: string; part_adi: string; part_type: string }[]>([]);
  const [partOpen, setPartOpen] = useState(false);

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

  const selectedPartId = watch("output_part_id");

  // Load parts on open
  useEffect(() => {
    if (open) {
      getKutuKartonParts().then((r) => {
        if (r.success) setParts(r.data);
      });
    }
  }, [open]);

  useEffect(() => {
    if (isCreate) {
      reset({
        plaka_id: "",
        plaka_adi: "",
        tipi: null,
        renk: null,
        sku: "",
        kutu_sure_dk: null,
        output_part_id: "",
      });
    } else if (sablon) {
      const ks = (sablon.kesim_sureleri ?? {}) as Record<string, number | null>;
      reset({
        plaka_id: sablon.plaka_id,
        plaka_adi: sablon.plaka_adi || "",
        tipi: sablon.tipi || null,
        renk: sablon.renk || null,
        sku: sablon.sku || "",
        kutu_sure_dk: ks["KUTU"] ?? null,
        output_part_id: sablon.output_part_id || "",
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
        const { plaka_id: _, ...updateData } = data;
        const result = await updateKartonSablon(sablon.plakalar_id, updateData);
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

  const selectedPart = parts.find((p) => p.part_id === selectedPartId);

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
              : `${sablon?.plakalar_id} — ${sablon?.plaka_id}`}
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 pb-6 space-y-6 pt-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              {/* Şablon ID — create only */}
              {isCreate && (
                <div className="space-y-2">
                  <Label htmlFor="plaka_id">Şablon ID</Label>
                  <Input
                    id="plaka_id"
                    {...register("plaka_id")}
                    placeholder="ör: KRT-001"
                  />
                  {errors.plaka_id && (
                    <p className="text-sm text-destructive">{errors.plaka_id.message}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="plaka_adi">Şablon Adı</Label>
                <Input
                  id="plaka_adi"
                  {...register("plaka_adi")}
                  placeholder="Şablon adı..."
                />
                {errors.plaka_adi && (
                  <p className="text-sm text-destructive">{errors.plaka_adi.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sku">SKU (Ürün)</Label>
                <Input
                  id="sku"
                  {...register("sku")}
                  placeholder="ör: VW-001"
                />
                {errors.sku && (
                  <p className="text-sm text-destructive">{errors.sku.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tipi">Tip</Label>
                  <Input
                    id="tipi"
                    {...register("tipi")}
                    placeholder="ör: Karton"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="renk">Renk</Label>
                  <Input
                    id="renk"
                    {...register("renk")}
                    placeholder="ör: Kraft"
                  />
                </div>
              </div>

              {/* KUTU süresi */}
              <div className="space-y-2">
                <Label>KUTU Kesim Süresi (dk)</Label>
                <Input
                  type="number"
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

              {/* Çıkan Parça seçimi */}
              <div className="space-y-2">
                <Label>Çıkan Parça</Label>
                <Popover open={partOpen} onOpenChange={setPartOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-between"
                    >
                      {selectedPart ? (
                        <span className="truncate">{selectedPart.part_adi}</span>
                      ) : (
                        <span className="text-muted-foreground">Parça seçin...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[350px] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Parça ara..." />
                      <CommandList>
                        <CommandEmpty>Parça bulunamadı</CommandEmpty>
                        <CommandGroup heading="KUTU / KARTON Parçaları">
                          {parts.map((part) => (
                            <CommandItem
                              key={part.part_id}
                              value={`${part.part_id} ${part.part_adi}`}
                              onSelect={() => {
                                setValue("output_part_id", part.part_id, {
                                  shouldValidate: true,
                                });
                                setPartOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedPartId === part.part_id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="truncate">{part.part_adi}</span>
                                <Badge variant="outline" className="text-[10px] shrink-0">
                                  {part.part_type}
                                </Badge>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {errors.output_part_id && (
                  <p className="text-sm text-destructive">{errors.output_part_id.message}</p>
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
                      <p className="font-mono font-medium">{sablon.plaka_id}</p>
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
