"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { GitBranch, ChevronRight, Package, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { getRecipeTree } from "../actions";
import { PART_TYPE_LABELS } from "@/lib/constants";

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

interface RecipeTreeViewProps {
  sku: string;
}

export function RecipeTreeView({ sku }: RecipeTreeViewProps) {
  const [tree, setTree] = useState<RecipeTreeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTree();
  }, [sku]);

  async function loadTree() {
    setLoading(true);
    const result = await getRecipeTree(sku);
    if (result.success) {
      setTree(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">Bu ürün için reçete ağacı bulunmuyor.</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {tree.map((node) => (
        <TreeNodeComponent key={node.step_id} node={node} depth={0} />
      ))}
    </div>
  );
}

function TreeNodeComponent({
  node,
  depth,
}: {
  node: RecipeTreeNode;
  depth: number;
}) {
  const [isOpen, setIsOpen] = useState(depth < 2);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className="border rounded-md overflow-hidden"
        style={{ marginLeft: depth * 16 }}
      >
        {/* Step Header */}
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors">
            <ChevronRight
              className={cn(
                "h-4 w-4 shrink-0 transition-transform text-muted-foreground",
                isOpen && "rotate-90"
              )}
            />
            <span className="flex items-center justify-center h-5 w-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
              {node.seq_no}
            </span>
            <span className="font-medium text-sm truncate flex-1">
              {node.step_name || node.step_id}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {node.step_id}
            </span>
            {node.is_final_step && (
              <Badge className="bg-vw-success/20 text-vw-success border-vw-success/30 text-[10px]">
                SON ADIM
              </Badge>
            )}
            <Badge variant="secondary" className="text-[10px]">
              {node.items.length} malzeme
            </Badge>
          </button>
        </CollapsibleTrigger>

        {/* BOM Items */}
        <CollapsibleContent>
          <div className="border-t">
            {node.items.length > 0 ? (
              <div className="divide-y">
                {node.items.map((item) => (
                  <TreeItemComponent
                    key={item.step_bom_id}
                    item={item}
                    depth={depth}
                  />
                ))}
              </div>
            ) : (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Malzeme yok
              </p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

function TreeItemComponent({
  item,
  depth,
}: {
  item: RecipeTreeItem;
  depth: number;
}) {
  return (
    <div>
      {/* Item Row */}
      <div className="flex items-center gap-2 px-3 py-1.5 pl-10 text-sm">
        {item.is_asm_reference ? (
          <GitBranch className="h-3.5 w-3.5 text-blue-600 shrink-0" />
        ) : (
          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}

        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
          {item.part_id}
        </span>

        <span className="truncate flex-1 text-xs">
          {item.part_name}
        </span>

        {item.is_asm_reference ? (
          <Badge
            variant="outline"
            className="text-blue-600 border-blue-300 text-[10px] shrink-0"
          >
            Alt Montaj
          </Badge>
        ) : item.part_type ? (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {PART_TYPE_LABELS[item.part_type as keyof typeof PART_TYPE_LABELS] || item.part_type}
          </Badge>
        ) : null}

        <span className="font-mono text-xs text-muted-foreground shrink-0 w-12 text-right">
          x{item.qty_per}
        </span>
      </div>

      {/* Sub-tree for ASM references */}
      {item.sub_tree && (
        <div className="ml-4 mb-1">
          <TreeNodeComponent node={item.sub_tree} depth={depth + 1} />
        </div>
      )}
    </div>
  );
}
