"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
  Position,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Loader2, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { getRecipeTree } from "../actions";

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

interface FlowDiagramProps {
  sku: string;
}

// ─── Custom Node Component ───────────────────────────────────

function StepNode({ data }: { data: StepNodeData }) {
  const regularItems = data.items.filter((i) => !i.is_asm_reference);
  const asmItems = data.items.filter((i) => i.is_asm_reference);

  return (
    <div
      className={`
        rounded-lg border-2 shadow-md bg-card min-w-[220px] max-w-[280px]
        ${data.is_final_step ? "border-[#70c1aa]" : "border-[#cdbd9d]"}
      `}
    >
      {/* Header */}
      <div
        className={`
          px-3 py-2 rounded-t-md flex items-center gap-2
          ${data.is_final_step ? "bg-[#70c1aa]/15" : "bg-[#cdbd9d]/15"}
        `}
      >
        <span
          className={`
            flex items-center justify-center h-6 w-6 rounded-full text-xs font-bold shrink-0
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
      {(regularItems.length > 0 || asmItems.length > 0) && (
        <div className="px-2 py-1.5 space-y-0.5">
          {/* ASM References */}
          {asmItems.map((item) => (
            <div
              key={item.step_bom_id}
              className="flex items-center gap-1.5 text-[10px] py-0.5 px-1.5 rounded bg-blue-50 border border-blue-200"
            >
              <span className="text-blue-600 font-bold shrink-0">ASM</span>
              <span className="truncate flex-1 text-blue-700">
                {item.part_name}
              </span>
              <span className="font-mono text-blue-500 shrink-0">
                x{item.qty_per}
              </span>
            </div>
          ))}

          {/* Regular Parts */}
          {regularItems.slice(0, 6).map((item) => (
            <div
              key={item.step_bom_id}
              className="flex items-center gap-1.5 text-[10px] py-0.5 px-1.5 rounded hover:bg-muted/50"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#a99c7d] shrink-0" />
              <span className="truncate flex-1 text-[#474237]">
                {item.part_name}
              </span>
              <span className="font-mono text-[#a99c7d] shrink-0">
                x{item.qty_per}
              </span>
            </div>
          ))}

          {regularItems.length > 6 && (
            <p className="text-[10px] text-[#a99c7d] px-1.5 italic">
              +{regularItems.length - 6} malzeme daha...
            </p>
          )}
        </div>
      )}

      {data.items.length === 0 && (
        <div className="px-3 py-2">
          <p className="text-[10px] text-[#a99c7d] italic">Malzeme yok</p>
        </div>
      )}

      {/* Footer */}
      <div className="px-3 py-1 border-t bg-muted/30 rounded-b-md">
        <p className="text-[10px] text-[#a99c7d]">
          {data.items.length} malzeme
          {asmItems.length > 0 && ` · ${asmItems.length} alt montaj`}
        </p>
      </div>
    </div>
  );
}

interface StepNodeData {
  step_id: string;
  step_name: string | null;
  seq_no: number | null;
  is_final_step: boolean;
  items: RecipeTreeItem[];
  [key: string]: unknown;
}

const nodeTypes: NodeTypes = {
  stepNode: StepNode,
};

// ─── Layout Helper ───────────────────────────────────────────

const NODE_WIDTH = 260;
const NODE_HEIGHT_BASE = 80;
const NODE_HEIGHT_PER_ITEM = 20;
const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 40;

function calculateNodeHeight(itemCount: number): number {
  const visibleItems = Math.min(itemCount, 7); // max 6 items + "more" text
  return NODE_HEIGHT_BASE + visibleItems * NODE_HEIGHT_PER_ITEM;
}

function buildFlowData(tree: RecipeTreeNode[]): {
  nodes: Node[];
  edges: Edge[];
} {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (tree.length === 0) return { nodes, edges };

  // Determine layout: rows of 3 columns
  const COLS = 3;

  tree.forEach((step, index) => {
    const row = Math.floor(index / COLS);
    const col = index % COLS;

    // Zigzag: even rows left-to-right, odd rows right-to-left
    const effectiveCol = row % 2 === 0 ? col : COLS - 1 - col;

    const nodeHeight = calculateNodeHeight(step.items.length);
    const x = effectiveCol * (NODE_WIDTH + HORIZONTAL_GAP);
    const y = row * (200 + VERTICAL_GAP);

    nodes.push({
      id: step.step_id,
      type: "stepNode",
      position: { x, y },
      data: {
        step_id: step.step_id,
        step_name: step.step_name,
        seq_no: step.seq_no,
        is_final_step: step.is_final_step,
        items: step.items,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    });

    // Sequential edge to next step
    if (index < tree.length - 1) {
      const nextStep = tree[index + 1];
      const nextRow = Math.floor((index + 1) / COLS);
      const sameRow = row === nextRow;

      edges.push({
        id: `seq-${step.step_id}-${nextStep.step_id}`,
        source: step.step_id,
        target: nextStep.step_id,
        type: "smoothstep",
        animated: true,
        style: { stroke: "#cdbd9d", strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: "#cdbd9d",
          width: 16,
          height: 16,
        },
        label: `${index + 1}→${index + 2}`,
        labelStyle: { fontSize: 10, fill: "#a99c7d" },
        labelBgStyle: { fill: "#f0ede1", fillOpacity: 0.9 },
      });
    }

    // ASM reference edges (sub-assembly connections)
    for (const item of step.items) {
      if (item.is_asm_reference) {
        // Check if the ASM step exists in our tree
        const targetExists = tree.some((s) => s.step_id === item.part_id);
        if (targetExists) {
          edges.push({
            id: `asm-${step.step_id}-${item.part_id}`,
            source: item.part_id,
            target: step.step_id,
            type: "smoothstep",
            style: {
              stroke: "#3368b1",
              strokeWidth: 1.5,
              strokeDasharray: "5,5",
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#3368b1",
              width: 12,
              height: 12,
            },
            label: `x${item.qty_per}`,
            labelStyle: { fontSize: 9, fill: "#3368b1" },
            labelBgStyle: { fill: "#e8f0fe", fillOpacity: 0.9 },
          });
        }
      }
    }
  });

  return { nodes, edges };
}

// ─── Main Component ──────────────────────────────────────────

export function AssemblyFlowDiagram({ sku }: FlowDiagramProps) {
  const [tree, setTree] = useState<RecipeTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  useEffect(() => {
    loadTree();
  }, [sku]);

  async function loadTree() {
    setLoading(true);
    const result = await getRecipeTree(sku);
    if (result.success) {
      setTree(result.data);
      const { nodes: n, edges: e } = buildFlowData(result.data);
      setNodes(n);
      setEdges(e);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
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
        <p className="text-xs mt-1">
          Önce montaj adımları ekleyin.
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg bg-[#f9f7f2] overflow-hidden" style={{ height: "70vh" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#cdbd9d" gap={20} size={1} />
        <Controls
          showInteractive={false}
          position="bottom-right"
          style={{ display: "flex", flexDirection: "row", gap: 4 }}
        />
        <MiniMap
          nodeColor={(node) => {
            const data = node.data as StepNodeData;
            return data.is_final_step ? "#70c1aa" : "#cdbd9d";
          }}
          maskColor="rgba(240, 237, 225, 0.7)"
          style={{ borderRadius: 8, border: "1px solid #cdbd9d" }}
        />

        {/* Legend */}
        <Panel position="top-left">
          <div className="bg-card/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-sm space-y-1.5">
            <p className="text-[10px] font-semibold text-[#474237]">Gösterim</p>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-6 h-0.5 bg-[#cdbd9d]" />
              <span className="text-[#5e5747]">Sıralı akış</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-6 h-0.5 border-t-2 border-dashed border-[#3368b1]" />
              <span className="text-[#5e5747]">Alt montaj bağlantısı</span>
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <div className="w-3 h-3 rounded border-2 border-[#70c1aa] bg-[#70c1aa]/15" />
              <span className="text-[#5e5747]">Son adım</span>
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
