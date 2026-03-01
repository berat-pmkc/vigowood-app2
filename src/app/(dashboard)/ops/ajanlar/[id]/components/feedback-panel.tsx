"use client";

import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export function FeedbackPanel() {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">Henüz geri bildirim yok</p>
        <p className="text-xs text-muted-foreground mt-1">
          Geri bildirim sistemi yakında aktif olacak
        </p>
      </CardContent>
    </Card>
  );
}
