"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Trash2, Database } from "lucide-react";
import { getAgentMemories, deleteAgentMemory, type AgentMemoryItem } from "../../../actions";

interface MemoryPanelProps {
  agentCode: string;
}

export function MemoryPanel({ agentCode }: MemoryPanelProps) {
  const [memories, setMemories] = useState<AgentMemoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getAgentMemories(agentCode).then((data) => {
      setMemories(data);
      setLoading(false);
    });
  }, [agentCode]);

  const handleDelete = (memoryId: string) => {
    startTransition(async () => {
      const result = await deleteAgentMemory(memoryId);
      if (result.success) {
        setMemories((prev) => prev.filter((m) => m.id !== memoryId));
        toast.success("Hafıza kaydı silindi");
      } else {
        toast.error(result.error || "Silinemedi");
      }
    });
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatValue = (value: Record<string, unknown>): string => {
    if (typeof value === "string") return value;
    const str = JSON.stringify(value, null, 2);
    return str.length > 200 ? str.slice(0, 200) + "..." : str;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Brain className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Henüz hafıza kaydı yok</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Database className="h-4 w-4" />
        <span>{memories.length} hafıza kaydı</span>
      </div>

      {memories.map((memory) => (
        <Card key={memory.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <CardTitle className="text-sm font-semibold truncate">
                  {memory.key}
                </CardTitle>
                <Badge variant="outline" className="text-[10px] shrink-0">
                  {memory.memory_type}
                </Badge>
                {memory.confidence > 0 && (
                  <Badge variant="secondary" className="text-[10px] shrink-0">
                    %{Math.round(memory.confidence * 100)}
                  </Badge>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => handleDelete(memory.id)}
                disabled={isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap break-words">
              {formatValue(memory.value)}
            </pre>
            {memory.context && (
              <p className="text-[11px] text-muted-foreground mt-2">
                Bağlam: {memory.context}
              </p>
            )}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              <span>{formatDate(memory.created_at)}</span>
              {memory.source && <span>Kaynak: {memory.source}</span>}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
