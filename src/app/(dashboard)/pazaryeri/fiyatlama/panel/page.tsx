import { getMarketplaces } from "../actions";
import { PricingPanelClient } from "./components/pricing-panel-client";

export default async function PricingPanelPage() {
  const marketplaces = await getMarketplaces();

  return <PricingPanelClient marketplaces={marketplaces} />;
}
