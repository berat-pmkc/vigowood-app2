import { getOutputs, getAgents } from "../actions";
import { RaporlarClient } from "./raporlar-client";

export default async function RaporlarPage() {
  const [outputs, agents] = await Promise.all([
    getOutputs(),
    getAgents(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-vw-dark">Raporlar & Çıktılar</h1>
        <p className="text-sm text-muted-foreground">
          Agent ve kullanıcı tarafından oluşturulan dosyalar
        </p>
      </div>
      <RaporlarClient outputs={outputs} agents={agents} />
    </div>
  );
}
