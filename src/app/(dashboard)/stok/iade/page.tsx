import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";

export default function IadeGirisPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50">
            <RotateCcw className="h-8 w-8 text-vw-error" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Iade Giris</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Iade urun giris islemleri ve takibi burada yer alacak.
          </p>
          <Badge variant="outline" className="mt-4">
            Katman 17
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
