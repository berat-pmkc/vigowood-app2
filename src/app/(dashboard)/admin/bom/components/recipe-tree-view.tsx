"use client";

import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import {
  GitBranch,
  ChevronRight,
  Package,
  Loader2,
  Check,
  X,
  Trash2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  getRecipeTree,
  updateBomItem,
  deleteBomItem,
  deleteStep,
  addBomItem,
} from "../actions";
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

interface PartOption {
  part_id: string;
  part_adi: string | null;
  part_type: string | null;
}

interface StepOption {
  step_id: string;
  step_name: string | null;
}

interface RecipeTreeViewProps {
  sku: string;
  allParts: PartOption[];
  assemblySteps: StepOption[];
  onRefresh?: () => void;
}

export function RecipeTreeView({
  sku,
  allParts,
  assemblySteps,
  onRefresh,
}: RecipeTreeViewProps) {
  const [tree, setTree] = useState<RecipeTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

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

  const handleStartEdit = (stepBomId: string, currentQty: number) => {
    setEditingId(stepBomId);
    setEditQty(String(currentQty));
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditQty("");
  };

  const handleSaveEdit = async (stepBomId: string, partId: string) => {
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }

    const result = await updateBomItem(stepBomId, {
      part_id: partId,
      qty_per: qty,
    });

    if (result.success) {
      toast.success("Miktar güncellendi");
      setEditingId(null);
      setEditQty("");
      await loadTree();
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteBomItem = async (stepBomId: string) => {
    const result = await deleteBomItem(stepBomId);
    if (result.success) {
      toast.success("Malzeme silindi");
      await loadTree();
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    const result = await deleteStep(stepId);
    if (result.success) {
      toast.success("Adım silindi");
      await loadTree();
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
  };

  const handleAddBomItem = async (
    stepId: string,
    partId: string,
    qty: number
  ) => {
    const result = await addBomItem(stepId, sku, {
      part_id: partId,
      qty_per: qty,
    });
    if (result.success) {
      toast.success("Malzeme eklendi");
      await loadTree();
      onRefresh?.();
    } else {
      toast.error(result.error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground space-y-3">
        <GitBranch className="h-10 w-10 mx-auto opacity-30" />
        <p className="text-sm">Bu ürün için reçete ağacı bulunmuyor.</p>
        <p className="text-xs">
          Önce &quot;Adımlar&quot; görünümünden montaj adımları ekleyin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-end gap-2 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={loadTree}
        >
          <RefreshCw className="h-3 w-3 mr-1" />
          Yenile
        </Button>
      </div>
      {tree.map((node) => (
        <TreeNodeComponent
          key={node.step_id}
          node={node}
          depth={0}
          editingId={editingId}
          editQty={editQty}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onSaveEdit={handleSaveEdit}
          onEditQtyChange={setEditQty}
          onDeleteBomItem={handleDeleteBomItem}
          onDeleteStep={handleDeleteStep}
          onAddBomItem={handleAddBomItem}
          allParts={allParts}
          assemblySteps={assemblySteps}
          isRootLevel={true}
        />
      ))}
    </div>
  );
}

// ─── Shared Part Combobox ─────────────────────────────────────

function PartComboboxContent({
  allParts,
  asmOptions,
  selectedPartId,
  onSelect,
}: {
  allParts: PartOption[];
  asmOptions: StepOption[];
  selectedPartId?: string;
  onSelect: (partId: string) => void;
}) {
  return (
    <Command>
      <CommandInput placeholder="ID veya isim ile ara..." />
      <CommandList>
        <CommandEmpty>Sonuç bulunamadı.</CommandEmpty>
        {asmOptions.length > 0 && (
          <CommandGroup heading="Alt Montaj Adımları">
            {asmOptions.map((step) => (
              <CommandItem
                key={step.step_id}
                value={`${step.step_id} ${step.step_name ?? ""}`}
                onSelect={() => onSelect(step.step_id)}
                className={
                  selectedPartId === step.step_id ? "bg-accent" : ""
                }
              >
                <GitBranch className="mr-2 h-3 w-3 text-blue-600" />
                <span className="font-mono text-xs mr-2">{step.step_id}</span>
                <span className="truncate">{step.step_name}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Parçalar">
          {allParts.map((part) => (
            <CommandItem
              key={part.part_id}
              value={`${part.part_id} ${part.part_adi ?? ""}`}
              onSelect={() => onSelect(part.part_id)}
              className={
                selectedPartId === part.part_id ? "bg-accent" : ""
              }
            >
              <span className="font-mono text-xs mr-2">{part.part_id}</span>
              <span className="truncate">{part.part_adi}</span>
              {part.part_type && (
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {PART_TYPE_LABELS[
                    part.part_type as keyof typeof PART_TYPE_LABELS
                  ] || part.part_type}
                </Badge>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

// ─── Tree Node (Step) ─────────────────────────────────────────

interface TreeNodeProps {
  node: RecipeTreeNode;
  depth: number;
  editingId: string | null;
  editQty: string;
  onStartEdit: (stepBomId: string, currentQty: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (stepBomId: string, partId: string) => Promise<void>;
  onEditQtyChange: (value: string) => void;
  onDeleteBomItem: (stepBomId: string) => Promise<void>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onAddBomItem: (stepId: string, partId: string, qty: number) => Promise<void>;
  allParts: PartOption[];
  assemblySteps: StepOption[];
  isRootLevel?: boolean;
}

function TreeNodeComponent({
  node,
  depth,
  editingId,
  editQty,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditQtyChange,
  onDeleteBomItem,
  onDeleteStep,
  onAddBomItem,
  allParts,
  assemblySteps,
  isRootLevel,
}: TreeNodeProps) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPartId, setAddPartId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Filter ASM options: exclude self
  const asmOptions = assemblySteps.filter((s) => s.step_id !== node.step_id);

  function getPartDisplayName(partId: string): string {
    if (partId.startsWith("ASM-")) {
      return asmOptions.find((s) => s.step_id === partId)?.step_name || partId;
    }
    return allParts.find((p) => p.part_id === partId)?.part_adi || partId;
  }

  async function handleAdd() {
    if (!addPartId) {
      toast.error("Parça/adım seçiniz");
      return;
    }
    const qty = parseFloat(addQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }
    setAddLoading(true);
    await onAddBomItem(node.step_id, addPartId, qty);
    setAddPartId("");
    setAddQty("1");
    setShowAddForm(false);
    setAddLoading(false);
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div
        className="border rounded-md overflow-hidden"
        style={{ marginLeft: depth * 16 }}
      >
        {/* Step Header */}
        <div className="flex items-center gap-2 w-full px-3 py-2 hover:bg-muted/50 transition-colors">
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 flex-1 min-w-0 text-left">
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
              <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                {node.step_id}
              </span>
              {node.is_final_step && (
                <Badge className="bg-vw-success/20 text-vw-success border-vw-success/30 text-[10px] shrink-0">
                  SON ADIM
                </Badge>
              )}
              <Badge variant="secondary" className="text-[10px] shrink-0">
                {node.items.length} malzeme
              </Badge>
            </button>
          </CollapsibleTrigger>

          {/* Step Actions — only for root-level steps */}
          {isRootLevel && (
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-vw-success hover:text-vw-success"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(true);
                  setShowAddForm(true);
                }}
                title="Malzeme ekle"
              >
                <Plus className="h-3 w-3" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={(e) => e.stopPropagation()}
                    title="Adımı sil"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Adımı Sil</AlertDialogTitle>
                    <AlertDialogDescription>
                      <strong>{node.step_name}</strong> ({node.step_id})
                      adımını ve tüm malzemelerini silmek istediğinize emin
                      misiniz?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>İptal</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      onClick={() => onDeleteStep(node.step_id)}
                    >
                      Sil
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>

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
                    editingId={editingId}
                    editQty={editQty}
                    onStartEdit={onStartEdit}
                    onCancelEdit={onCancelEdit}
                    onSaveEdit={onSaveEdit}
                    onEditQtyChange={onEditQtyChange}
                    onDeleteBomItem={onDeleteBomItem}
                    onDeleteStep={onDeleteStep}
                    onAddBomItem={onAddBomItem}
                    allParts={allParts}
                    assemblySteps={assemblySteps}
                  />
                ))}
              </div>
            ) : (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Malzeme yok
              </p>
            )}

            {/* Inline Add Form */}
            {showAddForm && (
              <div className="border-t px-3 py-3 bg-muted/30 space-y-2">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Parça / Alt Montaj
                    </label>
                    <Popover open={addOpen} onOpenChange={setAddOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full justify-start text-xs h-8"
                        >
                          {addPartId ? (
                            <span className="truncate flex items-center gap-1">
                              {addPartId.startsWith("ASM-") && (
                                <GitBranch className="h-3 w-3 text-blue-600 shrink-0" />
                              )}
                              <span className="font-mono">{addPartId}</span>
                              <span className="text-muted-foreground">—</span>
                              <span>{getPartDisplayName(addPartId)}</span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">
                              Parça veya alt montaj seçin...
                            </span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[350px] p-0"
                        align="start"
                      >
                        <PartComboboxContent
                          allParts={allParts}
                          asmOptions={asmOptions}
                          selectedPartId={addPartId}
                          onSelect={(partId) => {
                            setAddPartId(partId);
                            setAddOpen(false);
                          }}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="w-20">
                    <label className="text-xs text-muted-foreground mb-1 block">
                      Miktar
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={addQty}
                      onChange={(e) => setAddQty(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>

                  <Button
                    size="sm"
                    className="h-8"
                    onClick={handleAdd}
                    disabled={addLoading || !addPartId}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Ekle
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8"
                    onClick={() => {
                      setShowAddForm(false);
                      setAddPartId("");
                      setAddQty("1");
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Quick Add Button when form is hidden */}
            {!showAddForm && isRootLevel && (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 w-full px-3 py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors border-t"
              >
                <Plus className="h-3 w-3" />
                Malzeme ekle
              </button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Tree Item (BOM Item) ─────────────────────────────────────

interface TreeItemProps {
  item: RecipeTreeItem;
  depth: number;
  editingId: string | null;
  editQty: string;
  onStartEdit: (stepBomId: string, currentQty: number) => void;
  onCancelEdit: () => void;
  onSaveEdit: (stepBomId: string, partId: string) => Promise<void>;
  onEditQtyChange: (value: string) => void;
  onDeleteBomItem: (stepBomId: string) => Promise<void>;
  onDeleteStep: (stepId: string) => Promise<void>;
  onAddBomItem: (stepId: string, partId: string, qty: number) => Promise<void>;
  allParts: PartOption[];
  assemblySteps: StepOption[];
}

function TreeItemComponent({
  item,
  depth,
  editingId,
  editQty,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditQtyChange,
  onDeleteBomItem,
  onDeleteStep,
  onAddBomItem,
  allParts,
  assemblySteps,
}: TreeItemProps) {
  const isEditing = editingId === item.step_bom_id;
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = () => {
    startTransition(async () => {
      await onSaveEdit(item.step_bom_id, item.part_id);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      onCancelEdit();
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    await onDeleteBomItem(item.step_bom_id);
    setIsDeleting(false);
  };

  return (
    <div>
      {/* Item Row */}
      <div className="flex items-center gap-2 px-3 py-1.5 pl-10 text-sm group">
        {item.is_asm_reference ? (
          <GitBranch className="h-3.5 w-3.5 text-blue-600 shrink-0" />
        ) : (
          <Package className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}

        <span className="font-mono text-[10px] text-muted-foreground shrink-0">
          {item.part_id}
        </span>

        <span className="truncate flex-1 text-xs">{item.part_name}</span>

        {item.is_asm_reference ? (
          <Badge
            variant="outline"
            className="text-blue-600 border-blue-300 text-[10px] shrink-0"
          >
            Alt Montaj
          </Badge>
        ) : item.part_type ? (
          <Badge variant="secondary" className="text-[10px] shrink-0">
            {PART_TYPE_LABELS[
              item.part_type as keyof typeof PART_TYPE_LABELS
            ] || item.part_type}
          </Badge>
        ) : null}

        {/* Qty — inline edit */}
        {isEditing ? (
          <div className="flex items-center gap-1 shrink-0">
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={editQty}
              onChange={(e) => onEditQtyChange(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-6 w-16 text-xs font-mono px-1"
              autoFocus
              disabled={isPending}
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleSave}
              disabled={isPending}
            >
              <Check className="h-3 w-3 text-vw-success" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={onCancelEdit}
              disabled={isPending}
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartEdit(item.step_bom_id, item.qty_per);
              }}
              className="font-mono text-xs text-muted-foreground w-12 text-right hover:text-primary hover:underline cursor-pointer"
              title="Tıklayarak miktarı düzenleyin"
            >
              x{item.qty_per}
            </button>
            {/* Delete button — visible on hover */}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  disabled={isDeleting}
                  title="Malzemeyi sil"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Malzemeyi Sil</AlertDialogTitle>
                  <AlertDialogDescription>
                    <strong>{item.part_name}</strong> ({item.part_id})
                    malzemesini silmek istediğinize emin misiniz?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>İptal</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={handleDelete}
                  >
                    Sil
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      {/* Sub-tree for ASM references */}
      {item.sub_tree && (
        <div className="ml-4 mb-1">
          <TreeNodeComponent
            node={item.sub_tree}
            depth={depth + 1}
            editingId={editingId}
            editQty={editQty}
            onStartEdit={onStartEdit}
            onCancelEdit={onCancelEdit}
            onSaveEdit={onSaveEdit}
            onEditQtyChange={onEditQtyChange}
            onDeleteBomItem={onDeleteBomItem}
            onDeleteStep={onDeleteStep}
            onAddBomItem={onAddBomItem}
            allParts={allParts}
            assemblySteps={assemblySteps}
            isRootLevel={false}
          />
        </div>
      )}
    </div>
  );
}
