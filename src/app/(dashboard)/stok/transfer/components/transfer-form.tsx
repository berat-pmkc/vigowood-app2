"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Loader2, ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, formatNumber } from "@/lib/utils";
import { depoBakiyeGetir, transferOlustur } from "../actions";

interface Product {
  sku: string;
  urun_adi: string | null;
}

interface Depo {
  depo_id: string;
  ad: string;
}

export function TransferForm({
  products,
  depolar,
}: {
  products: Product[];
  depolar: Depo[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [comboOpen, setComboOpen] = useState(false);
  const [sku, setSku] = useState<string | null>(null);
  const [kaynakDepoId, setKaynakDepoId] = useState<string>("");
  const [hedefDepoId, setHedefDepoId] = useState<string>("");
  const [miktar, setMiktar] = useState<string>("");
  const [not, setNot] = useState("");
  const [gonderiliyor, setGonderiliyor] = useState(false);

  const [bakiye, setBakiye] = useState<number | null>(null);
  const [bakiyeYukleniyor, setBakiyeYukleniyor] = useState(false);

  const secili = useMemo(() => products.find((p) => p.sku === sku) ?? null, [products, sku]);

  // Seçili ürün + kaynak depo değişince o anki bakiyeyi çek
  useEffect(() => {
    if (!sku || !kaynakDepoId) {
      setBakiye(null);
      return;
    }
    let iptal = false;
    setBakiyeYukleniyor(true);
    depoBakiyeGetir(sku, kaynakDepoId).then((r) => {
      if (iptal) return;
      setBakiyeYukleniyor(false);
      if (r.success) setBakiye(r.miktar);
      else setBakiye(null);
    });
    return () => {
      iptal = true;
    };
  }, [sku, kaynakDepoId]);

  const hedefSecenekleri = depolar.filter((d) => d.depo_id !== kaynakDepoId);
  const miktarSayi = Number(miktar);
  const miktarGecerli = miktar.trim() !== "" && !Number.isNaN(miktarSayi) && miktarSayi > 0;
  const yetersizBakiye = bakiye !== null && miktarGecerli && miktarSayi > bakiye;

  const formGecerli =
    !!sku && !!kaynakDepoId && !!hedefDepoId && kaynakDepoId !== hedefDepoId && miktarGecerli;

  const gonder = async () => {
    if (!formGecerli || !sku) return;
    setGonderiliyor(true);
    const sonuc = await transferOlustur({
      sku,
      kaynakDepoId,
      hedefDepoId,
      miktar: miktarSayi,
      not: not.trim() || undefined,
    });
    setGonderiliyor(false);

    if (!sonuc.success) {
      toast.error(sonuc.error);
      return;
    }
    toast.success("Transfer tamamlandı");
    setSku(null);
    setMiktar("");
    setNot("");
    setBakiye(null);
    startTransition(() => router.refresh());
  };

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center gap-2">
        <ArrowRightLeft className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-medium">Yeni Transfer</h2>
      </div>

      <div className="space-y-1.5">
        <Label>Ürün *</Label>
        <Popover open={comboOpen} onOpenChange={setComboOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={comboOpen}
              className="w-full justify-between font-normal"
            >
              {secili ? (
                <span className="truncate">
                  <span className="font-mono">{secili.sku}</span>
                  {secili.urun_adi ? ` — ${secili.urun_adi}` : ""}
                </span>
              ) : (
                <span className="text-muted-foreground">Ürün seçin...</span>
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(value, search) => {
                const p = products.find((x) => x.sku === value);
                const hay = `${value} ${p?.urun_adi ?? ""}`.toLowerCase();
                return hay.includes(search.toLowerCase()) ? 1 : 0;
              }}
            >
              <CommandInput placeholder="SKU veya ürün adı ara..." />
              <CommandList>
                <CommandEmpty>Ürün bulunamadı</CommandEmpty>
                <CommandGroup>
                  {products.map((p) => (
                    <CommandItem
                      key={p.sku}
                      value={p.sku}
                      onSelect={(value) => {
                        setSku(value);
                        setComboOpen(false);
                      }}
                    >
                      <Check
                        className={cn("mr-2 h-4 w-4", sku === p.sku ? "opacity-100" : "opacity-0")}
                      />
                      <span className="font-mono text-sm">{p.sku}</span>
                      {p.urun_adi && (
                        <span className="ml-1.5 truncate text-xs text-muted-foreground">
                          {p.urun_adi}
                        </span>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Kaynak Depo *</Label>
          <Select
            value={kaynakDepoId}
            onValueChange={(v) => {
              setKaynakDepoId(v);
              if (v === hedefDepoId) setHedefDepoId("");
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Depo seçin" />
            </SelectTrigger>
            <SelectContent>
              {depolar.map((d) => (
                <SelectItem key={d.depo_id} value={d.depo_id}>
                  {d.ad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sku && kaynakDepoId && (
            <p className="text-xs text-muted-foreground">
              {bakiyeYukleniyor ? (
                "Bakiye yükleniyor..."
              ) : (
                <>
                  Mevcut bakiye:{" "}
                  <span className={cn("font-medium", bakiye !== null && bakiye <= 0 && "text-destructive")}>
                    {bakiye !== null ? formatNumber(bakiye) : "—"}
                  </span>
                </>
              )}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Hedef Depo *</Label>
          <Select value={hedefDepoId} onValueChange={setHedefDepoId} disabled={!kaynakDepoId}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Depo seçin" />
            </SelectTrigger>
            <SelectContent>
              {hedefSecenekleri.map((d) => (
                <SelectItem key={d.depo_id} value={d.depo_id}>
                  {d.ad}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transfer-miktar">Miktar *</Label>
        <Input
          id="transfer-miktar"
          type="number"
          min={1}
          inputMode="numeric"
          value={miktar}
          onChange={(e) => setMiktar(e.target.value)}
          placeholder="0"
        />
        {yetersizBakiye && (
          <p className="text-xs text-destructive">
            Kaynak depoda yeterli stok yok (mevcut: {formatNumber(bakiye ?? 0)})
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="transfer-not">Not (isteğe bağlı)</Label>
        <Textarea
          id="transfer-not"
          rows={2}
          value={not}
          onChange={(e) => setNot(e.target.value)}
          placeholder="Transfer sebebi, sevkiyat referansı vb."
        />
      </div>

      <Button
        className="w-full sm:w-auto"
        onClick={gonder}
        disabled={!formGecerli || gonderiliyor || isPending}
      >
        {(gonderiliyor || isPending) && <Loader2 className="mr-2 size-4 animate-spin" />}
        Transferi Gerçekleştir
      </Button>
    </Card>
  );
}
