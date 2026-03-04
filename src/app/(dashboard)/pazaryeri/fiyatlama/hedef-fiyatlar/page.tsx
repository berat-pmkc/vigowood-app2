import { getAllProductsWithTargetPrices } from "../actions";
import { HedefFiyatlarClient } from "./components/hedef-fiyatlar-client";

export default async function HedefFiyatlarPage() {
  const { products, targetPrices } = await getAllProductsWithTargetPrices();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Hedef Fiyatlar</h1>
        <p className="text-sm text-muted-foreground">
          SKU bazlı perakende ve toptan hedef fiyatları yönetin. Satıra tıklayarak fiyat girin.
        </p>
      </div>

      <HedefFiyatlarClient
        products={products}
        targetPrices={targetPrices}
      />
    </div>
  );
}
