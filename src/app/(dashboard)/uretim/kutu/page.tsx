import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Box } from "lucide-react";

export default function KutuKoliPage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center pb-20 md:pb-6">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-8 pb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-50">
            <Box className="h-8 w-8 text-vw-warning" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Kutu - Koli</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted-foreground">
            Kutu kesim, uretim ve stok takibi burada yer alacak.
          </p>
          <Badge variant="outline" className="mt-4">
            Katman 14
          </Badge>
        </CardContent>
      </Card>
    </div>
  );
}
