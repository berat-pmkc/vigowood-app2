"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, Trash2, Loader2, Search, ChevronsUpDown, Check } from "lucide-react";
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
  getAllPlakalar,
  getAllPartsForSelect,
  getPlakaParts,
  updatePlakaPart,
  addPlakaPart,
  deletePlakaPart,
} from "../actions";
import { toast } from "sonner";

interface PlakaOption {
  plaka_id: string;
  plaka_adi: string;
  sku: string[] | null;
}

interface PlakaPartRow {
  ppart_id: string;
  part_id: string;
  part_adi: string;
  default_qty: number | null;
}

interface PlakaParcalariViewProps {
  initialPlaka: string;
}

export function PlakaParcalariView({ initialPlaka }: PlakaParcalariViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Plaka selector state
  const [plakalar, setPlakalar] = useState<PlakaOption[]>([]);
  const [plakaOpen, setPlakaOpen] = useState(false);
  const [selectedPlaka, setSelectedPlaka] = useState<string>(initialPlaka);
  const [selectedPlakaObj, setSelectedPlakaObj] = useState<PlakaOption | null>(null);
  const [plakaLoading, setPlakaLoading] = useState(true);

  // Parts state
  const [parts, setParts] = useState<PlakaPartRow[]>([]);
  const [partsLoading, setPartsLoading] = useState(false);

  // All parts for combobox
  const [allParts, setAllParts] = useState<{ part_id: string; part_adi: string }[]>([]);
  const [allPartsLoading, setAllPartsLoading] = useState(true);

  // New part form
  const [newPartId, setNewPartId] = useState("");
  const [newQty, setNewQty] = useState("");
  const [partSelectOpen, setPartSelectOpen] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState("");

  // Load all plakalar for selector + all parts for combobox
  useEffect(() => {
    async function load() {
      setPlakaLoading(true);
      setAllPartsLoading(true);

      const [plakaResult, partsResult] = await Promise.all([
        getAllPlakalar(),
        getAllPartsForSelect(),
      ]);

      if (plakaResult.success) {
        setPlakalar(plakaResult.data);
        if (initialPlaka) {
          const found = plakaResult.data.find((p) => p.plaka_id === initialPlaka);
          if (found) setSelectedPlakaObj(found);
        }
      } else {
        toast.error(plakaResult.error);
      }

      if (partsResult.success) {
        setAllParts(partsResult.data);
      }

      setPlakaLoading(false);
      setAllPartsLoading(false);
    }
    load();
  }, [initialPlaka]);

  // Load parts when plaka changes
  const loadParts = useCallback(async (plakaId: string) => {
    if (!plakaId) {
      setParts([]);
      return;
    }
    setPartsLoading(true);
    const result = await getPlakaParts(plakaId);
    if (result.success) {
      setParts(result.data);
    } else {
      toast.error(result.error);
    }
    setPartsLoading(false);
  }, []);

  useEffect(() => {
    if (selectedPlaka) {
      loadParts(selectedPlaka);
    } else {
      setParts([]);
    }
  }, [selectedPlaka, loadParts]);

  const handleSelectPlaka = (plakaId: string) => {
    setSelectedPlaka(plakaId);
    const found = plakalar.find((p) => p.plaka_id === plakaId);
    setSelectedPlakaObj(found || null);
    setPlakaOpen(false);

    // Update URL
    const params = new URLSearchParams(searchParams.toString());
    params.set("plaka", plakaId);
    router.push(`/admin/plakalar?${params.toString()}`);
  };

  const handleAdd = () => {
    if (!newPartId.trim()) {
      toast.error("Parça ID gereklidir");
      return;
    }
    if (!selectedPlaka) {
      toast.error("Önce bir plaka seçin");
      return;
    }

    startTransition(async () => {
      const result = await addPlakaPart(selectedPlaka, selectedPlakaObj?.sku?.[0] ?? null, {
        part_id: newPartId.trim(),
        default_qty: newQty ? Number(newQty) : null,
      });
      if (result.success) {
        toast.success("Parça eklendi");
        setNewPartId("");
        setNewQty("");
        await loadParts(selectedPlaka);
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
        await loadParts(selectedPlaka);
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
        await loadParts(selectedPlaka);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Plaka Selector */}
      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium">Plaka Seçin</label>
          <Popover open={plakaOpen} onOpenChange={setPlakaOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={plakaOpen}
                className="w-full justify-between"
                disabled={plakaLoading}
              >
                {plakaLoading ? (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Yükleniyor...
                  </span>
                ) : selectedPlakaObj ? (
                  <span>
                    <span className="font-mono text-xs mr-2">{selectedPlakaObj.plaka_id}</span>
                    {selectedPlakaObj.plaka_adi}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Plaka seçin...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Plaka ara..." />
                <CommandList>
                  <CommandEmpty>Plaka bulunamadı.</CommandEmpty>
                  <CommandGroup>
                    {plakalar.map((p) => (
                      <CommandItem
                        key={p.plaka_id}
                        value={`${p.plaka_id} ${p.plaka_adi}`}
                        onSelect={() => handleSelectPlaka(p.plaka_id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedPlaka === p.plaka_id
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                        <span className="font-mono text-xs mr-2 text-muted-foreground">
                          {p.plaka_id}
                        </span>
                        <span className="flex-1 truncate">{p.plaka_adi}</span>
                        {p.sku && (
                          <span className="text-xs text-muted-foreground ml-2">
                            {p.sku}
                          </span>
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* No plaka selected */}
      {!selectedPlaka && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Search className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">Parçalarını yönetmek için yukarıdan bir plaka seçin</p>
        </div>
      )}

      {/* Parts table */}
      {selectedPlaka && (
        <>
          {partsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">
                Parçalar yükleniyor...
              </span>
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">
                Plaka Parçaları ({parts.length})
              </h3>

              {parts.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[140px]">Parça ID</TableHead>
                        <TableHead>Parça Adı</TableHead>
                        <TableHead className="w-[100px] text-right">Miktar</TableHead>
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
                                className="h-7 w-[80px] text-right ml-auto"
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
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Bu plakada henüz parça tanımlı değil.
                </p>
              )}

              {/* Add new part */}
              <div className="flex items-end gap-2 pt-2">
                <div className="flex-1 space-y-1">
                  <label className="text-xs text-muted-foreground">Parça Seçin</label>
                  <Popover open={partSelectOpen} onOpenChange={setPartSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={partSelectOpen}
                        className="w-full justify-between h-9 text-sm font-normal"
                        disabled={allPartsLoading}
                      >
                        {allPartsLoading ? (
                          <span className="text-muted-foreground">Yükleniyor...</span>
                        ) : newPartId ? (
                          <span className="truncate">
                            <span className="font-mono text-xs mr-1.5">{newPartId}</span>
                            {allParts.find((p) => p.part_id === newPartId)?.part_adi ?? ""}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Parça seçin...</span>
                        )}
                        <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[350px] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Parça ara (ID veya ad)..." />
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
                                    "mr-2 h-4 w-4",
                                    newPartId === part.part_id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                <span className="font-mono text-xs mr-2 text-muted-foreground">
                                  {part.part_id}
                                </span>
                                <span className="flex-1 truncate">{part.part_adi}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-[100px] space-y-1">
                  <label className="text-xs text-muted-foreground">Miktar</label>
                  <Input
                    type="number"
                    placeholder="1"
                    value={newQty}
                    onChange={(e) => setNewQty(e.target.value)}
                    className="h-9 text-sm"
                    min={0}
                    step="any"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={isPending || !newPartId.trim()}
                  className="h-9"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Ekle
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
