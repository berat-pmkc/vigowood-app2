"use client";

import { useState } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Loader2, Megaphone, ToggleLeft, ToggleRight } from "lucide-react";
import { formatDate, formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { deleteKampanya, toggleKampanyaAktif } from "../actions";
import { KampanyaEditSheet } from "./kampanya-edit-sheet";

export interface KampanyaRow {
  id: string;
  kodu: string;
  kampanya_adi: string;
  baslangic_tarihi: string;
  bitis_tarihi: string;
  ana_hedef: string | null;
  ziyaretci: number | null;
  siparis_sayisi: number | null;
  ciro: number | null;
  donusum_orani: number | null;
  ortalama_sepet: number | null;
  notlar: string | null;
  aktif_mi: boolean;
}

export function KampanyalarClient({ kampanyalar }: { kampanyalar: KampanyaRow[] }) {
  const [editRow, setEditRow] = useState<KampanyaRow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const result = await deleteKampanya(id);
      if (result.success) toast.success("Kampanya silindi");
      else toast.error(result.error);
    } catch {
      toast.error("Silme sırasında hata oluştu");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggle(id: string, currentAktif: boolean) {
    setToggling(id);
    try {
      const result = await toggleKampanyaAktif(id, !currentAktif);
      if (result.success) toast.success(currentAktif ? "Kampanya pasif yapıldı" : "Kampanya aktif yapıldı");
      else toast.error(result.error);
    } catch {
      toast.error("İşlem sırasında hata oluştu");
    } finally {
      setToggling(null);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Kampanyalar</h1>
          <p className="text-sm text-muted-foreground">Kampanya takibi ve performans analizi</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => { setEditRow(null); setIsNew(true); }}>
          <Plus className="h-4 w-4" />Yeni Kampanya
        </Button>
      </div>

      {kampanyalar.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Megaphone className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <p className="text-muted-foreground">Henüz kampanya eklenmemiş.</p>
        </div>
      ) : (
        <div className="overflow-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kampanya</TableHead>
                <TableHead>Başlangıç</TableHead>
                <TableHead>Bitiş</TableHead>
                <TableHead className="text-right">Ziyaretçi</TableHead>
                <TableHead className="text-right">Sipariş</TableHead>
                <TableHead className="text-right">Ciro</TableHead>
                <TableHead className="text-right">CR %</TableHead>
                <TableHead>Durum</TableHead>
                <TableHead className="text-right">İşlem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kampanyalar.map((k) => (
                <TableRow key={k.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{k.kampanya_adi}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{k.kodu}</span>
                    </div>
                    {k.ana_hedef && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">{k.ana_hedef}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(k.baslangic_tarihi)}</TableCell>
                  <TableCell className="text-sm">{formatDate(k.bitis_tarihi)}</TableCell>
                  <TableCell className="text-right">{k.ziyaretci != null ? formatNumber(k.ziyaretci) : "—"}</TableCell>
                  <TableCell className="text-right">{k.siparis_sayisi != null ? formatNumber(k.siparis_sayisi) : "—"}</TableCell>
                  <TableCell className="text-right">{k.ciro != null ? `₺${formatNumber(Math.round(k.ciro))}` : "—"}</TableCell>
                  <TableCell className="text-right">{k.donusum_orani != null ? `%${k.donusum_orani.toFixed(1)}` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={k.aktif_mi ? "default" : "secondary"} className="text-xs">
                      {k.aktif_mi ? "Aktif" : "Pasif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggle(k.id, k.aktif_mi)}
                        disabled={toggling === k.id}
                        title={k.aktif_mi ? "Pasif Yap" : "Aktif Yap"}
                      >
                        {toggling === k.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : k.aktif_mi ? (
                          <ToggleRight className="h-4 w-4 text-vw-success" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => { setEditRow(k); setIsNew(false); }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            disabled={deleting === k.id}
                          >
                            {deleting === k.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Kampanyayı Sil</AlertDialogTitle>
                            <AlertDialogDescription>
                              &quot;{k.kampanya_adi}&quot; kampanyasını silmek istediğinize emin misiniz?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>İptal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(k.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Sil
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <KampanyaEditSheet
        open={isNew || !!editRow}
        onClose={() => { setEditRow(null); setIsNew(false); }}
        row={editRow}
      />
    </div>
  );
}
