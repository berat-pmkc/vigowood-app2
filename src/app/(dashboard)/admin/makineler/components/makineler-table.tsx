"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Cog } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { MAKINE_BOLUM_COLORS, type MakineBolum } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { deleteMakine, updateMakine } from "../actions";
import { MakineEditSheet } from "./makine-edit-sheet";

interface Makine {
  makine_id: string;
  tipi: string;
  bolum: string;
  aciklama: string | null;
  aktif: boolean;
  created_at: string;
  updated_at: string;
}

interface MakinelerTableProps {
  data: Makine[];
}

export function MakinelerTable({ data }: MakinelerTableProps) {
  const router = useRouter();
  const [editMakine, setEditMakine] = useState<Makine | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Makine | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = () => {
    setEditMakine(null);
    setSheetOpen(true);
  };

  const handleEdit = (makine: Makine) => {
    setEditMakine(makine);
    setSheetOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteMakine(deleteTarget.makine_id);
      if (result.success) {
        toast.success("Makine silindi");
        setDeleteTarget(null);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleToggleAktif = async (makine: Makine) => {
    const result = await updateMakine(makine.makine_id, {
      tipi: makine.tipi,
      bolum: makine.bolum,
      aciklama: makine.aciklama,
      aktif: !makine.aktif,
    });
    if (result.success) {
      toast.success(makine.aktif ? "Makine pasife alındı" : "Makine aktife alındı");
      router.refresh();
    } else {
      toast.error(result.error);
    }
  };

  const bolumColors = (bolum: string) => {
    const colors = MAKINE_BOLUM_COLORS[bolum as MakineBolum];
    return colors ?? { bg: "bg-gray-100", text: "text-gray-800" };
  };

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-muted-foreground">
            Toplam {data.length} makine
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="h-4 w-4 mr-1.5" />
          Yeni Makine
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Makine ID</TableHead>
              <TableHead>Tipi</TableHead>
              <TableHead className="w-[120px]">Bölüm</TableHead>
              <TableHead>Açıklama</TableHead>
              <TableHead className="w-[80px] text-center">Aktif</TableHead>
              <TableHead className="w-[100px] text-right">İşlem</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Cog className="h-8 w-8 text-muted-foreground/50" />
                    <p>Henüz makine eklenmemiş</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((makine) => {
                const colors = bolumColors(makine.bolum);
                return (
                  <TableRow key={makine.makine_id} className={cn(!makine.aktif && "opacity-50")}>
                    <TableCell className="font-mono font-semibold">
                      {makine.makine_id}
                    </TableCell>
                    <TableCell>{makine.tipi}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(colors.bg, colors.text, "border-0")}>
                        {makine.bolum}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {makine.aciklama || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={makine.aktif}
                        onCheckedChange={() => handleToggleAktif(makine)}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(makine)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(makine)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit/Create Sheet */}
      <MakineEditSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        makine={editMakine}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Makineyi Sil</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.makine_id}</strong> ({deleteTarget?.tipi}) makinesini silmek
              istediğinize emin misiniz? Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Siliniyor..." : "Sil"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
