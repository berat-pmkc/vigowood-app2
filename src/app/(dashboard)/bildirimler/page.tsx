import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";

export default function BildirimlerPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-50">
            <Bell className="h-8 w-8 text-vw-warning" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Bildirimler</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Uygulama ici bildirim sistemi burada yer alacak.
          </p>
          <Badge variant="outline" className="mt-4">
            Katman 22
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
