"use client";

import { useState, useEffect, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { PART_TYPE_LABELS } from "@/lib/constants";
import { hazirElemanGirisSchema, type HazirElemanGirisData } from "@/lib/validations";
import { getHazirElemanParts, addHazirElemanStok } from "../actions";
import { toast } from "sonner";

type PartOption = {
  part_id: string;
  part_adi: string;
  part_type: string;
  hazir_eleman_aktif_stok: number;
};

export function StokGirisDialog() {
  const [open, setOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [parts, setParts] = useState<PartOption[]>([]);
  const [partsLoaded, setPartsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<HazirElemanGirisData>({
    resolver: zodResolver(hazirElemanGirisSchema),
    defaultValues: {
      part_id: "",
      qty: 1,
      not_text: null,
    },
  });

  const selectedPartId = watch("part_id");
  const selectedPart = parts.find((p) => p.part_id === selectedPartId);

  // Load parts when dialog opens
  useEffect(() => {
    if (open && !partsLoaded) {
      getHazirElemanParts().then((result) => {
        if (result.success) {
          setParts(result.data as PartOption[]);
        }
        setPartsLoaded(true);
      });
    }
  }, [open, partsLoaded]);

  const onSubmit = (data: HazirElemanGirisData) => {
    startTransition(async () => {
      const result = await addHazirElemanStok({
        part_id: data.part_id,
        qty: data.qty,
        not_text: data.not_text || null,
      });

      if (result.success) {
        toast.success("Stok girişi başarıyla kaydedildi");
        reset();
        setOpen(false);
        setPartsLoaded(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Stok Girişi
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Hazır Eleman Stok Girişi</DialogTitle>
          <DialogDescription>
            Tedarikten gelen parçalar için stok girişi yapın.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Parça seçimi */}
          <div className="space-y-2">
            <Label>Parça *</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between",
                    !selectedPartId && "text-muted-foreground"
                  )}
                >
                  {selectedPart
                    ? `${selectedPart.part_id} — ${selectedPart.part_adi}`
                    : "Parça seçiniz..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[440px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Parça ara..." />
                  <CommandList>
                    <CommandEmpty>Parça bulunamadı.</CommandEmpty>
                    <CommandGroup>
                      {parts.map((part) => (
                        <CommandItem
                          key={part.part_id}
                          value={`${part.part_id} ${part.part_adi}`}
                          onSelect={() => {
                            setValue("part_id", part.part_id, { shouldValidate: true });
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPartId === part.part_id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-1 items-center justify-between">
                            <div>
                              <span className="font-mono text-sm">{part.part_id}</span>
                              <span className="ml-2 text-sm text-muted-foreground">
                                {part.part_adi}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {PART_TYPE_LABELS[part.part_type as keyof typeof PART_TYPE_LABELS] || part.part_type}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Stok: {formatNumber(part.hazir_eleman_aktif_stok)}
                              </span>
                            </div>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.part_id && (
              <p className="text-sm text-destructive">{errors.part_id.message}</p>
            )}
          </div>

          {/* Adet */}
          <div className="space-y-2">
            <Label htmlFor="qty">Adet *</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              {...register("qty", { valueAsNumber: true })}
            />
            {errors.qty && (
              <p className="text-sm text-destructive">{errors.qty.message}</p>
            )}
          </div>

          {/* Tedarikçi notu */}
          <div className="space-y-2">
            <Label htmlFor="not_text">Tedarikçi Notu</Label>
            <Textarea
              id="not_text"
              placeholder="Tedarikçi, fatura no vb."
              {...register("not_text")}
              rows={2}
            />
            {errors.not_text && (
              <p className="text-sm text-destructive">{errors.not_text.message}</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              İptal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Kaydet
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
