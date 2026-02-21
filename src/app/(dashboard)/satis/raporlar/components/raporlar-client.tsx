"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FileText, Trash2, Download, Loader2 } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { deleteReport } from "../../actions";

interface Rapor {
  id: string;
  rapor_id: string;
  rapor_tarihi: string;
  yukleme_tarihi: string;
  yukleyen_adi: string | null;
  dosya_adi: string | null;
  toplam_satir: number;
  toplam_adet: number;
  toplam_tutar: number;
  tr_tutar: number;
  ihracat_tutar: number;
  durum: string;
}

export function RaporlarClient({ raporlar }: { raporlar: Rapor[] }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState<string | null>(null);

  async function handleDelete(raporId: string) {
    setDeleting(raporId);
    try {
      const result = await deleteReport(raporId);
      if (result.success) {
        toast.success("Rapor başarıyla silindi", {
          description: "Stok düzeltmeleri uygulandı.",
        });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Silme işlemi sırasında hata oluştu");
    } finally {
      setDeleting(null);
    }
  }

  async function handlePdf(raporId: string) {
    setPdfLoading(raporId);
    try {
      const response = await fetch(`/api/satis/rapor/${raporId}`);
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        toast.error(errData?.error || "PDF oluşturulamadı");
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `satis-rapor-${raporId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("PDF indirme sırasında hata oluştu");
    } finally {
      setPdfLoading(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Satış Raporları
        </h1>
        <p className="text-sm text-muted-foreground">
          Yüklenen günlük satış raporları
        </p>
      </div>

      {raporlar.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">
            Henüz rapor yüklenmemiş.
          </p>
          <p className="text-sm text-muted-foreground">
            Satışlar sayfasından Excel yükleyerek rapor
            oluşturabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rapor ID</TableHead>
                <TableHead>Rapor Tarihi</TableHead>
                <TableHead>Dosya</TableHead>
                <TableHead className="text-right">Satır</TableHead>
                <TableHead className="text-right">Adet</TableHead>
                <TableHead className="text-right">Toplam</TableHead>
                <TableHead className="text-right">TR</TableHead>
                <TableHead className="text-right">İhracat</TableHead>
                <TableHead>Yükleyen</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {raporlar.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">
                    {r.rapor_id}
                  </TableCell>
                  <TableCell>{formatDate(r.rapor_tarihi)}</TableCell>
                  <TableCell className="max-w-[150px] truncate text-xs">
                    {r.dosya_adi}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.toplam_satir)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatNumber(r.toplam_adet)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ₺{formatNumber(Math.round(r.toplam_tutar))}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    ₺{formatNumber(Math.round(r.tr_tutar))}
                  </TableCell>
                  <TableCell className="text-right text-xs">
                    ₺{formatNumber(Math.round(r.ihracat_tutar))}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.yukleyen_adi || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handlePdf(r.rapor_id)}
                        disabled={pdfLoading === r.rapor_id}
                        title="PDF İndir"
                      >
                        {pdfLoading === r.rapor_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={deleting === r.rapor_id}
                            title="Raporu Sil"
                          >
                            {deleting === r.rapor_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Raporu Sil
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{r.rapor_id}</strong> raporunu
                              silmek istediğinize emin misiniz? Bu
                              işlem rapordaki tüm satış satırlarını
                              silecek ve stokları geri yükleyecektir.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                handleDelete(r.rapor_id)
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Sil
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
