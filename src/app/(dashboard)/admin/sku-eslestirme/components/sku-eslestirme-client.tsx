"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MappingsTab } from "./mappings-tab";
import { UnmatchedTab } from "./unmatched-tab";
import { SummaryTab } from "./summary-tab";

interface Stats {
  totalMasterSku: number;
  totalMatched: number;
  totalUnmatched: number;
  total: number;
  matchRate: number;
  channels: {
    trendyol: { total: number; matched: number; unmatched: number };
    ikas: { total: number; matched: number; unmatched: number };
  };
}

interface SkuEslestirmeClientProps {
  stats: Stats;
}

export function SkuEslestirmeClient({ stats }: SkuEslestirmeClientProps) {
  return (
    <Tabs defaultValue="eslesmeler" className="space-y-4">
      <TabsList>
        <TabsTrigger value="eslesmeler">Eşleşmeler</TabsTrigger>
        <TabsTrigger value="eslesmeyenler">
          Eşleşmeyenler
          {stats.totalUnmatched > 0 && (
            <span className="ml-1.5 rounded-full bg-vw-error/20 px-1.5 py-0.5 text-xs text-vw-error">
              {stats.totalUnmatched}
            </span>
          )}
        </TabsTrigger>
        <TabsTrigger value="ozet">Özet</TabsTrigger>
      </TabsList>

      <TabsContent value="eslesmeler">
        <MappingsTab />
      </TabsContent>

      <TabsContent value="eslesmeyenler">
        <UnmatchedTab />
      </TabsContent>

      <TabsContent value="ozet">
        <SummaryTab stats={stats} />
      </TabsContent>
    </Tabs>
  );
}
