"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileDown, ExternalLink, FileText } from "lucide-react";
import { OUTPUT_FILE_TYPE_LABELS, type OutputFileType } from "@/lib/constants";
import type { OpsOutput } from "../actions";
import { toast } from "sonner";
import { useState } from "react";

interface OutputViewerDialogProps {
  output: OpsOutput | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FILE_TYPE_BADGE_COLORS: Record<string, string> = {
  report: "bg-blue-50 text-blue-700 border-blue-200",
  export: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pdf: "bg-red-50 text-red-700 border-red-200",
  csv: "bg-green-50 text-green-700 border-green-200",
  image: "bg-purple-50 text-purple-700 border-purple-200",
  other: "bg-gray-50 text-gray-700 border-gray-200",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OutputViewerDialog({
  output,
  open,
  onOpenChange,
}: OutputViewerDialogProps) {
  const [pdfLoading, setPdfLoading] = useState(false);

  if (!output) return null;

  const fullContent = output.metadata?.full_content as string | undefined;
  const hasContent = !!fullContent;
  const displayTitle =
    output.description || output.file_name;

  const handlePdfDownload = async () => {
    setPdfLoading(true);
    try {
      const res = await fetch(`/api/ops/output/${output.id}/pdf`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "PDF oluşturulamadı" }));
        throw new Error(err.error || "PDF oluşturulamadı");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${output.file_name.replace(/\.[^.]+$/, "")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("PDF indirildi");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "PDF indirilemedi");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[85vh] flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold text-vw-dark leading-tight">
                {displayTitle}
              </DialogTitle>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  variant="outline"
                  className="font-mono text-[10px] px-1.5"
                >
                  {output.file_name}
                </Badge>
                <span
                  className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${
                    FILE_TYPE_BADGE_COLORS[output.file_type] ??
                    FILE_TYPE_BADGE_COLORS.other
                  }`}
                >
                  {OUTPUT_FILE_TYPE_LABELS[output.file_type as OutputFileType]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(output.created_at)}
                </span>
              </div>
              {output.agent_name && (
                <p className="text-xs text-muted-foreground mt-1">
                  Oluşturan: {output.agent_name}
                </p>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-6 py-4">
            {hasContent ? (
              <div className="prose prose-sm max-w-none break-words prose-headings:text-vw-dark prose-a:text-blue-600">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {fullContent}
                </ReactMarkdown>
              </div>
            ) : output.file_url ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="mb-3 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  Bu çıktının içeriği burada gösterilemiyor
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <a
                    href={output.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Dosyayı Aç
                  </a>
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="mb-3 h-12 w-12 text-muted-foreground/40" />
                <p className="text-sm font-medium text-muted-foreground">
                  İçerik bulunamadı
                </p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="px-6 py-3 border-t shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {hasContent && (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePdfDownload}
                disabled={pdfLoading}
              >
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                {pdfLoading ? "Oluşturuluyor..." : "PDF İndir"}
              </Button>
            )}
            {output.file_url && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={output.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                  Dosyayı Aç
                </a>
              </Button>
            )}
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onOpenChange(false)}
          >
            Kapat
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
