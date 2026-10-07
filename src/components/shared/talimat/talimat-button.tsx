"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Kesim / montaj / paketleme tablet ekranlarındaki "İş Talimatları" düğmesi */
export function TalimatButton() {
  return (
    <Button asChild variant="outline" className="h-12 px-4 text-base border-vw-primary text-vw-deep">
      <Link href="/uretim/talimatlarim">
        <ClipboardList className="mr-2 size-5" />
        İş Talimatları
      </Link>
    </Button>
  );
}
