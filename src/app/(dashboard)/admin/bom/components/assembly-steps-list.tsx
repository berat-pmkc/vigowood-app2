"use client";

import { useState, useRef } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { AssemblyStepCard } from "./assembly-step-card";
import { reorderSteps } from "../actions";

interface AssemblyStepWithBomCount {
  step_id: string;
  sku: string | null;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean;
  created_at: string;
  bom_count: number;
}

interface AssemblyStepsListProps {
  steps: AssemblyStepWithBomCount[];
  sku: string;
  allParts: { part_id: string; part_adi: string | null; part_type: string | null }[];
  onRefresh: () => void;
}

export function AssemblyStepsList({
  steps: initialSteps,
  sku,
  allParts,
  onRefresh,
}: AssemblyStepsListProps) {
  const [steps, setSteps] = useState(initialSteps);
  const prevInitialRef = useRef(initialSteps);

  // Update local state when server data changes (after router.refresh)
  if (prevInitialRef.current !== initialSteps) {
    prevInitialRef.current = initialSteps;
    setSteps(initialSteps);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.step_id === active.id);
    const newIndex = steps.findIndex((s) => s.step_id === over.id);

    // Optimistic update
    const newSteps = arrayMove(steps, oldIndex, newIndex);
    setSteps(newSteps);

    // Save to DB
    const orderedIds = newSteps.map((s) => s.step_id);
    const result = await reorderSteps(sku, orderedIds);

    if (result.success) {
      toast.success("Sıralama güncellendi");
    } else {
      // Revert
      setSteps(steps);
      toast.error(result.error);
    }
  }

  // Assembly steps for BOM combobox (all steps of this SKU)
  const assemblyStepOptions = steps.map((s) => ({
    step_id: s.step_id,
    step_name: s.step_name,
  }));

  if (steps.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Bu ürün için henüz montaj adımı bulunmuyor.</p>
        <p className="text-xs mt-1">Yukarıdaki "Yeni Adım Ekle" butonuyla başlayın.</p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={steps.map((s) => s.step_id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {steps.map((step) => (
            <AssemblyStepCard
              key={step.step_id}
              step={step}
              allParts={allParts}
              assemblySteps={assemblyStepOptions}
              onDeleted={onRefresh}
              onUpdated={onRefresh}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
