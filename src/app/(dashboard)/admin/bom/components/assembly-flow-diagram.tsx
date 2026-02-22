"use client";

import { useState, useEffect, useCallback, useRef, memo } from "react";
import { toast } from "sonner";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type NodeTypes,
  type Connection,
  type OnConnect,
  type EdgeMouseHandler,
  Position,
  MarkerType,
  Panel,
  Handle,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Loader2,
  Trash2,
  GitBranch,
  Package,
  Plus,
  X,
  Link2,
  Unlink,
  MousePointerClick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getRecipeTree,
  addBomItem,
  deleteBomItem,
  deleteStep,
} from "../actions";
import { PART_TYPE_LABELS } from "@/lib/constants";

// ─── Types ────────────────────────────────────────────────────

interface RecipeTreeItem {
  step_bom_id: string;
  part_id: string;
  part_name: string;
  qty_per: number;
  is_asm_reference: boolean;
  part_type: string | null;
  sub_tree?: RecipeTreeNode;
}

interface RecipeTreeNode {
  step_id: string;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean;
  items: RecipeTreeItem[];
}

interface StepNodeData {
  step_id: string;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean;
  items: RecipeTreeItem[];
  onDeleteStep: (stepId: string) => void;
  onDeleteBomItem: (stepBomId: string) => void;
  [key: string]: unknown;
}

interface FlowDiagramProps {
  sku: string;
  onRefresh?: () => void;
}

// ─── Custom Step Node ─────────────────────────────────────────

