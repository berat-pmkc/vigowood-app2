"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, AlertTriangle, CheckCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { uploadSalesExcel } from "../actions";

export function ExcelUpload() {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [raporTarihi, setRaporTarihi] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [loading, setLoading] = useState(false);
  // Güncel satış → stoktan düş. Geçmiş/kayıt yüklemesi → düşme.
  const [stokDus, setStokDus] = useState(true);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    error: string;
    duplicates: { fatura_no: string; rapor_id: string }[];
  } | null>(null);

  async function handleUpload(forceOverwrite = false) {
    if (!file) return;

    setLoading(true);
    setDuplicateWarning(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("rapor_tarihi", raporTarihi);
      if (forceOverwrite) formData.append("force_overwrite", "true");
      if (!stokDus) formData.append("stok_dus", "false");

      const result = await uploadSalesExcel(formData);

      if (result.success) {
        toast.success("Rapor başarıyla yüklendi", {
          description: `${result.satirSayisi} satır işlendi. Rapor ID: ${result.raporId}`,
        });
        setOpen(false);
        setFile(null);
        setDuplicateWarning(null);
      } else if (result.duplicates && result.duplicates.length > 0) {
        setDuplicateWarning({
          error: result.error,
          duplicates: result.duplicates,
        });
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("Yükleme sırasında bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setDuplicateWarning(null);
          setFile(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Upload className="h-4 w-4" />
          Excel Yükle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Satış Excel Yükle</DialogTitle>
          <DialogDescription>
            DIA muhasebe programından export edilen .xls/.xlsx dosyasını
            yükleyin.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rapor_tarihi">Rapor Tarihi</Label>
            <Input
              id="rapor_tarihi"
              type="date"
              value={raporTarihi}
              onChange={(e) => setRaporTarihi(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="excel_file">Excel Dosyası</Label>
            <Input
              id="excel_file"
              type="file"
              accept=".xls,.xlsx"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                {file.name} ({(file.size / 1024).toFixed(0)} KB)
              </p>
            )}
          </div>

          {/* Stoktan düş / geçmiş kayıt seçeneği */}
          <label className="flex items-start gap-2 rounded-lg border p-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={stokDus}
              onChange={(e) => setStokDus(e.target.checked)}
            />
            <span className="text-sm">
              Stoktan düş
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Güncel satış yüklüyorsan işaretli kalsın. <b>Geçmiş ayın satışını
                kayıt için</b> yüklüyorsan işareti kaldır — mevcut stok etkilenmez.
              </span>
            </span>
          </label>

          {duplicateWarning && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-destructive" />
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">
                    Mükerrer Fatura Uyarısı
                  </p>
                  <p className="text-sm text-destructive/90">
                    {duplicateWarning.error}
                  </p>
                  <p className="text-xs text-destructive/70">
                    Etkilenen raporlar:{" "}
                    {[
                      ...new Set(
                        duplicateWarning.duplicates.map((d) => d.rapor_id),
                      ),
                    ].join(", ")}
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleUpload(true)}
                    disabled={loading}
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <AlertTriangle className="mr-2 h-4 w-4" />
                    )}
                    Eski Raporu Sil ve Yenisini Yükle
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            İptal
          </Button>
          <Button
            onClick={() => handleUpload(false)}
            disabled={!file || loading}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Yükle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
