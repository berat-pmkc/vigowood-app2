"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDonemKodu } from "@/lib/utils";

interface DonemOption {
  id: string;
  donem_kodu: string;
}

interface DonemSelectorProps {
  donemler: DonemOption[];
  selectedDonemId: string;
}

export function DonemSelector({ donemler, selectedDonemId }: DonemSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const handleChange = useCallback(
    (donemId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("donem", donemId);
      startTransition(() => {
        router.push(`/muhasebe/nakit-akis?${params.toString()}`);
      });
    },
    [router, searchParams]
  );

  if (donemler.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">Henüz dönem oluşturulmamış.</p>
    );
  }

  return (
    <Select value={selectedDonemId} onValueChange={handleChange}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Dönem seçin" />
      </SelectTrigger>
      <SelectContent>
        {donemler.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            {formatDonemKodu(d.donem_kodu)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
