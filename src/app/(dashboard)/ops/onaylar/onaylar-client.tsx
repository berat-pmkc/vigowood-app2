"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Bot,
  Clock,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  APPROVAL_ACTION_TYPE_LABELS,
  APPROVAL_ACTION_TYPES,
  APPROVAL_RISK_LEVEL_LABELS,
  APPROVAL_RISK_LEVEL_COLORS,
  APPROVAL_RISK_LEVELS,
  APPROVAL_STATUS_LABELS,
  APPROVAL_STATUS_COLORS,
  APPROVAL_STATUSES,
  type ApprovalActionType,
  type ApprovalRiskLevel,
  type ApprovalStatus,
} from "@/lib/constants";
import { reviewApproval, type OpsApproval } from "../actions";

interface OnaylarClientProps {
  approvals: OpsApproval[];
}

export function OnaylarClient({ approvals }: OnaylarClientProps) {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [reviewDialog, setReviewDialog] = useState<{
    id: string;
    decision: "approved" | "rejected" | "revision_requested";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = approvals.filter((a) => {
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    if (actionFilter !== "all" && a.action_type !== actionFilter) return false;
    if (riskFilter !== "all" && a.risk_level !== riskFilter) return false;
    return true;
  });

  const pendingCount = approvals.filter((a) => a.status === "pending").length;

  const handleReview = async () => {
    if (!reviewDialog) return;
    setSubmitting(true);
    const result = await reviewApproval(
      reviewDialog.id,
      reviewDialog.decision,
      reviewNote || undefined
    );
    setSubmitting(false);

    if (result.success) {
      const labels = {
        approved: "Onaylandı",
        rejected: "Reddedildi",
        revision_requested: "Revizyon istendi",
      };
      toast.success(labels[reviewDialog.decision]);
      setReviewDialog(null);
      setReviewNote("");
    } else {
      toast.error(result.error || "İşlem başarısız");
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
          {pendingCount} bekleyen
        </Badge>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-[130px]">
            <SelectValue placeholder="Durum" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Durumlar</SelectItem>
            {APPROVAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {APPROVAL_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="h-8 w-[160px]">
            <SelectValue placeholder="Aksiyon Türü" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Aksiyonlar</SelectItem>
            {APPROVAL_ACTION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {APPROVAL_ACTION_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="h-8 w-[120px]">
            <SelectValue placeholder="Risk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tüm Riskler</SelectItem>
            {APPROVAL_RISK_LEVELS.map((r) => (
              <SelectItem key={r} value={r}>
                {APPROVAL_RISK_LEVEL_LABELS[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              {statusFilter === "pending"
                ? "Bekleyen onay talebi yok"
                : "Sonuç bulunamadı"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((approval) => {
            const riskColors =
              APPROVAL_RISK_LEVEL_COLORS[approval.risk_level as ApprovalRiskLevel];
            const statusColors =
              APPROVAL_STATUS_COLORS[approval.status as ApprovalStatus];
            const isExpanded = expandedId === approval.id;
            const isPending = approval.status === "pending";

            return (
              <Card
                key={approval.id}
                className={`transition-shadow hover:shadow-md ${
                  isPending ? "border-l-4 border-l-amber-400" : ""
                }`}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    {/* Risk indicator */}
                    <div
                      className={`mt-1 flex h-8 w-8 items-center justify-center rounded-lg ${riskColors.bg}`}
                    >
                      <Shield className={`h-4 w-4 ${riskColors.text}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium truncate">
                          {approval.title}
                        </h3>
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColors.bg} ${statusColors.text}`}
                        >
                          {APPROVAL_STATUS_LABELS[approval.status as ApprovalStatus]}
                        </span>
                        <span
                          className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${riskColors.bg} ${riskColors.text}`}
                        >
                          {APPROVAL_RISK_LEVEL_LABELS[approval.risk_level as ApprovalRiskLevel]}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>
                          {APPROVAL_ACTION_TYPE_LABELS[approval.action_type as ApprovalActionType]}
                        </span>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          {approval.agent_name ? (
                            <>
                              <Bot className="h-3 w-3" />
                              {approval.agent_name}
                            </>
                          ) : (
                            approval.requester_name
                          )}
                        </span>
                        <span>&middot;</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(approval.requested_at)}
                        </span>
                      </div>

                      {approval.description && (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                          {approval.description}
                        </p>
                      )}

                      {/* Expandable payload */}
                      {(Object.keys(approval.payload).length > 0 ||
                        Object.keys(approval.old_payload).length > 0) && (
                        <button
                          onClick={() =>
                            setExpandedId(isExpanded ? null : approval.id)
                          }
                          className="mt-2 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700"
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3 w-3" />
                          )}
                          {isExpanded ? "Detayları gizle" : "Detayları göster"}
                        </button>
                      )}

                      {isExpanded && (
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          {Object.keys(approval.old_payload).length > 0 && (
                            <div className="rounded-md border bg-red-50/50 p-2">
                              <p className="text-[10px] font-medium text-red-600 mb-1">
                                Mevcut Durum
                              </p>
                              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                                {JSON.stringify(approval.old_payload, null, 2)}
                              </pre>
                            </div>
                          )}
                          {Object.keys(approval.payload).length > 0 && (
                            <div className="rounded-md border bg-emerald-50/50 p-2">
                              <p className="text-[10px] font-medium text-emerald-600 mb-1">
                                Önerilen Değişiklik
                              </p>
                              <pre className="text-[10px] text-muted-foreground whitespace-pre-wrap">
                                {JSON.stringify(approval.payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Review note */}
                      {approval.review_note && (
                        <div className="mt-2 rounded-md bg-muted/50 p-2">
                          <p className="text-[10px] font-medium text-muted-foreground mb-0.5">
                            Değerlendirme notu:
                          </p>
                          <p className="text-xs">{approval.review_note}</p>
                          {approval.reviewer_name && (
                            <p className="text-[10px] text-muted-foreground mt-1">
                              — {approval.reviewer_name},{" "}
                              {approval.reviewed_at && formatDate(approval.reviewed_at)}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Actions (only for pending) */}
                    {isPending && (
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          size="sm"
                          className="bg-emerald-600 text-white hover:bg-emerald-700"
                          onClick={() =>
                            setReviewDialog({
                              id: approval.id,
                              decision: "approved",
                            })
                          }
                        >
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Onayla
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-purple-600 hover:bg-purple-50"
                          onClick={() =>
                            setReviewDialog({
                              id: approval.id,
                              decision: "revision_requested",
                            })
                          }
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Revizyon
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() =>
                            setReviewDialog({
                              id: approval.id,
                              decision: "rejected",
                            })
                          }
                        >
                          <XCircle className="mr-1 h-3 w-3" />
                          Reddet
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog
        open={!!reviewDialog}
        onOpenChange={(o) => {
          if (!o) {
            setReviewDialog(null);
            setReviewNote("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {reviewDialog?.decision === "approved"
                ? "Onay Ver"
                : reviewDialog?.decision === "rejected"
                ? "Reddet"
                : "Revizyon İste"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              placeholder="Not ekle (isteğe bağlı)"
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReviewDialog(null);
                setReviewNote("");
              }}
              disabled={submitting}
            >
              İptal
            </Button>
            <Button
              onClick={handleReview}
              disabled={submitting}
              className={
                reviewDialog?.decision === "approved"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : reviewDialog?.decision === "rejected"
                  ? "bg-red-600 text-white hover:bg-red-700"
                  : "bg-purple-600 text-white hover:bg-purple-700"
              }
            >
              {submitting
                ? "İşleniyor..."
                : reviewDialog?.decision === "approved"
                ? "Onayla"
                : reviewDialog?.decision === "rejected"
                ? "Reddet"
                : "Revizyon İste"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
