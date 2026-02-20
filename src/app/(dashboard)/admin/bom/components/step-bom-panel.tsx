"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Trash2, GitBranch, Pencil, Check, X, Plus } from "lucide-react";
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
  allParts: { part_id: string; part_adi: string | null; part_type: string | null }[];
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

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState<string>("");
  const editInputRef = useRef<HTMLInputElement>(null);

  // Add form state
  const [addPartId, setAddPartId] = useState("");
  const [addQty, setAddQty] = useState("1");
  const [addOpen, setAddOpen] = useState(false);
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    if (open && !loaded) {
      loadBom();
    }
  }, [open]);

  async function loadBom() {
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
  }

  async function handleDelete(stepBomId: string) {
    const result = await deleteBomItem(stepBomId);
    if (result.success) {
      const newItems = items.filter((i) => i.step_bom_id !== stepBomId);
      setItems(newItems);
      onBomCountChange?.(newItems.length);
      toast.success("Malzeme silindi");
    } else {
      toast.error(result.error);
    }
  }

  function startEdit(item: StepBomItem) {
    setEditingId(item.step_bom_id);
    setEditQty(String(item.qty_per));
    setTimeout(() => editInputRef.current?.focus(), 50);
  }

  async function saveEdit(item: StepBomItem) {
    const qty = parseFloat(editQty);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Miktar 0'dan büyük olmalıdır");
      return;
    }

    const result = await updateBomItem(item.step_bom_id, {
      part_id: item.part_id,
      qty_per: qty,
    });

    if (result.success) {
      setItems(
        items.map((i) =>
          i.step_bom_id === item.step_bom_id ? { ...i, qty_per: qty } : i
        )
      );
      setEditingId(null);
      toast.success("Miktar güncellendi");
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
    const result = await addBomItem(stepId, null, {
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
      {/* BOM Items Table */}
      {items.length > 0 ? (
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-3 py-2 font-medium">ID</th>
                <th className="text-left px-3 py-2 font-medium">Ad</th>
                <th className="text-left px-3 py-2 font-medium hidden sm:table-cell">Tip</th>
                <th className="text-right px-3 py-2 font-medium">Miktar</th>
                <th className="text-right px-3 py-2 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.step_bom_id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2 font-mono text-xs">
                    {item.is_asm_reference ? (
                      <span className="flex items-center gap-1 text-blue-600">
                        <GitBranch className="h-3 w-3" />
                        {item.part_id}
                      </span>
                    ) : (
                      item.part_id
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className="truncate block max-w-[200px]">
                      {item.part_name}
                    </span>
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    {item.is_asm_reference ? (
                      <Badge variant="outline" className="text-blue-600 border-blue-300">
                        Alt Montaj
                      </Badge>
                    ) : item.part_type ? (
                      <Badge variant="secondary" className="text-xs">
                        {PART_TYPE_LABELS[item.part_type as keyof typeof PART_TYPE_LABELS] || item.part_type}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {editingId === item.step_bom_id ? (
                      <div className="flex items-center gap-1 justify-end">
                        <Input
                          ref={editInputRef}
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="w-20 h-7 text-right text-xs"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") saveEdit(item);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => saveEdit(item)}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        className="font-mono text-xs hover:underline cursor-pointer px-1"
                        onClick={() => startEdit(item)}
                        title="Tıkla ve düzenle"
                      >
                        {item.qty_per}
                        <Pencil className="h-3 w-3 ml-1 inline opacity-40" />
                      </button>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(item.step_bom_id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
                  <span className="truncate">
                    {addPartId.startsWith("ASM-") ? (
                      <span className="flex items-center gap-1">
                        <GitBranch className="h-3 w-3 text-blue-600" />
                        {addPartId} —{" "}
                        {asmOptions.find((s) => s.step_id === addPartId)
                          ?.step_name || ""}
                      </span>
                    ) : (
                      <>
                        {addPartId} —{" "}
                        {allParts.find((p) => p.part_id === addPartId)
                          ?.part_adi || ""}
                      </>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">
                    Parça veya alt montaj seçin...
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[350px] p-0" align="start">
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
                          onSelect={() => {
                            setAddPartId(step.step_id);
                            setAddOpen(false);
                          }}
                        >
                          <GitBranch className="mr-2 h-3 w-3 text-blue-600" />
                          <span className="font-mono text-xs mr-2">
                            {step.step_id}
                          </span>
                          <span className="truncate">
                            {step.step_name}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  )}
                  <CommandGroup heading="Parçalar">
                    {allParts.map((part) => (
                      <CommandItem
                        key={part.part_id}
                        value={`${part.part_id} ${part.part_adi ?? ""}`}
                        onSelect={() => {
                          setAddPartId(part.part_id);
                          setAddOpen(false);
                        }}
                      >
                        <span className="font-mono text-xs mr-2">
                          {part.part_id}
                        </span>
                        <span className="truncate">{part.part_adi}</span>
                        {part.part_type && (
                          <Badge variant="secondary" className="ml-auto text-[10px]">
                            {PART_TYPE_LABELS[part.part_type as keyof typeof PART_TYPE_LABELS] || part.part_type}
                          </Badge>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
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