const StepNode = memo(function StepNode({ data }: { data: StepNodeData }) {
  const regularItems = data.items.filter((i) => !i.is_asm_reference);
  const asmItems = data.items.filter((i) => i.is_asm_reference);

  return (
    <div
      className={`
        rounded-lg border-2 shadow-md bg-card min-w-[240px] max-w-[300px] relative
        ${data.is_final_step ? "border-[#70c1aa]" : "border-[#cdbd9d]"}
      `}
    >
      {/* Connection Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-[#3368b1] !border-2 !border-white"
        style={{ left: -6 }}
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-[#cdbd9d] !border-2 !border-white"
        style={{ right: -6 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="top"
        className="!w-3 !h-3 !bg-[#3368b1] !border-2 !border-white"
        style={{ top: -6 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="bottom"
        className="!w-3 !h-3 !bg-[#cdbd9d] !border-2 !border-white"
        style={{ bottom: -6 }}
      />

      {/* Header */}
      <div
        className={`
          px-3 py-2 rounded-t-md flex items-center gap-2
          ${data.is_final_step ? "bg-[#70c1aa]/15" : "bg-[#cdbd9d]/15"}
        `}
      >
        <span
          className={`
            flex items-center justify-center h-7 w-7 rounded-full text-xs font-bold shrink-0
            ${data.is_final_step ? "bg-[#70c1aa]/30 text-[#3caa35]" : "bg-[#cdbd9d]/30 text-[#5e5747]"}
          `}
        >
          {data.seq_no}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-xs truncate text-[#474237]">
            {data.step_name || data.step_id}
          </p>
          <p className="text-[10px] font-mono text-[#a99c7d]">
            {data.step_id}
          </p>
        </div>
        {data.is_final_step && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#70c1aa]/20 text-[#3caa35] shrink-0">
            SON
          </span>
        )}
      </div>

      {/* BOM Items */}
      <div className="px-2 py-1.5 space-y-0.5 min-h-[20px]">
        {/* ASM References */}
        {asmItems.map((item) => (
          <div
            key={item.step_bom_id}
            className="flex items-center gap-1 text-[10px] py-0.5 px-1.5 rounded bg-blue-50 border border-blue-200 group/item"
          >
            <GitBranch className="h-3 w-3 text-blue-600 shrink-0" />
            <span className="truncate flex-1 text-blue-700">
              {item.part_name}
            </span>
            <span className="font-mono text-blue-500 shrink-0">
              x{item.qty_per}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteBomItem(item.step_bom_id);
              }}
              className="opacity-0 group-hover/item:opacity-100 text-red-400 hover:text-red-600 transition-opacity ml-0.5"
              title="Bağlantıyı kaldır"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {/* Regular Parts */}
        {regularItems.slice(0, 5).map((item) => (
          <div
            key={item.step_bom_id}
            className="flex items-center gap-1 text-[10px] py-0.5 px-1.5 rounded hover:bg-muted/50 group/item"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#a99c7d] shrink-0" />
            <span className="truncate flex-1 text-[#474237]">
              {item.part_name}
            </span>
            <span className="font-mono text-[#a99c7d] shrink-0">
              x{item.qty_per}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                data.onDeleteBomItem(item.step_bom_id);
              }}
              className="opacity-0 group-hover/item:opacity-100 text-red-400 hover:text-red-600 transition-opacity ml-0.5"
              title="Malzemeyi sil"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {regularItems.length > 5 && (
          <p className="text-[10px] text-[#a99c7d] px-1.5 italic">
            +{regularItems.length - 5} malzeme daha
          </p>
        )}

        {data.items.length === 0 && (
          <p className="text-[10px] text-[#a99c7d] px-1.5 italic py-1">
            Malzeme yok
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t bg-muted/30 rounded-b-md flex items-center justify-between">
        <p className="text-[10px] text-[#a99c7d]">
          {data.items.length} malzeme
          {asmItems.length > 0 && ` · ${asmItems.length} alt montaj`}
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDeleteStep(data.step_id);
          }}
          className="text-[#a99c7d] hover:text-red-500 transition-colors"
          title="Adımı sil"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
});

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
};

// ─── Layout ──────────────────────────────────────────────────

const NODE_WIDTH = 280;
const ROW_HEIGHT = 260;
const H_GAP = 100;
const COLS = 3;

function buildFlowData(
  tree: RecipeTreeNode[],
  onDeleteStep: (stepId: string) => void,
  onDeleteBomItem: (stepBomId: string) => void
): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (tree.length === 0) return { nodes, edges };

  // Position nodes in zigzag grid
  tree.forEach((step, index) => {
    const row = Math.floor(index / COLS);
    const col = index % COLS;
    const effectiveCol = row % 2 === 0 ? col : COLS - 1 - col;

    nodes.push({
      id: step.step_id,
      type: "stepNode",
      position: {
        x: effectiveCol * (NODE_WIDTH + H_GAP),
        y: row * ROW_HEIGHT,
      },
      data: {
        step_id: step.step_id,
        step_name: step.step_name,
        seq_no: step.seq_no,
        is_final_step: step.is_final_step,
        items: step.items,
        onDeleteStep,
        onDeleteBomItem,
      },
    });

    // Sequential flow edge
    if (index < tree.length - 1) {
      const nextStep = tree[index + 1];
      const nextRow = Math.floor((index + 1) / COLS);
      const isRowChange = row !== nextRow;

      edges.push({
        id: `seq-${step.step_id}-${nextStep.step_id}`,
        source: step.step_id,
        target: nextStep.step_id,
        sourceHandle: isRowChange ? "bottom" : undefined,
        targetHandle: isRowChange ? "top" : undefined,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#cdbd9d", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#cdbd9d",
          width: 16,
          height: 16,
        },
        label: `${(step.seq_no ?? index + 1)} → ${nextStep.seq_no ?? index + 2}`,
        labelStyle: { fontSize: 10, fill: "#a99c7d", fontWeight: 600 },
        labelBgStyle: { fill: "#f0ede1", fillOpacity: 0.9 },
        deletable: false,
      });
    }

    // ASM reference edges (sub-assembly connections)
    for (const item of step.items) {
      if (item.is_asm_reference) {
        const targetExists = tree.some((s) => s.step_id === item.part_id);
        if (targetExists) {
          edges.push({
            id: `asm-${item.step_bom_id}`,
            source: item.part_id,
            target: step.step_id,
            type: "smoothstep",
            style: {
              stroke: "#3368b1",
              strokeWidth: 2,
              strokeDasharray: "6,4",
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#3368b1",
              width: 14,
              height: 14,
            },
            label: `x${item.qty_per}`,
            labelStyle: { fontSize: 10, fill: "#3368b1", fontWeight: 600 },
            labelBgStyle: { fill: "#e8f0fe", fillOpacity: 0.9 },
            data: { step_bom_id: item.step_bom_id, type: "asm" },
          });
        }
      }
    }
  });

  return { nodes, edges };
}

// ─── Inner Component (needs ReactFlowProvider) ───────────────

