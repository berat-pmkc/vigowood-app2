"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Trash2, Loader2, ChevronsUpDown, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { cn } from "@/lib/utils";
import {
  getAllPartsForSelect,
  getPlakaParts,
  updatePlakaPart,
  addPlakaPart,
  deletePlakaPart,
} from "../actions";
import { toast } from "sonner";

interface PlakaPartRow {
  ppart_id: string;
  part_id: string;
  part_adi: string;
  default_qty: number | null;
}

interface PlakaPartsPanelProps {
  plakaId: string;
  sku: string | null;
  open: boolean;
}

export function PlakaPartsPanel({ plakaId, sku, open }: PlakaPartsPanelProps) {
  const [parts, setParts] = useState<PlakaPartRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // All parts for combobox
  const [allParts, setAllParts] = useState<{ part_id: string; part_adi: string }[]>([]);
  const [allPartsLoaded, setAllPartsLoaded] = useState(false);

  // New part form
  const [newPartId, setNewPartId] = useState("");
  const [newQty, setNewQty] = useState("");
  const [partSelectOpen, setPartSelectOpen] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  useEffect(() => {
    if (open && plakaId) {
      loadParts();
      if (!allPartsLoaded) {
        getAllPartsForSelect().then((result) => {
          if (result.success) setAllParts(result.data);
          setAllPartsLoaded(true);
        });
      }
    }
  }, [open, plakaId, allPartsLoaded]);

  const loadParts = async () => {
    setLoading(true);
    const result = await getPlakaParts(plakaId);
    if (result.success) {
      setParts(result.data);
    } else {
      toast.error(result.error);
    }
    setLoading(false);
  };

  const handleAdd = () => {
    if (!newPartId.trim()) {
      toast.error("Parça ID gereklidir");
      return;
    }

    startTransition(async () => {
      const result = await addPlakaPart(plakaId, sku, {
        part_id: newPartId.trim(),
        default_qty: newQty ? Number(newQty) : null,
      });
      if (result.success) {
        toast.success("Parça eklendi");
        setNewPartId("");
        setNewQty("");
        await loadParts();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleUpdate = (ppartId: string, partId: string) => {
    startTransition(async () => {
      const result = await updatePlakaPart(ppartId, {
        part_id: partId,
        default_qty: editQty ? Number(editQty) : null,
      });
      if (result.success) {
        toast.success("Miktar güncellendi");
        setEditingId(null);
        await loadParts();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleDelete = (ppartId: string) => {
    startTransition(async () => {
      const result = await deletePlakaPart(ppartId);
      if (result.success) {
        toast.success("Parça silindi");
        await loadParts();
      } else {
        toast.error(result.error);
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">
          Parçalar yükleniyor...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">
        Plaka Parçaları ({parts.length})
      </h3>

      {parts.length > 0 ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Parça ID</TableHead>
                <TableHead>Parça Adı</TableHead>
                <TableHead className="w-[90px] text-right">Miktar</TableHead>
                <TableHead className="w-[70px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {parts.map((part) => (
                <TableRow key={part.ppart_id}>
                  <TableCell className="font-mono text-xs">
                    {part.part_id}
                  </TableCell>
                  <TableCell className="text-sm">{part.part_adi}</TableCell>
                  <TableCell className="text-right">
                    {editingId === part.ppart_id ? (
                      <Input
                        type="number"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value)}
                        onBlur={() =>
                          handleUpdate(part.ppart_id, part.part_id)
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleUpdate(part.ppart_id, part.part_id);
                          }
                          if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        className="h-7 w-[70px] text-right ml-auto"
                        min={0}
                        step="any"
                        autoFocus
                      />
                    ) : (
                      <span
                        className="font-mono text-sm cursor-pointer hover:underline"
                        onClick={() => {
                          setEditingId(part.ppart_id);
                          setEditQty(
                            part.default_qty != null
                              ? String(part.default_qty)
                              : ""
                          );
                        }}
                      >
                        {part.default_qty != null ? part.default_qty : "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(part.ppart_id)}
                      disabled={isPending}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-2">
          Bu plakada henüz parça tanımlı değil.
        </p>
      )}

      {/* Add new part */}
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Parça Seçin</label>
          <Popover open={partSelectOpen} onOpenChange={setPartSelectOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={partSelectOpen}
                className="w-full justify-between h-8 text-sm font-normal"
                disabled={!allPartsLoaded}
              >
                {!allPartsLoaded ? (
                  <span className="text-muted-foreground">Yükleniyor...</span>
                ) : newPartId ? (
                  <span className="truncate">
                    <span className="font-mono text-xs mr-1">{newPartId}</span>
                    {allParts.find((p) => p.part_id === newPartId)?.part_adi ?? ""}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Parça seçin...</span>
                )}
                <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Parça ara..." />
                <CommandList>
                  <CommandEmpty>Parça bulunamadı.</CommandEmpty>
                  <CommandGroup>
                    {allParts.map((part) => (
                      <CommandItem
                        key={part.part_id}
                        value={`${part.part_id} ${part.part_adi}`}
                        onSelect={() => {
                          setNewPartId(part.part_id);
                          setPartSelectOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-3.5 w-3.5",
                            newPartId === part.part_id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <span className="font-mono text-xs mr-1.5 text-muted-foreground">
                          {part.part_id}
                        </span>
                        <span className="flex-1 truncate text-sm">{part.part_adi}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="w-[90px] space-y-1">
          <label className="text-xs text-muted-foreground">Miktar</label>
          <Input
            type="number"
            placeholder="1"
            value={newQty}
            onChange={(e) => setNewQty(e.target.value)}
            className="h-8 text-sm"
            min={0}
            step="any"
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={isPending || !newPartId.trim()}
          className="h-8"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Ekle
        </Button>
      </div>
    </div>
  );
}
