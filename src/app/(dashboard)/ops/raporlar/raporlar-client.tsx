"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  Download,
  TableIcon,
  Image,
  File,
  Bot,
  Trash2,
  ExternalLink,
  Search,
  FileBarChart,
  Eye,
  FileDown,
} from "lucide-react";
import {
  OUTPUT_FILE_TYPES,
  OUTPUT_FILE_TYPE_LABELS,
  type OutputFileType,
} from "@/lib/constants";
import { deleteOutput, type OpsOutput, type OpsAgent } from "../actions";
import { OutputViewerDialog } from "./output-viewer-dialog";

interface RaporlarClientProps {
  outputs: OpsOutput[];
  agents: OpsAgent[];
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  report: <FileText className="h-4 w-4 text-blue-600" />,
  export: <Download className="h-4 w-4 text-emerald-600" />,
  pdf: <FileText className="h-4 w-4 text-red-600" />,
  csv: <TableIcon className="h-4 w-4 text-green-600" />,
  image: <Image className="h-4 w-4 text-purple-600" />,
  other: <File className="h-4 w-4 text-gray-600" />,
};

const FILE_TYPE_BADGE_COLORS: Record<string, string> = {
  report: "bg-blue-50 text-blue-700 border-blue-200",
  export: "bg-emerald-50 text-emerald-700 border-emerald-200",
  pdf: "bg-red-50 text-red-700 border-red-200",
  csv: "bg-green-50 text-green-700 border-green-200",
  image: "bg-purple-50 text-purple-700 border-purple-200",
  other: "bg-gray-50 text-gray-700 border-gray-200",
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function RaporlarClient({ outputs, agents }: RaporlarClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [selectedOutput, setSelectedOutput] = useState<OpsOutput | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const filtered = outputs.filter((o) => {
    if (search) {
      const q = search.toLowerCase();
      const matchName = o.file_name.toLowerCase().includes(q);
      const matchDesc = o.description?.toLowerCase().includes(q);
      const matchCreator = o.creator_name?.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchCreator) return false;
    }
    if (typeFilter !== "all" && o.file_type !== typeFilter) return false;
    if (agentFilter !== "all" && o.agent_id !== agentFilter) return false;
    return true;
  });

  const handleDelete = async (e: React.MouseEvent, id: string, fileName: string) => {
    e.stopPropagation();
    if (!confirm(`"${fileName}" dosyasını silmek istediğinize emin misiniz?`)) return;
    const result = await deleteOutput(id);
    if (result.success) {
      toast.success("Çıktı silindi");
      router.refresh();
    } else {
      toast.error(result.error || "Silme başarısız");
    }
  };

  const handleRowClick = (output: OpsOutput) => {
    setSelectedOutput(output);
    setViewerOpen(true);
  };

  const handlePdfDownload = async (e: React.MouseEvent, output: OpsOutput) => {
    e.stopPropagation();
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
    }
  };

  // Stats
  const totalSize = outputs.reduce((sum, o) => sum + (o.file_size ?? 0), 0);
  const typeCounts = outputs.reduce((acc, o) => {
    acc[o.file_type] = (acc[o.file_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Toplam Dosya</p>
          <p className="text-xl font-bold text-vw-dark">{outputs.length}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Toplam Boyut</p>
          <p className="text-xl font-bold text-vw-dark">{formatFileSize(totalSize)}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Rapor</p>
          <p className="text-xl font-bold text-blue-600">{typeCounts["report"] ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-white p-3">
          <p className="text-xs text-muted-foreground">Dışa Aktarım</p>
          <p className="text-xl font-bold text-emerald-600">
            {(typeCounts["export"] ?? 0) + (typeCounts["csv"] ?? 0)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Dosya ara..."
            className="h-8 w-[200px] pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[140px]">
            <SelectValue placeholder="Dosya Türü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Türler</SelectItem>
            {OUTPUT_FILE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {OUTPUT_FILE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="Kaynak" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Kaynaklar</SelectItem>
            {agents.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-xs">
          {filtered.length} sonuç
        </Badge>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <FileBarChart className="mb-3 h-12 w-12 text-muted-foreground/40" />
          <p className="text-sm font-medium text-muted-foreground">
            {outputs.length === 0
              ? "Henüz çıktı oluşturulmamış"
              : "Filtreye uygun dosya bulunamadı"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            Agent&apos;lar görev tamamladığında raporlar burada görünecek
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]"></TableHead>
                <TableHead>Açıklama</TableHead>
                <TableHead className="hidden sm:table-cell w-[140px]">Kod</TableHead>
                <TableHead className="hidden sm:table-cell">Tür</TableHead>
                <TableHead className="hidden md:table-cell">Oluşturan</TableHead>
                <TableHead className="hidden lg:table-cell">Tarih</TableHead>
                <TableHead className="w-[130px] text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((output) => {
                const hasContent = !!(output.metadata?.full_content);
                return (
                  <TableRow
                    key={output.id}
                    className="group cursor-pointer hover:bg-muted/50"
                    onClick={() => handleRowClick(output)}
                  >
                    <TableCell>
                      <div className="flex h-8 w-8 items-center justify-center rounded bg-muted/50">
                        {FILE_TYPE_ICONS[output.file_type] ?? FILE_TYPE_ICONS.other}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate max-w-[300px]">
                          {output.description || output.file_name}
                        </p>
                        {/* Mobile-only meta */}
                        <div className="flex flex-wrap gap-1.5 mt-1 sm:hidden">
                          <Badge variant="outline" className="font-mono text-[10px] px-1">
                            {output.file_name}
                          </Badge>
                          <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${FILE_TYPE_BADGE_COLORS[output.file_type] ?? FILE_TYPE_BADGE_COLORS.other}`}>
                            {OUTPUT_FILE_TYPE_LABELS[output.file_type as OutputFileType]}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="outline" className="font-mono text-[10px] px-1.5 max-w-[130px] truncate">
                        {output.file_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium ${FILE_TYPE_BADGE_COLORS[output.file_type] ?? FILE_TYPE_BADGE_COLORS.other}`}>
                        {OUTPUT_FILE_TYPE_LABELS[output.file_type as OutputFileType]}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {output.agent_name ? (
                          <>
                            <Bot className="h-3 w-3 shrink-0" />
                            <span className="truncate max-w-[120px]">{output.agent_name}</span>
                          </>
                        ) : (
                          <span className="truncate max-w-[120px]">{output.creator_name}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {formatDate(output.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(output);
                          }}
                          title="Görüntüle"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {hasContent && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => handlePdfDownload(e, output)}
                            title="PDF İndir"
                          >
                            <FileDown className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {output.file_url && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={(e) => e.stopPropagation()}
                            asChild
                          >
                            <a
                              href={output.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="İndir"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => handleDelete(e, output.id, output.file_name)}
                          title="Sil"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Output Viewer Dialog */}
      <OutputViewerDialog
        output={selectedOutput}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
      />
    </div>
  );
}
