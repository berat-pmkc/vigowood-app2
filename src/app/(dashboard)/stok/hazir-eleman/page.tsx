import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Component } from "lucide-react";

export default function HazirElemanPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <Component className="h-8 w-8 text-vw-success" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Hazir Eleman Stok</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Kritik stok uyarilari, stok giris islemleri ve eleman takibi burada yer alacak.
          </p>
          <Badge variant="outline" className="mt-4">
            Katman 17
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