function FlowDiagramInner({ sku, onRefresh }: FlowDiagramProps) {
  const [tree, setTree] = useState<RecipeTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  // Connection dialog state
  const [pendingConnection, setPendingConnection] = useState<{
    sourceStepId: string;
    targetStepId: string;
    sourceName: string;
    targetName: string;
  } | null>(null);
  const [connectionQty, setConnectionQty] = useState("1");
  const [connectionLoading, setConnectionLoading] = useState(false);

  // Delete edge dialog
  const [pendingDeleteEdge, setPendingDeleteEdge] = useState<{
    edgeId: string;
    stepBomId: string;
    sourceName: string;
    targetName: string;
  } | null>(null);

  // Delete step dialog
  const [pendingDeleteStep, setPendingDeleteStep] = useState<{
    stepId: string;
    stepName: string;
  } | null>(null);

  const reactFlowInstance = useReactFlow();

  const handleDeleteStep = useCallback((stepId: string) => {
    const step = tree.find((s) => s.step_id === stepId);
    setPendingDeleteStep({
      stepId,
      stepName: step?.step_name || stepId,
    });
  }, [tree]);

  const handleDeleteBomItem = useCallback(async (stepBomId: string) => {
    const result = await deleteBomItem(stepBomId);
    if (result.success) {
      toast.success("Malzeme silindi");
      await loadTree();
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
  }, [onRefresh]);

  async function loadTree() {
    setLoading(true);
    const result = await getRecipeTree(sku);
    if (result.success) {
      setTree(result.data);
      const { nodes: n, edges: e } = buildFlowData(
        result.data,
        handleDeleteStep,
        handleDeleteBomItem
      );
      setNodes(n);
      setEdges(e);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadTree();
  }, [sku]);

  // Update node data callbacks when tree changes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => ({
        ...node,
        data: {
          ...node.data,
          onDeleteStep: handleDeleteStep,
          onDeleteBomItem: handleDeleteBomItem,
        },
      }))
    );
  }, [handleDeleteStep, handleDeleteBomItem, setNodes]);

  // ─── Connection: drag from one step to another = create ASM reference
  const onConnect: OnConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target) return;
      if (params.source === params.target) return;

      // Check if this connection already exists
      const exists = edges.some(
        (e) =>
          e.source === params.source &&
          e.target === params.target &&
          e.id.startsWith("asm-")
      );
      if (exists) {
        toast.error("Bu bağlantı zaten mevcut");
        return;
      }

      const sourceStep = tree.find((s) => s.step_id === params.source);
      const targetStep = tree.find((s) => s.step_id === params.target);

      setPendingConnection({
        sourceStepId: params.source,
        targetStepId: params.target,
        sourceName: sourceStep?.step_name || params.source,
        targetName: targetStep?.step_name || params.target,
      });
      setConnectionQty("1");
    },
    [edges, tree]
  );

  async function confirmConnection() {
    if (!pendingConnection) return;
    const qty = parseFloat(connectionQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }

    setConnectionLoading(true);

    // source step's output → target step's BOM (ASM reference)
    // addBomItem(targetStepId, sku, { part_id: sourceStepId, qty_per })
    const result = await addBomItem(
      pendingConnection.targetStepId,
      sku,
      {
        part_id: pendingConnection.sourceStepId,
        qty_per: qty,
      }
    );

    if (result.success) {
      toast.success(
        `${pendingConnection.sourceName} → ${pendingConnection.targetName} bağlantısı oluşturuldu`
      );
      setPendingConnection(null);
      await loadTree();
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
    setConnectionLoading(false);
  }

  // ─── Edge click: delete ASM connection
  const onEdgeClick: EdgeMouseHandler = useCallback(
    (_event, edge) => {
      // Only ASM edges are deletable
      if (!edge.id.startsWith("asm-")) return;

      const edgeData = edge.data as { step_bom_id?: string; type?: string } | undefined;
      if (!edgeData?.step_bom_id) return;

      const sourceStep = tree.find((s) => s.step_id === edge.source);
      const targetStep = tree.find((s) => s.step_id === edge.target);

      setPendingDeleteEdge({
        edgeId: edge.id,
        stepBomId: edgeData.step_bom_id,
        sourceName: sourceStep?.step_name || edge.source,
        targetName: targetStep?.step_name || edge.target,
      });
    },
    [tree]
  );

  async function confirmDeleteEdge() {
    if (!pendingDeleteEdge) return;

    const result = await deleteBomItem(pendingDeleteEdge.stepBomId);
    if (result.success) {
      toast.success("Bağlantı kaldırıldı");
      setPendingDeleteEdge(null);
      await loadTree();
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
  }

  async function confirmDeleteStep() {
    if (!pendingDeleteStep) return;

    const result = await deleteStep(pendingDeleteStep.stepId);
    if (result.success) {
      toast.success("Adım silindi");
      setPendingDeleteStep(null);
      await loadTree();
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-sm">Bu ürün için akış diyagramı bulunmuyor.</p>
        <p className="text-xs mt-1">Önce montaj adımları ekleyin.</p>
      </div>
    );
  }

  return (
    <>
      <div
        className="border rounded-lg bg-[#f9f7f2] overflow-hidden"
        style={{ height: "70vh" }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          connectionLineStyle={{ stroke: "#3368b1", strokeWidth: 2, strokeDasharray: "6,4" }}
          defaultEdgeOptions={{
            type: "smoothstep",
          }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#cdbd9d" gap={20} size={1} />
          <Controls
            showInteractive={false}
            position="bottom-right"
          />
          <MiniMap
            nodeColor={(node) => {
              const d = node.data as StepNodeData;
              return d.is_final_step ? "#70c1aa" : "#cdbd9d";
            }}
            maskColor="rgba(240, 237, 225, 0.7)"
            style={{ borderRadius: 8, border: "1px solid #cdbd9d" }}
          />

          {/* Legend + Instructions */}
          <Panel position="top-left">
            <div className="bg-card/95 backdrop-blur-sm border rounded-lg px-3 py-2.5 shadow-sm space-y-2 max-w-[220px]">
              <p className="text-[11px] font-semibold text-[#474237]">
                Montaj Akış Diyagramı
              </p>

              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px]">
                  <div className="w-5 h-0.5 bg-[#cdbd9d] shrink-0" />
                  <span className="text-[#5e5747]">Sıralı akış</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <div className="w-5 h-0.5 border-t-2 border-dashed border-[#3368b1] shrink-0" />
                  <span className="text-[#5e5747]">Alt montaj bağlantısı</span>
                </div>
                <div className="flex items-center gap-2 text-[10px]">
                  <div className="w-3 h-3 rounded border-2 border-[#70c1aa] bg-[#70c1aa]/15 shrink-0" />
                  <span className="text-[#5e5747]">Son adım</span>
                </div>
              </div>

              <div className="border-t pt-2 space-y-1">
                <p className="text-[10px] font-semibold text-[#474237]">
                  Etkileşim
                </p>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <Link2 className="h-3 w-3 text-[#3368b1] shrink-0 mt-0.5" />
                  <span className="text-[#5e5747]">
                    Bağlantı noktasından sürükleyerek alt montaj bağlantısı oluşturun
                  </span>
                </div>
                <div className="flex items-start gap-1.5 text-[10px]">
                  <MousePointerClick className="h-3 w-3 text-[#3368b1] shrink-0 mt-0.5" />
                  <span className="text-[#5e5747]">
                    Mavi kesikli çizgiye tıklayarak bağlantıyı silin
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* ─── Connection Dialog ─── */}
      <AlertDialog
        open={!!pendingConnection}
        onOpenChange={(open) => !open && setPendingConnection(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-[#3368b1]" />
              Alt Montaj Bağlantısı Oluştur
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  <strong>{pendingConnection?.sourceName}</strong> adımının
                  çıktısı, <strong>{pendingConnection?.targetName}</strong>{" "}
                  adımının girdisi olarak eklenecek.
                </p>
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1 text-center">
                    <p className="text-xs font-semibold text-[#474237]">
                      {pendingConnection?.sourceName}
                    </p>
                    <p className="text-[10px] text-[#a99c7d]">Kaynak (çıktı)</p>
                  </div>
                  <div className="text-[#3368b1] font-bold">→</div>
                  <div className="flex-1 text-center">
                    <p className="text-xs font-semibold text-[#474237]">
                      {pendingConnection?.targetName}
                    </p>
                    <p className="text-[10px] text-[#a99c7d]">Hedef (girdi)</p>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-[#474237] mb-1 block">
                    Miktar (adet)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={connectionQty}
                    onChange={(e) => setConnectionQty(e.target.value)}
                    className="w-32"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") confirmConnection();
                    }}
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmConnection}
              disabled={connectionLoading}
            >
              {connectionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Link2 className="h-4 w-4 mr-1" />
              )}
              Bağla
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Edge Dialog ─── */}
      <AlertDialog
        open={!!pendingDeleteEdge}
        onOpenChange={(open) => !open && setPendingDeleteEdge(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Unlink className="h-5 w-5 text-destructive" />
              Bağlantıyı Kaldır
            </AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDeleteEdge?.sourceName}</strong> →{" "}
              <strong>{pendingDeleteEdge?.targetName}</strong> alt montaj
              bağlantısını kaldırmak istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteEdge}
            >
              <Unlink className="h-4 w-4 mr-1" />
              Kaldır
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete Step Dialog ─── */}
      <AlertDialog
        open={!!pendingDeleteStep}
        onOpenChange={(open) => !open && setPendingDeleteStep(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Adımı Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{pendingDeleteStep?.stepName}</strong> (
              {pendingDeleteStep?.stepId}) adımını ve tüm malzemelerini silmek
              istediğinize emin misiniz?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDeleteStep}
            >
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// ─── Wrapper with Provider ───────────────────────────────────

export function AssemblyFlowDiagram(props: FlowDiagramProps) {
  return (
    <ReactFlowProvider>
      <FlowDiagramInner {...props} />
    </ReactFlowProvider>
  );
}
