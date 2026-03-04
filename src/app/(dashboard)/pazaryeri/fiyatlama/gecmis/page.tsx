import { getSnapshotPeriods } from "../actions";
import { GecmisClient } from "./components/gecmis-client";

export default async function GecmisPage() {
  const periods = await getSnapshotPeriods();

  return <GecmisClient periods={periods} />;
}
