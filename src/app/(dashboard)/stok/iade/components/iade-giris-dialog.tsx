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
import { Textarea } from "@/components/ui/textarea";
import { Plus, ChevronsUpDown, Check, Loader2 } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { iadeGirisSchema, type IadeGirisData } from "@/lib/validations";
import { getActiveProducts, addIadeGiris } from "../actions";
import { toast } from "sonner";

type ProductOption = {
  sku: string;
  urun_adi: string | null;
  kategori: string | null;
  stok_aktif: number;
};

export function IadeGirisDialog() {
  const [open, setOpen] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<IadeGirisData>({
    resolver: zodResolver(iadeGirisSchema),
    defaultValues: {
      sku: "",
      qty: 1,
      durum: "Kullanilabilir",
      iade_nedeni: "",
      musteri_bilgisi: null,
    },
  });

  const selectedSku = watch("sku");
  const selectedProduct = products.find((p) => p.sku === selectedSku);

  // Load products when dialog opens
  useEffect(() => {
    if (open && !productsLoaded) {
      getActiveProducts().then((result) => {
        if (result.success) {
          setProducts(result.data as ProductOption[]);
        }
        setProductsLoaded(true);
      });
    }
  }, [open, productsLoaded]);

  const onSubmit = (data: IadeGirisData) => {
    startTransition(async () => {
      const result = await addIadeGiris({
        sku: data.sku,
        qty: data.qty,
        durum: data.durum,
        iade_nedeni: data.iade_nedeni,
        musteri_bilgisi: data.musteri_bilgisi || null,
      });

      if (result.success) {
        toast.success("İade girişi başarıyla kaydedildi");
        reset();
        setOpen(false);
        setProductsLoaded(false);
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
          Yeni İade
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>İade Girişi</DialogTitle>
          <DialogDescription>
            İade edilen ürünü kaydedin. Kullanılabilir iadeler stoğa otomatik eklenir.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* SKU seçimi */}
          <div className="space-y-2">
            <Label>Ürün (SKU) *</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className={cn(
                    "w-full justify-between",
                    !selectedSku && "text-muted-foreground"
                  )}
                >
                  {selectedProduct
                    ? selectedProduct.sku
                    : "Ürün seçiniz..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[440px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="SKU veya ürün adı ara..." />
                  <CommandList>
                    <CommandEmpty>Ürün bulunamadı.</CommandEmpty>
                    <CommandGroup>
                      {products.map((product) => (
                        <CommandItem
                          key={product.sku}
                          value={`${product.sku} ${product.urun_adi || ""}`}
                          onSelect={() => {
                            setValue("sku", product.sku, { shouldValidate: true });
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedSku === product.sku ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-1 items-center justify-between">
                            <div>
                              <span className="font-mono text-sm font-medium">{product.sku}</span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {product.urun_adi}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              Stok: {formatNumber(product.stok_aktif)}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {errors.sku && (
              <p className="text-sm text-destructive">{errors.sku.message}</p>
            )}
          </div>

          {/* Adet + Durum yan yana */}
          <div className="grid grid-cols-2 gap-3">
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
            <div className="space-y-2">
              <Label>Durum *</Label>
              <Select
                value={watch("durum")}
                onValueChange={(v) => setValue("durum", v as IadeGirisData["durum"], { shouldValidate: true })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Durum seçiniz" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kullanilabilir">Kullanılabilir</SelectItem>
                  <SelectItem value="Kullanilamaz">Kullanılamaz</SelectItem>
                </SelectContent>
              </Select>
              {errors.durum && (
                <p className="text-sm text-destructive">{errors.durum.message}</p>
              )}
            </div>
          </div>

          {/* İade nedeni */}
          <div className="space-y-2">
            <Label htmlFor="iade_nedeni">İade Nedeni *</Label>
            <Textarea
              id="iade_nedeni"
              placeholder="Hasarlı, yanlış ürün, müşteri iade vb."
              {...register("iade_nedeni")}
              rows={2}
            />
            {errors.iade_nedeni && (
              <p className="text-sm text-destructive">{errors.iade_nedeni.message}</p>
            )}
          </div>

          {/* Müşteri bilgisi */}
          <div className="space-y-2">
            <Label htmlFor="musteri_bilgisi">Müşteri Bilgisi</Label>
            <Input
              id="musteri_bilgisi"
              placeholder="Müşteri adı, sipariş no vb."
              {...register("musteri_bilgisi")}
            />
            {errors.musteri_bilgisi && (
              <p className="text-sm text-destructive">{errors.musteri_bilgisi.message}</p>
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
