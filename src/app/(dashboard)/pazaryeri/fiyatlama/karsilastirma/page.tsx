import { getCrossMarketplaceComparison } from "../actions";
import { KarsilastirmaClient } from "./components/karsilastirma-client";

export default async function KarsilastirmaPage() {
  const data = await getCrossMarketplaceComparison();

  return <KarsilastirmaClient data={data} />;
}
