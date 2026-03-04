import { getSnapshotsByPeriod } from "../../actions";
import { GecmisDetailClient } from "./components/gecmis-detail-client";

interface PageProps {
  params: Promise<{ donemKodu: string }>;
}

export default async function GecmisDetailPage({ params }: PageProps) {
  const { donemKodu } = await params;
  const decoded = decodeURIComponent(donemKodu);
  const data = await getSnapshotsByPeriod(decoded);

  return <GecmisDetailClient donemKodu={decoded} data={data} />;
}
