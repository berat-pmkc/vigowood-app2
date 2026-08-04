"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SevkiyatStatusBadge } from "../../components/sevkiyat-status-badge";
import {
  SEVKIYAT_STATUS,
  SEVKIYAT_STATUS_LABELS,
  type SevkiyatStatus,
} from "@/lib/constants";
import { setSevkiyatDurum } from "../../actions";
import { toast } from "sonner";
import { Check, ChevronDown, Loader2 } from "lucide-react";

interface DurumSeciciProps {
  sevkiyatId: string;
  durum: string;
}

/**
 * Sevkiyat durumunu doğrudan değiştirmeyi sağlar.
 *
 * Normal akış (Hazırlığa Başla / Sevk Et / Teslim Edildi butonları) yerini
 * almaz; yanlış işaretlenmiş veya dışarıdan aktarılmış kayıtları düzeltmek
 * için vardır. Geri alma ve iptal gibi sonucu ağır seçimlerde onay istenir.
 */
export function DurumSecici({ sevkiyatId, durum }: DurumSeciciProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [onay, setOnay] = useState<SevkiyatStatus | null>(null);

  const sira = (d: string) => SEVKIYAT_STATUS.indexOf(d as SevkiyatStatus);
  const geriMi = (hedef: SevkiyatStatus) =>
    hedef !== "iptal_edildi" && durum !== "iptal_edildi" && sira(hedef) < sira(durum);

  const uygula = async (hedef: SevkiyatStatus) => {
    setLoading(true);
    const r = await setSevkiyatDurum(sevkiyatId, hedef);
    setLoading(false);
    setOnay(null);

    if (!r.success) {
      toast.error(r.error);
      return;
    }
    toast.success(`Durum "${SEVKIYAT_STATUS_LABELS[hedef]}" olarak güncellendi`);
    router.refresh();
  };

  const sec = (hedef: SevkiyatStatus) => {
    if (hedef === durum) return;
    // Geri alma ve iptal veri kaybına yol açabilir — önce sor
    if (geriMi(hedef) || hedef === "iptal_edildi") {
      setOnay(hedef);
      return;
    }
    void uygula(hedef);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={loading}
          className="flex items-center gap-1 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          aria-label="Sevkiyat durumunu değiştir"
        >
          <SevkiyatStatusBadge durum={durum} className="cursor-pointer" />
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Durumu değiştir
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SEVKIYAT_STATUS.map((d) => (
            <DropdownMenuItem
              key={d}
              onSelect={() => sec(d)}
              className="flex items-center justify-between gap-2"
            >
              <span className={d === durum ? "font-semibold" : ""}>
                {SEVKIYAT_STATUS_LABELS[d]}
              </span>
              {d === durum ? <Check className="w-3.5 h-3.5" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={onay !== null} onOpenChange={(o) => !o && setOnay(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {onay === "iptal_edildi" ? "Sevkiyat iptal edilsin mi?" : "Durum geri alınsın mı?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {onay === "iptal_edildi"
                ? "Sevkiyat iptal edildi olarak işaretlenecek. Zaman damgaları korunur, istediğiniz zaman başka bir duruma geçirebilirsiniz."
                : `Durum "${SEVKIYAT_STATUS_LABELS[durum as SevkiyatStatus]}" yerine "${
                    onay ? SEVKIYAT_STATUS_LABELS[onay] : ""
                  }" olacak. Geri alınan adımların zaman damgaları temizlenecek — gerçekleşen sevk tarihi de silinebilir.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction
              disabled={loading}
              onClick={(e) => {
                e.preventDefault();
                if (onay) void uygula(onay);
              }}
            >
              {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Devam et
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
