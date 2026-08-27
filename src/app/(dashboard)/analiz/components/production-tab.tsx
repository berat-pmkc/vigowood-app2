"use client";

import dynamic from "next/dynamic";
import { ChartSkeleton } from "@/components/shared/chart-skeleton";
import type { ProductionKpiData } from "./production-kpi-cards";
import type { DailyProductionData } from "./production-daily-chart";
import type { EfficiencyData } from "./production-efficiency";
import type { LaborCostData } from "./production-labor-cost";
import type { MontajOzet, MontajOperator, MontajGun } from "./montaj-analiz";

const MontajAnaliz = dynamic(
  () => import("./montaj-analiz").then((m) => ({ default: m.MontajAnaliz })),
  { ssr: false, loading: () => <ChartSkeleton /> },
);

interface ProductionTabProps {
  kpiData: ProductionKpiData;
  dailyData: DailyProductionData[];
  efficiencyData: EfficiencyData[];
  laborCost: LaborCostData;
  montajOzet: MontajOzet;
  montajOperatorler: MontajOperator[];
  montajGunluk: MontajGun[];
}

export function ProductionTab({
  montajOzet,
  montajOperatorler,
  montajGunluk,
}: ProductionTabProps) {
  return (
    <MontajAnaliz
      ozet={montajOzet}
      operatorler={montajOperatorler}
      gunluk={montajGunluk}
    />
  );
}
