"use client";

import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Upload, FileSpreadsheet } from "lucide-react";
import { parseExcelFile } from "@/lib/excel-utils";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  onConfirm: (rows: Record<string, string>[]) => Promise<void>;
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
}: ExcelImportDialogProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setFileName(file.name);

    try {
      const result = await parseExcelFile(file);
      setHeaders(result.headers);
      setRows(result.rows);
    } catch {
      setHeaders([]);
      setRows([]);
    }
    setLoading(false);
  };

  const handleConfirm = async () => {
    setImporting(true);
    try {
      await onConfirm(rows);
    } finally {
      setImporting(false);
      handleReset();
      onOpenChange(false);
    }
  };

  const handleReset = () => {
    setHeaders([]);
    setRows([]);
    setFileName("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const previewRows = rows.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleReset(); onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div className="flex items-center gap-3">
            <Input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="flex-1"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          </div>

          {/* File info */}
          {fileName && rows.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>
                {fileName} — {rows.length} satır, {headers.length} kolon
              </span>
            </div>
          )}

          {/* Preview table */}
          {previewRows.length > 0 && (
            <div className="border rounded-md overflow-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, i) => (
                    <tr key={i} className="border-b last:border-0">
                      {headers.map((h) => (
                        <td
                          key={h}
                          className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate"
                        >
                          {row[h] || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 5 && (
                <p className="px-2 py-1 text-xs text-muted-foreground border-t">
                  ... ve {rows.length - 5} satır daha
                </p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => { handleReset(); onOpenChange(false); }}
            disabled={importing}
          >
            İptal
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={rows.length === 0 || importing}
          >
            {importing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Yükleniyor...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                {rows.length} Satır Yükle
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
