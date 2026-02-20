"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, List, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductSelector } from "./product-selector";
import { AssemblyStepsList } from "./assembly-steps-list";
import { StepEditDialog } from "./step-edit-dialog";
import { RecipeTreeView } from "./recipe-tree-view";
import { createStep } from "../actions";
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

interface BomPageClientProps {
  products: { sku: string; urun_adi: string | null; kategori: string | null }[];
  steps: AssemblyStepWithBomCount[];
  selectedSku: string;
  allParts: { part_id: string; part_adi: string | null; part_type: string | null }[];
}

export function BomPageClient({
  products,
  steps,
  selectedSku,
  allParts,
}: BomPageClientProps) {
  const router = useRouter();
  const [view, setView] = useState<"steps" | "tree">("steps");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  function handleSkuSelect(sku: string) {
    if (sku) {
      router.push(`/admin/bom?sku=${sku}`);
    } else {
      router.push("/admin/bom");
    }
  }

  function handleRefresh() {
    router.refresh();
  }

  async function handleCreateStep(data: AssemblyStepFormData) {
    if (!selectedSku) return;
    setCreateLoading(true);
    const result = await createStep(selectedSku, data);
    if (result.success) {
      toast.success("Adım oluşturuldu");
      setCreateDialogOpen(false);
      handleRefresh();
    } else {
      toast.error(result.error);
    }
    setCreateLoading(false);
  }

  const nextSeqNo =
    steps.length > 0
      ? Math.max(...steps.map((s) => s.seq_no || 0)) + 1
      : 1;

  return (
    <div className="space-y-4">
      {/* Top Bar: Product Selector + Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ProductSelector
          products={products}
          selectedSku={selectedSku}
          onSelect={handleSkuSelect}
        />

        {selectedSku && (
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex rounded-md border">
              <Button
                variant={view === "steps" ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none h-8"
                onClick={() => setView("steps")}
              >
                <List className="h-3.5 w-3.5 mr-1.5" />
                Adımlar
              </Button>
              <Button
                variant={view === "tree" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none h-8"
                onClick={() => setView("tree")}
              >
                <GitBranch className="h-3.5 w-3.5 mr-1.5" />
                Reçete Ağacı
              </Button>
            </div>

            {view === "steps" && (
              <Button
                size="sm"
                className="h-8"
                onClick={() => setCreateDialogOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Yeni Adım
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {!selectedSku ? (
        <div className="text-center py-16 text-muted-foreground">
          <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            Montaj adımlarını görüntülemek için bir ürün seçin
          </p>
        </div>
      ) : view === "steps" ? (
        <AssemblyStepsList
          steps={steps}
          sku={selectedSku}
          allParts={allParts}
          onRefresh={handleRefresh}
        />
      ) : (
        <RecipeTreeView sku={selectedSku} />
      )}

      {/* Create Dialog */}
      <StepEditDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        nextSeqNo={nextSeqNo}
        onSubmit={handleCreateStep}
        loading={createLoading}
      />
    </div>
  );
}
