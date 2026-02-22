"use client";

import { useState, useTransition, lazy, Suspense } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, List, GitBranch, Download, Workflow, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProductSelector } from "./product-selector";
import { AssemblyStepsList } from "./assembly-steps-list";
import { StepEditDialog } from "./step-edit-dialog";
import { RecipeTreeView } from "./recipe-tree-view";
import { createStep, exportBomData } from "../actions";
import { exportToExcel, type ExcelColumn } from "@/lib/excel-utils";
import type { AssemblyStepFormData } from "@/lib/validations";

const AssemblyFlowDiagram = lazy(() =>
  import("./assembly-flow-diagram").then((m) => ({
    default: m.AssemblyFlowDiagram,
  }))
);

const BOM_EXPORT_COLUMNS: ExcelColumn[] = [
  { key: "step_id", header: "Adım ID", width: 15 },
  { key: "step_name", header: "Adım Adı", width: 30 },
  { key: "seq_no", header: "Sıra No", width: 10 },
  { key: "step_bom_id", header: "BOM ID", width: 15 },
  { key: "part_id", header: "Parça ID", width: 20 },
  { key: "part_name", header: "Parça Adı", width: 30 },
  { key: "qty_per", header: "Miktar", width: 10 },
];

type ViewMode = "steps" | "tree" | "flow";

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
  const [view, setView] = useState<ViewMode>("steps");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [, startExportTransition] = useTransition();

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

  // Assembly steps for combobox in tree/flow views
  const assemblyStepOptions = steps.map((s) => ({
    step_id: s.step_id,
    step_name: s.step_name,
  }));

  function handleExport() {
    if (!selectedSku) return;
    startExportTransition(async () => {
      const result = await exportBomData(selectedSku);
      if (result.success) {
        exportToExcel(
          result.data as unknown as Record<string, unknown>[],
          BOM_EXPORT_COLUMNS,
          `vigowood-bom-${selectedSku}`
        );
        toast.success(`${result.data.length} BOM satırı dışa aktarıldı`);
      } else {
        toast.error(result.error);
      }
    });
  }

  const VIEW_BUTTONS: { key: ViewMode; label: string; icon: typeof List }[] = [
    { key: "steps", label: "Adımlar", icon: List },
    { key: "tree", label: "Reçete Ağacı", icon: GitBranch },
    { key: "flow", label: "Akış Diyagramı", icon: Workflow },
  ];

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
            {/* View Toggle — 3 buttons */}
            <div className="flex rounded-md border">
              {VIEW_BUTTONS.map((btn, idx) => (
                <Button
                  key={btn.key}
                  variant={view === btn.key ? "default" : "ghost"}
                  size="sm"
                  className={`h-8 ${
                    idx === 0
                      ? "rounded-r-none"
                      : idx === VIEW_BUTTONS.length - 1
                        ? "rounded-l-none"
                        : "rounded-none"
                  }`}
                  onClick={() => setView(btn.key)}
                >
                  <btn.icon className="h-3.5 w-3.5 mr-1.5" />
                  <span className="hidden sm:inline">{btn.label}</span>
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={handleExport}
              title="Excel'e Aktar"
            >
              <Download className="h-3.5 w-3.5" />
            </Button>

            <Button
              size="sm"
              className="h-8"
              onClick={() => {
                if (view !== "steps") setView("steps");
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Yeni Adım
            </Button>
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
      ) : view === "tree" ? (
        <RecipeTreeView
          sku={selectedSku}
          allParts={allParts}
          assemblySteps={assemblyStepOptions}
          onRefresh={handleRefresh}
        />
      ) : (
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          }
        >
          <AssemblyFlowDiagram sku={selectedSku} />
        </Suspense>
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
