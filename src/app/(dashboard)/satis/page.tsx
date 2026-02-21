import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";

export default function SatisPage() {
  return (
    <div className="px-4 pb-6 sm:px-6">
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Satis Modulu</h2>
          <p className="text-muted-foreground text-sm">
            Katman 19 - Gelistirme asamasinda
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
