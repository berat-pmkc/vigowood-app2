"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileSpreadsheet, AlertCircle, Calendar } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { saveAdSnapshot } from "../actions";
import { parseDateFromFilename, parseExcelRows } from "../parsers";
import type { ParsedAdRow } from "../parsers";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Read XLSX in browser using SheetJS (already in node_modules for build, but we use dynamic import for client)
async function parseExcelFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", raw: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false });

  if (data.length < 2) throw new Error("Excel dosyası boş veya geçersiz");

  const headers = data[0] as string[];
  const rows = data.slice(1).filter((r) => r[0] && String(r[0]).trim() !== "");
  return { headers, rows: rows as string[][] };
}

export function UploadDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [parsedDate, setParsedDate] = useState<string | null>(null);
  const [manualDate, setManualDate] = useState("");
  const [needsManualDate, setNeedsManualDate] = useState(false);
  const [previewRows, setPreviewRows] = useState<ParsedAdRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setParsedDate(null);
    setManualDate("");
    setNeedsManualDate(false);
    setPreviewRows([]);
    setHeaders([]);
    setRawRows([]);
    setSaving(false);
    setDragOver(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleFile = useCallback(async (f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls")) {
      toast.error("Sadece Excel dosyaları (.xlsx, .xls) desteklenir");
      return;
    }

    setFile(f);

    // Parse date from filename
    const date = parseDateFromFilename(f.name);
    if (date) {
      setParsedDate(date);
      setNeedsManualDate(false);
    } else {
      setParsedDate(null);
      setNeedsManualDate(true);
    }

    // Parse Excel
    try {
      const { headers: h, rows: r } = await parseExcelFile(f);
      setHeaders(h);
      setRawRows(r);
      const parsed = parseExcelRows(h, r);
      setPreviewRows(parsed);

      if (parsed.length === 0) {
        toast.error("Dosyada reklam verisi bulunamadı");
      }
    } catch (err) {
      toast.error(`Excel okuma hatası: ${(err as Error).message}`);
      setFile(null);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const finalDate = parsedDate || manualDate;

  const handleSave = useCallback(async () => {
    if (!finalDate) {
      toast.error("Tarih belirtilmedi");
      return;
    }
    if (previewRows.length === 0) {
      toast.error("Kaydedilecek veri yok");
      return;
    }

    setSaving(true);
    const result = await saveAdSnapshot(finalDate, previewRows);
    setSaving(false);

    if (result.success) {
      toast.success(
        `${result.snapshotCount} reklam kaydedildi, ${result.weeklyCount} haftalık metrik hesaplandı`
      );
      reset();
      onOpenChange(false);
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }, [finalDate, previewRows, reset, onOpenChange, router]);

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) reset();
      onOpenChange(isOpen);
    },
    [reset, onOpenChange]
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reklam Raporu Yükle</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        {!file ? (
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="mb-3 h-8 w-8 text-muted-foreground/50" />
            <p className="mb-1 text-sm font-medium">
              Excel dosyasını sürükleyip bırakın
            </p>
            <p className="mb-3 text-xs text-muted-foreground">
              veya dosya seçmek için tıklayın
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleInputChange}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              Dosya Seç
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
              <FileSpreadsheet className="h-8 w-8 text-emerald-600" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {previewRows.length} reklam bulundu
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={reset}
              >
                Değiştir
              </Button>
            </div>

            {/* Date */}
            {parsedDate ? (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-3 text-sm">
                <Calendar className="h-4 w-4 text-emerald-600" />
                <span>
                  Tarih dosya adından algılandı:{" "}
                  <strong>
                    {new Date(parsedDate + "T00:00:00").toLocaleDateString("tr-TR")}
                  </strong>
                </span>
              </div>
            ) : needsManualDate ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertCircle className="h-4 w-4" />
                  <span>Tarih dosya adından algılanamadı</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="manualDate" className="text-sm whitespace-nowrap">
                    Rapor Tarihi:
                  </Label>
                  <Input
                    id="manualDate"
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-auto"
                  />
                </div>
              </div>
            ) : null}

            {/* Preview table */}
            {previewRows.length > 0 && (
              <div className="max-h-[200px] overflow-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Reklam</th>
                      <th className="px-2 py-1 text-right">Harcama</th>
                      <th className="px-2 py-1 text-right">Ciro</th>
                      <th className="px-2 py-1 text-right">ROAS</th>
                      <th className="px-2 py-1 text-right">Satış</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((r) => (
                      <tr key={r.ad_name} className="border-t">
                        <td className="px-2 py-1 font-medium">{r.ad_name}</td>
                        <td className="px-2 py-1 text-right">
                          {r.spent.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
                        </td>
                        <td className="px-2 py-1 text-right">
                          {r.total_revenue.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
                        </td>
                        <td className="px-2 py-1 text-right">{r.cumulative_roas.toFixed(2)}x</td>
                        <td className="px-2 py-1 text-right">{r.total_sales}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={saving}>
            İptal
          </Button>
          <Button
            onClick={handleSave}
            disabled={!file || !finalDate || previewRows.length === 0 || saving}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
