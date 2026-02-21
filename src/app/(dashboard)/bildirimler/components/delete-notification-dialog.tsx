"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { deleteNotification } from "../actions";
import { toast } from "sonner";

type DeleteNotificationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notifId: string | null;
};

export function DeleteNotificationDialog({
  open,
  onOpenChange,
  notifId,
}: DeleteNotificationDialogProps) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!notifId) return;
    setLoading(true);

    const result = await deleteNotification(notifId);

    setLoading(false);

    if (result.success) {
      toast.success("Bildirim silindi");
      onOpenChange(false);
    } else {
      toast.error(result.error);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Bildirimi Sil</AlertDialogTitle>
          <AlertDialogDescription>
            Bu bildirim kalıcı olarak silinecek. Bu işlem geri alınamaz.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>İptal</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sil
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
