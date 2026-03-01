"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ListTodo, Clock, ExternalLink } from "lucide-react";
import { getAgentTasks, type AgentTaskItem } from "../../../actions";

interface TasksPanelProps {
  agentCode: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  queue: { label: "Sırada", className: "bg-amber-100 text-amber-800" },
  scheduled: { label: "Planlandı", className: "bg-slate-100 text-slate-800" },
  in_progress: { label: "Devam Ediyor", className: "bg-blue-100 text-blue-800" },
  done: { label: "Tamamlandı", className: "bg-emerald-100 text-emerald-800" },
};

export function TasksPanel({ agentCode }: TasksPanelProps) {
  const [tasks, setTasks] = useState<AgentTaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAgentTasks(agentCode).then((data) => {
      setTasks(data);
      setLoading(false);
    });
  }, [agentCode]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}dk`;
    if (hours < 24) return `${hours.toFixed(1)}sa`;
    return `${(hours / 24).toFixed(1)}gün`;
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">Henüz atanmış görev yok</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {tasks.map((task) => {
        const statusInfo = STATUS_BADGE[task.status] ?? STATUS_BADGE.queue;
        return (
          <Card key={task.id} className="hover:shadow-sm transition-shadow">
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/ops/board?task=${task.id}`}
                      className="text-sm font-medium text-vw-dark hover:underline truncate"
                    >
                      {task.title}
                    </Link>
                    <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                    <span>{formatDate(task.created_at)}</span>
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      {formatDuration(task.duration_hours)}
                    </span>
                  </div>
                </div>
                <Badge className={`${statusInfo.className} text-[10px] shrink-0`}>
                  {statusInfo.label}
                </Badge>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
