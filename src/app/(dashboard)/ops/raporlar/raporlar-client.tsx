"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Download,
  Table,
  Image,
  File,
  Bot,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  OUTPUT_FILE_TYPES,
  OUTPUT_FILE_TYPE_LABELS,
  type OutputFileType,
} from "@/lib/constants";
import { deleteOutput, type OpsOutput, type OpsAgent } from "../actions";

interface RaporlarClientProps {
  outputs: OpsOutput[];
  agents: OpsAgent[];
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  report: <FileText className="h-5 w-5 text-blue-600" />,
  export: <Download className="h-5 w-5 text-emerald-600" />,
  pdf: <FileText className="h-5 w-5 text-red-600" />,
  csv: <Table className="h-5 w-5 text-green-600" />,
  image: <Image className="h-5 w-5 text-purple-600" />,
  other: <File className="h-5 w-5 text-gray-600" />,
};

function formatFileSize(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RaporlarClient({ outputs, agents }: RaporlarClientProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const filtered = outputs.filter((o) => {
    if (typeFilter !== "all" && o.file_type !== typeFilter) return false;
    if (agentFilter !== "all" && o.agent_id !== agentFilter) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    const result = await deleteOutput(id);
    if (result.success) {
      toast.success("Çıktı silindi");
    } else {
      toast.error(result.error || "Silme başarısız");
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <>
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-sm font-normal">
          {filtered.length} dosya
        </Badge>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="h-8 w-[130px]">
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
          <SelectTrigger className="h-8 w-[140px]">
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
      </div>

      {/* Outputs List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              Henüz çıktı oluşturulmamış
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((output) => (
            <Card
              key={output.id}
              className="transition-shadow hover:shadow-md"
            >
              <CardContent className="flex items-center gap-4 p-4">
                {/* Icon */}
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50 shrink-0">
                  {FILE_TYPE_ICONS[output.file_type] ?? FILE_TYPE_ICONS.other}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium truncate">
                    {output.file_name}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">
                      {OUTPUT_FILE_TYPE_LABELS[output.file_type as OutputFileType]}
                    </Badge>
                    <span>{formatFileSize(output.file_size)}</span>
                    <span>&middot;</span>
                    {output.agent_name ? (
                      <span className="flex items-center gap-1">
                        <Bot className="h-3 w-3" />
                        {output.agent_name}
                      </span>
                    ) : (
                      <span>{output.creator_name}</span>
                    )}
                    <span>&middot;</span>
                    <span>{formatDate(output.created_at)}</span>
                  </div>
                  {output.description && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {output.description}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    asChild
                  >
                    <a
                      href={output.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Aç
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(output.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
