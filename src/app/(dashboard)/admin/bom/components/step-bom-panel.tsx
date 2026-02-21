"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import {
  Trash2,
  GitBranch,
  Pencil,
  Check,
  X,
  Plus,
  ArrowRightLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  getStepBom,
  addBomItem,
  updateBomItem,
  deleteBomItem,
} from "../actions";

import { PART_TYPE_LABELS } from "@/lib/constants";

interface StepBomItem {
  step_bom_id: string;
  step_id: string;
  part_id: string;
  part_name: string;
  part_type: string | null;
  is_asm_reference: boolean;
  qty_per: number;
  kodu: string | null;
}

interface StepBomPanelProps {
  stepId: string;
  sku: string;
  open: boolean;
  allParts: {
    part_id: string;
    part_adi: string | null;
    part_type: string | null;
  }[];
  assemblySteps: { step_id: string; step_name: string | null }[];
  onBomCountChange?: (count: number) => void;
}

export function StepBomPanel({
  stepId,
  sku,
  open,
  allParts,
  assemblySteps,
  onBomCountChange,
}: StepBomPanelProps) {
  const [items, setItems] = useState<StepBomItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Inline edit state — now supports both qty and part change
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const [editPartId, setEditPartId] = useState<string>("");
  const [editPartOpen, setEditPartOpen] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  // Add form state
  const [addPartId, setAddPartId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadBom = useCallback(async () => {
    setLoading(true);
    const result = await getStepBom(stepId);
    if (result.success) {
      setItems(result.data);
      onBomCountChange?.(result.data.length);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
    setLoaded(true);
  }, [stepId, onBomCountChange]);

  useEffect(() => {
    if (open && !loaded) {
      loadBom();
    }
  }, [open, loaded, loadBom]);

  async function handleDelete(stepBomId: string) {
    setDeletingId(stepBomId);
    const result = await deleteBomItem(stepBomId);
    if (result.success) {
      const newItems = items.filter((i) => i.step_bom_id !== stepBomId);
      setItems(newItems);
      onBomCountChange?.(newItems.length);
      toast.success("Malzeme silindi");
    } else {
      toast.error(result.error);
    }
    setDeletingId(null);
  }

  function startEdit(item: StepBomItem) {
    setEditingId(item.step_bom_id);
    setEditQty(String(item.qty_per));
    setEditPartId(item.part_id);
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditPartId("");
    setEditPartOpen(false);
  }

  async function saveEdit(item: StepBomItem) {
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }
    if (!editPartId) {
      toast.error("Parça seçimi gereklidir");
      return;
    }

    const partChanged = editPartId !== item.part_id;
    const qtyChanged = qty !== item.qty_per;

    if (!partChanged && !qtyChanged) {
      cancelEdit();
      return;
    }

    const result = await updateBomItem(item.step_bom_id, {
      part_id: editPartId,
      qty_per: qty,
    });

    if (result.success) {
      // Resolve new part name if part changed
      if (partChanged) {
        // Reload to get fresh part names from server
        await loadBom();
      } else {
        setItems(
          items.map((i) =>
            i.step_bom_id === item.step_bom_id ? { ...i, qty_per: qty } : i
          )
        );
      }
      cancelEdit();
      toast.success(
        partChanged ? "Malzeme güncellendi" : "Miktar güncellendi"
      );
    } else {
      toast.error(result.error);
    }
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
    const result = await addBomItem(stepId, sku, {
      part_id: addPartId,
      qty_per: qty,
    });

    if (result.success) {
      setAddPartId("");
      setAddQty("1");
      toast.success("Malzeme eklendi");
      await loadBom();
    } else {
      toast.error(result.error);
    }
    setAddLoading(false);
  }

  // Filter out the current step from assembly steps options
  const asmOptions = assemblySteps.filter((s) => s.step_id !== stepId);

  // Helper to get display name for a part_id
  function getPartDisplayName(partId: string): string {
    if (partId.startsWith("ASM-")) {
      return (
        asmOptions.find((s) => s.step_id === partId)?.step_name || partId
      );
    }
    return allParts.find((p) => p.part_id === partId)?.part_adi || partId;
  }

  // Shared combobox content for part selection
  function PartComboboxContent({
    onSelect,
    selectedPartId,
  }: {
    onSelect: (partId: string) => void;
    selectedPartId?: string;
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
                  <span className="font-mono text-xs mr-2">
                    {step.step_id}
                  </span>
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
                  <Badge
                    variant="secondary"
                    className="ml-auto text-[10px]"
                  >
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

  if (!open) return null;

  if (loading && !loaded) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        Yükleniyor...
      </div>
    );
  }

  return (
    <div className="px-4 pb-4 space-y-3">
      {/* BOM Items List */}
      {items.length > 0 ? (
        <div className="space-y-2">
          {items.map((item) => {
            const isEditing = editingId === item.step_bom_id;
            const isDeleting = deletingId === item.step_bom_id;

            return (
              <div
                key={item.step_bom_id}
                className="border rounded-md bg-background"
              >
                {isEditing ? (
                  /* ── Edit Mode ── */
                  <div className="p-3 space-y-3">
                    {/* Part Selector */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Parça / Alt Montaj
                      </label>
                      <Popover
                        open={editPartOpen}
                        onOpenChange={setEditPartOpen}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start text-xs h-8"
                          >
                            {editPartId ? (
                              <span className="truncate flex items-center gap-1">
                                {editPartId.startsWith("ASM-") && (
                                  <GitBranch className="h-3 w-3 text-blue-600 shrink-0" />
                                )}
                                <span className="font-mono">
                                  {editPartId}
                                </span>
                                <span className="text-muted-foreground">
                                  —
                                </span>
                                <span>{getPartDisplayName(editPartId)}</span>
                                {editPartId !== item.part_id && (
                                  <Badge
                                    variant="outline"
                                    className="ml-auto text-[10px] text-amber-600 border-amber-300"
                                  >
                                    Değiştirildi
                                  </Badge>
                                )}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">
                                Parça seçin...
                              </span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[350px] p-0"
                          align="start"
                        >
                          <PartComboboxContent
                            selectedPartId={editPartId}
                            onSelect={(partId) => {
                              setEditPartId(partId);
                              setEditPartOpen(false);
                            }}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Qty + Actions */}
                    <div className="flex items-end gap-2">
                      <div className="w-24">
                        <label className="text-xs text-muted-foreground mb-1 block">
                          Miktar
                        </label>
                        <Input
                          ref={editInputRef}
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="h-8 text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(item);
                            if (e.key === "Escape") cancelEdit();
                          }}
                        />
                      </div>
                      <div className="flex gap-1 ml-auto">
                        <Button
                          size="sm"
                          className="h-8"
                          onClick={() => saveEdit(item)}
                        >
                          <Check className="h-3.5 w-3.5 mr-1" />
                          Kaydet
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8"
                          onClick={cancelEdit}
                        >
                          <X className="h-3.5 w-3.5 mr-1" />
                          İptal
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── View Mode ── */
                  <div className="flex items-center gap-2 px-3 py-2">
                    {/* Part ID + Name */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {item.is_asm_reference ? (
                          <span className="flex items-center gap-1 text-blue-600 font-mono text-xs shrink-0">
                            <GitBranch className="h-3 w-3" />
                            {item.part_id}
                          </span>
                        ) : (
                          <span className="font-mono text-xs text-muted-foreground shrink-0">
                            {item.part_id}
                          </span>
                        )}
                        {item.is_asm_reference ? (
                          <Badge
                            variant="outline"
                            className="text-blue-600 border-blue-300 text-[10px] shrink-0"
                          >
                            Alt Montaj
                          </Badge>
                        ) : item.part_type ? (
                          <Badge
                            variant="secondary"
                            className="text-[10px] shrink-0"
                          >
                            {PART_TYPE_LABELS[
                              item.part_type as keyof typeof PART_TYPE_LABELS
                            ] || item.part_type}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm truncate mt-0.5">
                        {item.part_name}
                      </p>
                    </div>

                    {/* Qty */}
                    <span className="font-mono text-sm font-medium tabular-nums shrink-0 px-2">
                      ×{item.qty_per}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEdit(item)}
                        title="Düzenle"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            title="Sil"
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Malzemeyi Sil
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              <strong>{item.part_name}</strong> ({item.part_id})
                              malzemesini bu adımdan silmek istediğinize emin
                              misiniz?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDelete(item.step_bom_id)}
                            >
                              Sil
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">
          Bu adımda henüz malzeme bulunmuyor.
        </p>
      )}

      {/* Add BOM Item */}
      <div className="flex items-end gap-2 pt-2 border-t">
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
            <PopoverContent className="w-[350px] p-0" align="start">
              <PartComboboxContent
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
      </div>
    </div>
  );
}
