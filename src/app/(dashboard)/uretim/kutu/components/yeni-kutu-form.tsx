"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { getActiveKutuParts, createKutuSession } from "../actions";
import { PART_TYPE_LABELS, type PartType } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  ChevronsUpDown,
  Check,
  Box,
  Send,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface KutuPart {
  part_id: string;
  part_adi: string;
  part_type: string;
  hazir_eleman_aktif_stok: number;
  hazir_eleman_kritik_stok: number;
}

function getStokLevel(aktif: number, kritik: number): "red" | "yellow" | "green" {
  if (aktif < kritik) return "red";
  if (aktif <= kritik * 1.5) return "yellow";
  return "green";
}

const stokLevelStyles = {
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", dot: "bg-red-500" },
  yellow: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", dot: "bg-amber-500" },
  green: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500" },
};

export function YeniKutuForm() {
  const router = useRouter();

  const [parts, setParts] = useState<KutuPart[]>([]);
  const [partsLoading, setPartsLoading] = useState(true);
  const [selectedPartId, setSelectedPartId] = useState("");
  const [comboOpen, setComboOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getActiveKutuParts().then((res) => {
      if (res.success) setParts(res.data);
      setPartsLoading(false);
    });
  }, []);

  const selectedPart = parts.find((p) => p.part_id === selectedPartId);

  const handleSubmit = async () => {
    if (!selectedPartId) {
      toast.error("Parça seçimi gereklidir");
      return;
    }
    if (qty < 1) {
      toast.error("Adet en az 1 olmalıdır");
      return;
    }

    setSubmitting(true);
    const result = await createKutuSession({
      part_id: selectedPartId,
      qty,
      not_text: notes.trim() || null,
    });

    if (!result.success) {
      toast.error(result.error);
      setSubmitting(false);
      return;
    }

    toast.success("Kutu üretim seansı oluşturuldu");
    router.push("/uretim/kutu");
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Box className="w-5 h-5" />
            Yeni Kutu-Koli Üretimi
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Parça seçimi */}
          <div>
            <Label>Parça (Kutu/Karton)</Label>
            {partsLoading ? (
              <Skeleton className="h-12 w-full mt-1" />
            ) : parts.length === 0 ? (
              <p className="text-sm text-muted-foreground mt-1">
                Kutu veya karton parçası bulunamadı.
              </p>
            ) : (
              <Popover open={comboOpen} onOpenChange={setComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboOpen}
                    className="w-full justify-between h-12 text-left mt-1"
                  >
                    {selectedPart
                      ? selectedPart.part_adi
                      : "Parça seçin..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Parça ara..." />
                    <CommandList>
                      <CommandEmpty>Parça bulunamadı</CommandEmpty>
                      <CommandGroup>
                        {parts.map((part) => {
                          const level = getStokLevel(part.hazir_eleman_aktif_stok, part.hazir_eleman_kritik_stok);
                          const styles = stokLevelStyles[level];
                          return (
                            <CommandItem
                              key={part.part_id}
                              value={`${part.part_id} ${part.part_adi}`}
                              onSelect={() => {
                                setSelectedPartId(part.part_id);
                                setComboOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedPartId === part.part_id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {part.part_adi}
                                </p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>{part.part_id}</span>
                                  <span>•</span>
                                  <span>{PART_TYPE_LABELS[part.part_type as PartType] ?? part.part_type}</span>
                                  <span>•</span>
                                  <span className={`flex items-center gap-1 ${styles.text}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${styles.dot}`} />
                                    Stok: {part.hazir_eleman_aktif_stok}
                                  </span>
                                </div>
                              </div>
                            </CommandItem>
                          );
                        })}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* Seçili parça bilgisi */}
          {selectedPart && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p className="font-medium">{selectedPart.part_adi}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-muted-foreground">{selectedPart.part_id}</span>
                <Badge variant="outline" className="text-xs">
                  {PART_TYPE_LABELS[selectedPart.part_type as PartType] ?? selectedPart.part_type}
                </Badge>
              </div>
              <div className="mt-2 flex items-center gap-2">
                {(() => {
                  const level = getStokLevel(selectedPart.hazir_eleman_aktif_stok, selectedPart.hazir_eleman_kritik_stok);
                  const styles = stokLevelStyles[level];
                  return (
                    <div className={`flex items-center gap-1.5 text-xs rounded px-2 py-1 ${styles.bg} ${styles.text} border ${styles.border}`}>
                      <span className={`w-2 h-2 rounded-full ${styles.dot}`} />
                      <span>Mevcut Stok: <strong>{selectedPart.hazir_eleman_aktif_stok}</strong></span>
                      <span className="text-muted-foreground">/ Kritik: {selectedPart.hazir_eleman_kritik_stok}</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Adet */}
          <div>
            <Label htmlFor="qty">Üretim Adedi</Label>
            <Input
              id="qty"
              type="number"
              min={1}
              max={1000}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(1000, parseInt(e.target.value) || 1)))}
              className="mt-1 w-32"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Tamamlandığında bu miktar parça stoğa eklenecek.
            </p>
          </div>

          {/* Not */}
          <div>
            <Label htmlFor="notes">Not (isteğe bağlı)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Üretim notu..."
              className="mt-1"
              maxLength={500}
            />
          </div>

          {/* Submit */}
          <Button
            className="w-full h-14 text-base"
            onClick={handleSubmit}
            disabled={!selectedPartId || qty < 1 || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <Send className="w-5 h-5 mr-2" />
                Seans Oluştur
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
