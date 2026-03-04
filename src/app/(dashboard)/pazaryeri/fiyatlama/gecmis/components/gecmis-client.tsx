"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Calendar, History, Store, Package, TrendingUp, TrendingDown, Trash2 } from "lucide-react";
import { karMarjiRenk } from "@/lib/pricingCalculator";
import type { SnapshotPeriodSummary } from "../../actions";
import { deleteSnapshotPeriod } from "../../actions";

interface Props {
  periods: SnapshotPeriodSummary[];
}

export function GecmisClient({ periods }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const handleDelete = (donemKodu: string) => {
    startTransition(async () => {
      const result = await deleteSnapshotPeriod(donemKodu);
      if (result.success) {
        toast.success(`"${donemKodu}" dönemi silindi`);
        router.refresh();
      } else {
        toast.error("Silme hatası: " + result.error);
      }
      setDeleteTarget(null);
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Fiyat Geçmişi</h1>
        <p className="text-sm text-muted-foreground">
          Dönem bazlı fiyat snapshot&apos;ları. Bir döneme tıklayarak detayları görüntüleyin.
        </p>
      </div>

      {periods.length === 0 ? (
        <div className="rounded-lg border bg-card p-12 text-center">
          <History className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 text-muted-foreground">
            Henüz fiyat snapshot&apos;ı alınmamış.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Fiyatlama Paneli&apos;nden &quot;Snapshot&quot; butonuyla dönem kaydı oluşturabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {periods.map((period) => {
            const marjColor = karMarjiRenk(period.avg_kar_marji);
            const isPositive = period.avg_kar_marji >= 0;

            return (
              <div key={period.donem_kodu} className="group relative">
                <Link
                  href={`/pazaryeri/fiyatlama/gecmis/${encodeURIComponent(period.donem_kodu)}`}
                  className="block rounded-lg border bg-card p-4 transition-all hover:border-primary/50 hover:shadow-md"
                >
                  {/* Period code */}
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-vw-dark">
                      {period.donem_kodu}
                    </span>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${marjColor}`}>
                      {isPositive ? (
                        <TrendingUp className="mr-1 inline h-3 w-3" />
                      ) : (
                        <TrendingDown className="mr-1 inline h-3 w-3" />
                      )}
                      %{(period.avg_kar_marji * 100).toFixed(1)}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Store className="h-3.5 w-3.5" />
                      <span>{period.marketplace_count} pazaryeri</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Package className="h-3.5 w-3.5" />
                      <span>{period.listing_count} listing</span>
                    </div>
                  </div>

                  {/* Date */}
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>
                      {new Date(period.created_at).toLocaleDateString("tr-TR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </Link>

                {/* Delete button */}
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.preventDefault();
                    setDeleteTarget(period.donem_kodu);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dönem Snapshot&apos;ını Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget}</strong> dönemine ait tüm snapshot verileri silinecek. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isPending}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
