"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Target } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { deletePazarlama } from "../actions";
import { PazarlamaEditSheet } from "./pazarlama-edit-sheet";
import type { BasariEsikleri } from "@/lib/sales-settings";

const AY_LABELS: Record<number, string> = {
  1: "Ocak", 2: "Şubat", 3: "Mart", 4: "Nisan",
  5: "Mayıs", 6: "Haziran", 7: "Temmuz", 8: "Ağustos",
  9: "Eylül", 10: "Ekim", 11: "Kasım", 12: "Aralık",
};

export interface PazarlamaRow {
  id: string;
  kodu: string;
  yil: number;
  ay: number;
  pazaryeri: string;
  hedef_ciro: number;
  gercek_ciro: number;
  siparis_sayisi: number;
  ziyaretci: number;
  donusum_orani: number;
  iadeler: number;
  ortalama_sepet: number | null;
  reklam_harcamasi: number | null;
  not_text: string | null;
}

interface PazarlamaClientProps {
  rows: PazarlamaRow[];
  pazaryeriSecenekleri: string[];
  basariEsikleri: BasariEsikleri;
}

export function PazarlamaClient({ rows, pazaryeriSecenekleri, basariEsikleri }: PazarlamaClientProps) {
  const [editRow, setEditRow] = useState<PazarlamaRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filterYear, setFilterYear] = useState<string>("tumu");
  const [filterPazaryeri, setFilterPazaryeri] = useState<string>("tumu");

  const years = [...new Set(rows.map((r) => r.yil))].sort((a, b) => b - a);

  const filtered = rows.filter((r) => {
    if (filterYear !== "tumu" && r.yil !== Number(filterYear)) return false;
    if (filterPazaryeri !== "tumu" && r.pazaryeri !== filterPazaryeri) return false;
    return true;
  });

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const result = await deletePazarlama(id);
      if (result.success) toast.success("Kayıt silindi");
      else toast.error(result.error);
    } catch {
      toast.error("Silme sırasında hata oluştu");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">TR Pazarlama</h1>
          <p className="text-sm text-muted-foreground">Aylık pazaryeri KPI takibi</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditRow(null); setIsNew(true); }}>
          <Plus className="h-4 w-4" />Yeni Kayıt
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue placeholder="Yıl" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tumu">Tüm Yıllar</SelectItem>
            {years.map((y) => (<SelectItem key={y} value={String(y)}>{y}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterPazaryeri} onValueChange={setFilterPazaryeri}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Pazaryeri" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="tumu">Tüm Pazaryerleri</SelectItem>
            {pazaryeriSecenekleri.map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Kayıt bulunamadı.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dönem</TableHead>
                <TableHead>Pazaryeri</TableHead>
                <TableHead className="text-right">Hedef Ciro</TableHead>
                <TableHead className="text-right">Gerçek Ciro</TableHead>
                <TableHead className="text-right">Sipariş</TableHead>
                <TableHead className="text-right">Ziyaretçi</TableHead>
                <TableHead className="text-right">CR %</TableHead>
                <TableHead className="text-right">İade</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const achieveRate = r.hedef_ciro > 0 ? (r.gercek_ciro / r.hedef_ciro) * 100 : 0;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{AY_LABELS[r.ay]} {r.yil}</TableCell>
                    <TableCell>{r.pazaryeri}</TableCell>
                    <TableCell className="text-right">₺{formatNumber(Math.round(r.hedef_ciro))}</TableCell>
                    <TableCell className="text-right">
                      <span className={achieveRate >= basariEsikleri.success ? "text-vw-success font-medium" : achieveRate >= basariEsikleri.warning ? "text-vw-warning" : "text-vw-error"}>
                        ₺{formatNumber(Math.round(r.gercek_ciro))}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(r.siparis_sayisi)}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.ziyaretci)}</TableCell>
                    <TableCell className="text-right">%{r.donusum_orani.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{formatNumber(r.iadeler)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditRow(r); setIsNew(false); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" disabled={deleting === r.id}>
                              {deleting === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Kaydı Sil</AlertDialogTitle>
                              <AlertDialogDescription>{AY_LABELS[r.ay]} {r.yil} - {r.pazaryeri} kaydını silmek istediğinize emin misiniz?</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>İptal</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sil</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <PazarlamaEditSheet open={isNew || !!editRow} onClose={() => { setEditRow(null); setIsNew(false); }} row={editRow} pazaryeriSecenekleri={pazaryeriSecenekleri} />
    </div>
  );
}
