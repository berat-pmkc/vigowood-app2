"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, Clock, CheckCircle, AlertTriangle, Send } from "lucide-react";
import { toast } from "sonner";
import { SyncStatus } from "../../components/sync-status";
import type { TrendyolQuestion, TrendyolQuestionStatus } from "@/lib/trendyol/types";
import {
  QUESTION_STATUS_LABELS,
  QUESTION_STATUS_COLORS,
  formatTrendyolDate,
} from "@/lib/trendyol/helpers";
import { answerQuestion } from "../actions";

interface Props {
  questions: TrendyolQuestion[];
  totalElements: number;
  currentPage: number;
  currentStatus: string;
  lastSyncAt: string | null;
}

const STATUS_TABS: { label: string; status: string; icon: React.ElementType }[] = [
  { label: "Tümü", status: "all", icon: MessageSquare },
  { label: "Cevap Bekliyor", status: "WAITING_FOR_ANSWER", icon: Clock },
  { label: "Cevaplandı", status: "ANSWERED", icon: CheckCircle },
  { label: "Reddedildi", status: "REJECTED", icon: AlertTriangle },
];

export function SorularClient({
  questions,
  totalElements,
  currentPage,
  currentStatus,
  lastSyncAt,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [answerTexts, setAnswerTexts] = useState<Record<number, string>>({});
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value && value !== "all") {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    router.push(`/pazaryeri/trendyol/sorular?${params.toString()}`);
  }

  async function handleAnswer(questionId: number) {
    const text = answerTexts[questionId];
    if (!text || text.trim().length < 10) {
      toast.error("Cevap en az 10 karakter olmalıdır");
      return;
    }

    setLoadingIds((prev) => new Set(prev).add(questionId));

    const result = await answerQuestion(questionId, text);

    setLoadingIds((prev) => {
      const next = new Set(prev);
      next.delete(questionId);
      return next;
    });

    if (result.success) {
      toast.success("Cevap gönderildi");
      setAnswerTexts((prev) => {
        const next = { ...prev };
        delete next[questionId];
        return next;
      });
      router.refresh();
    } else {
      toast.error(result.error);
    }
  }

  const waitingCount = questions.filter((q) => q.status === "WAITING_FOR_ANSWER").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-vw-dark">Müşteri Soruları</h1>
          <p className="text-sm text-muted-foreground">
            {totalElements} soru {waitingCount > 0 && `(${waitingCount} cevap bekliyor)`}
          </p>
        </div>
        <SyncStatus lastSyncAt={lastSyncAt} entityType="questions" />
      </div>

      {/* Status Tabs */}
      <div className="flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.status}
            variant={currentStatus === tab.status ? "default" : "outline"}
            size="sm"
            onClick={() => updateParams({ status: tab.status, page: "0" })}
            className="gap-1.5"
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Questions List */}
      <div className="space-y-3">
        {questions.length === 0 ? (
          <Card>
            <CardContent className="flex h-24 items-center justify-center text-muted-foreground">
              Soru bulunamadı.
            </CardContent>
          </Card>
        ) : (
          questions.map((q) => {
            const statusColors = QUESTION_STATUS_COLORS[q.status as TrendyolQuestionStatus] || {
              bg: "bg-gray-100",
              text: "text-gray-800",
            };
            const isWaiting = q.status === "WAITING_FOR_ANSWER";
            const isRejected = q.status === "REJECTED";

            return (
              <Card key={q.id} className={isWaiting ? "border-l-4 border-l-amber-400" : ""}>
                <CardContent className="space-y-3 p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {q.productName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {q.userName && `${q.userName} · `}
                        {formatTrendyolDate(q.creationDate)}
                      </p>
                    </div>
                    <Badge className={`${statusColors.bg} ${statusColors.text} hover:${statusColors.bg}`}>
                      {QUESTION_STATUS_LABELS[q.status as TrendyolQuestionStatus] || q.status}
                    </Badge>
                  </div>

                  {/* Question Text */}
                  <div className="rounded-md bg-muted/50 p-3">
                    <p className="text-sm">{q.text}</p>
                  </div>

                  {/* Existing Answer */}
                  {q.answer && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50/50 p-3">
                      <p className="mb-1 text-xs font-medium text-emerald-700">Cevabınız:</p>
                      <p className="text-sm">{q.answer.text}</p>
                    </div>
                  )}

                  {/* Rejected Answer */}
                  {isRejected && q.rejectedAnswer && (
                    <div className="rounded-md border border-red-200 bg-red-50/50 p-3">
                      <p className="mb-1 text-xs font-medium text-red-700">
                        Reddedilen Cevap:
                      </p>
                      <p className="text-sm">{q.rejectedAnswer.text}</p>
                      {q.rejectedAnswer.reason && (
                        <p className="mt-1 text-xs text-red-600">
                          Sebep: {q.rejectedAnswer.reason}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Answer Form */}
                  {(isWaiting || isRejected) && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Cevabınızı yazın (10-2000 karakter)..."
                        rows={3}
                        value={answerTexts[q.id] || ""}
                        onChange={(e) =>
                          setAnswerTexts((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {(answerTexts[q.id] || "").length}/2000
                        </span>
                        <Button
                          size="sm"
                          onClick={() => handleAnswer(q.id)}
                          disabled={loadingIds.has(q.id)}
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          {loadingIds.has(q.id) ? "Gönderiliyor..." : "Cevap Gönder"}
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Pagination */}
      {totalElements > 50 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => updateParams({ page: String(currentPage - 1) })}
          >
            Önceki
          </Button>
          <span className="text-sm text-muted-foreground">
            Sayfa {currentPage + 1} / {Math.ceil(totalElements / 50)}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={questions.length < 50}
            onClick={() => updateParams({ page: String(currentPage + 1) })}
          >
            Sonraki
          </Button>
        </div>
      )}
    </div>
  );
}
