"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { MontajStatusBadge } from "./montaj-status-badge";
import { StepProgress } from "./step-progress";
import { MaterialCheckPanel, type BomItemWithStock } from "./material-check-panel";
import {
  getProductAssemblyData,
  startMontaj,
  advanceStep,
  completeMontaj,
  cancelMontaj,
} from "../actions";
import type { MontajStatus } from "@/lib/constants";
import { formatDate, formatTime, formatDuration, cn } from "@/lib/utils";
import {
  Play,
  CheckCircle,
  XCircle,
  ChevronRight,
  ArrowRight,
  Check,
  Clock,
  User,
} from "lucide-react";
import { toast } from "sonner";
import type { MontajBatchRow } from "./montaj-card";

interface MontajDetailSheetProps {
  batch: MontajBatchRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface StepData {
  step_id: string;
  sku: string | null;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean;
  bom_count: number;
}

export function MontajDetailSheet({ batch, open, onOpenChange }: MontajDetailSheetProps) {
  const [steps, setSteps] = useState<StepData[]>([]);
  const [bomItems, setBomItems] = useState<BomItemWithStock[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const durum = batch.durum as MontajStatus;

  useEffect(() => {
    if (open && batch.sku) {
      setLoading(true);
      getProductAssemblyData(batch.sku, batch.adet).then((res) => {
        if (res.success) {
          setSteps(res.data.steps);
          setBomItems(res.data.bomItems);
        }
        setLoading(false);
      });
    }
  }, [open, batch.sku, batch.adet]);

  const handleStart = async () => {
    setActionLoading(true);
    const result = await startMontaj(batch.montaj_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Montaj başlatıldı"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleAdvance = async () => {
    setActionLoading(true);
    const result = await advanceStep(batch.montaj_id);
    if (!result.success) toast.error(result.error);
    else toast.success("Sonraki adıma geçildi");
    setActionLoading(false);
  };

  const handleComplete = async () => {
    setActionLoading(true);
    const result = await completeMontaj(batch.montaj_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Montaj tamamlandı, stok güncellendi"); onOpenChange(false); }
    setActionLoading(false);
  };

  const handleCancel = async () => {
    setActionLoading(true);
    const result = await cancelMontaj(batch.montaj_id);
    if (!result.success) toast.error(result.error);
    else { toast.success("Montaj iptal edildi"); onOpenChange(false); }
    setActionLoading(false);
  };

  const isLastStep = batch.current_step_no >= batch.total_steps;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono">{batch.montaj_id}</Badge>
            <MontajStatusBadge durum={batch.durum} />
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Batch bilgileri */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground">Ürün</p>
              <p className="font-medium">{batch.urun_adi ?? batch.sku}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Adet</p>
              <p className="font-semibold text-lg">{batch.adet}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Operatör</p>
              <div className="flex items-center gap-1">
                <User className="w-3 h-3 text-muted-foreground" />
                <p className="font-medium">{batch.operator_name ?? batch.operator_id ?? "—"}</p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Oluşturma</p>
              <p className="font-medium">{formatDate(batch.created_at)}</p>
            </div>
            {batch.baslama_zamani && (
              <div>
                <p className="text-muted-foreground">Başlama</p>
                <p className="font-medium">{formatTime(batch.baslama_zamani)}</p>
              </div>
            )}
            {batch.bitis_zamani && (
              <div>
                <p className="text-muted-foreground">Süre</p>
                <p className="font-medium">{formatDuration(batch.baslama_zamani, batch.bitis_zamani)}</p>
              </div>
            )}
          </div>

          {batch.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground">Not</p>
              <p className="font-medium">{batch.notes}</p>
            </div>
          )}

          {/* Progress bar */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">İlerleme</span>
              <span className="font-medium">
                {batch.current_step_no}/{batch.total_steps} adım
              </span>
            </div>
            <StepProgress current={batch.current_step_no} total={batch.total_steps} />
          </div>

          <Separator />

          {/* Assembly Steps */}
          <div>
            <h3 className="font-semibold mb-3">Montaj Adımları</h3>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : steps.length === 0 ? (
              <p className="text-sm text-muted-foreground">Montaj adımı bulunamadı</p>
            ) : (
              <div className="space-y-2">
                {steps.map((step) => {
                  const stepNo = step.seq_no ?? 0;
                  const isCompleted = stepNo < batch.current_step_no;
                  const isCurrent = stepNo === batch.current_step_no;
                  const isPending = stepNo > batch.current_step_no;
                  const stepBom = bomItems.filter((b) => b.step_id === step.step_id);

                  return (
                    <div
                      key={step.step_id}
                      className={cn(
                        "rounded-lg border p-3 transition-all",
                        isCompleted && "bg-emerald-50/50 border-emerald-200",
                        isCurrent && "bg-blue-50/50 border-blue-300 ring-1 ring-blue-200",
                        isPending && "opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {/* Step icon */}
                        <div className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                          isCompleted && "bg-emerald-500 text-white",
                          isCurrent && "bg-blue-500 text-white",
                          isPending && "bg-muted text-muted-foreground"
                        )}>
                          {isCompleted ? <Check className="w-4 h-4" /> : stepNo}
                        </div>

                        {/* Step info */}
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "font-medium text-sm truncate",
                            isCompleted && "text-emerald-700",
                            isCurrent && "text-blue-700",
                            isPending && "text-muted-foreground"
                          )}>
                            {step.step_name ?? step.step_id}
                          </p>
                          {step.bom_count > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {step.bom_count} malzeme
                            </p>
                          )}
                        </div>

                        {/* Status */}
                        {isCompleted && (
                          <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                        )}
                        {isCurrent && durum === "montajda" && (
                          <Badge className="bg-blue-500 text-white text-xs shrink-0">Aktif</Badge>
                        )}
                      </div>

                      {/* BOM listesi — sadece aktif adım için */}
                      {isCurrent && durum === "montajda" && stepBom.length > 0 && (
                        <div className="mt-3">
                          <MaterialCheckPanel items={stepBom} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Aksiyon butonları */}
          <div className="flex gap-2 pb-4">
            {durum === "bekliyor" && (
              <Button
                className="flex-1 h-14 text-base bg-vw-success hover:bg-vw-success/90 text-white"
                onClick={handleStart}
                disabled={actionLoading}
              >
                <Play className="w-5 h-5 mr-2" />
                Montajı Başlat
              </Button>
            )}

            {durum === "montajda" && !isLastStep && (
              <>
                <Button
                  className="flex-1 h-14 text-base"
                  onClick={handleAdvance}
                  disabled={actionLoading}
                >
                  <ArrowRight className="w-5 h-5 mr-2" />
                  Sonraki Adım
                </Button>
                <Button
                  variant="outline"
                  className="h-14 px-4"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </>
            )}

            {durum === "montajda" && isLastStep && (
              <>
                <Button
                  className="flex-1 h-14 text-base bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleComplete}
                  disabled={actionLoading}
                >
                  <CheckCircle className="w-5 h-5 mr-2" />
                  Montajı Tamamla
                </Button>
                <Button
                  variant="outline"
                  className="h-14 px-4"
                  onClick={handleCancel}
                  disabled={actionLoading}
                >
                  <XCircle className="w-5 h-5" />
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
