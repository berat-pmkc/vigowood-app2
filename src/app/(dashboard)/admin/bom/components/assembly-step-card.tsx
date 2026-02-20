"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  GripVertical,
  ChevronDown,
  Pencil,
  Trash2,
  GitBranch,
  Package,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StepBomPanel } from "./step-bom-panel";
import { deleteStep, updateStep } from "../actions";
import { StepEditDialog } from "./step-edit-dialog";
import type { AssemblyStepFormData } from "@/lib/validations";

interface AssemblyStepWithBomCount {
  step_id: string;
  sku: string | null;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean;
  created_at: string;
  bom_count: number;
}

interface AssemblyStepCardProps {
  step: AssemblyStepWithBomCount;
  allParts: { part_id: string; part_adi: string | null; part_type: string | null }[];
  assemblySteps: { step_id: string; step_name: string | null }[];
  onDeleted: () => void;
  onUpdated: () => void;
}

export function AssemblyStepCard({
  step,
  allParts,
  assemblySteps,
  onDeleted,
  onUpdated,
}: AssemblyStepCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [bomCount, setBomCount] = useState(step.bom_count);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.step_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  async function handleDelete() {
    if (!confirm(`"${step.step_name}" adımını silmek istediğinize emin misiniz?`)) {
      return;
    }

    const result = await deleteStep(step.step_id);
    if (result.success) {
      toast.success("Adım silindi");
      onDeleted();
    } else {
      toast.error(result.error);
    }
  }

  async function handleEdit(data: AssemblyStepFormData) {
    setEditLoading(true);
    const result = await updateStep(step.step_id, data);
    if (result.success) {
      toast.success("Adım güncellendi");
      setEditOpen(false);
      onUpdated();
    } else {
      toast.error(result.error);
    }
    setEditLoading(false);
  }

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          ref={setNodeRef}
          style={style}
          className={cn(
            "border rounded-lg bg-card transition-shadow",
            isDragging && "shadow-lg opacity-80 z-50"
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            {/* Drag Handle */}
            <button
              className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4" />
            </button>

            {/* Seq No */}
            <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
              {step.seq_no}
            </span>

            {/* Step Name */}
            <span className="font-medium text-sm truncate flex-1">
              {step.step_name || "—"}
            </span>

            {/* Badges */}
            <div className="flex items-center gap-1.5 shrink-0">
              {step.is_final_step && (
                <Badge className="bg-vw-success/20 text-vw-success border-vw-success/30 text-[10px]">
                  Son Adım
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Package className="h-3 w-3" />
                {bomCount}
              </Badge>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 transition-transform",
                      isOpen && "rotate-180"
                    )}
                  />
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>

          {/* Collapsible BOM Panel */}
          <CollapsibleContent>
            <div className="border-t">
              <StepBomPanel
                stepId={step.step_id}
                sku={step.sku || ""}
                open={isOpen}
                allParts={allParts}
                assemblySteps={assemblySteps}
                onBomCountChange={setBomCount}
              />
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Edit Dialog */}
      <StepEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        defaultValues={{
          step_name: step.step_name || "",
          seq_no: step.seq_no || 1,
          is_final_step: step.is_final_step,
        }}
        nextSeqNo={step.seq_no || 1}
        onSubmit={handleEdit}
        loading={editLoading}
      />
    </>
  );
}
