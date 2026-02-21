import { getSettings } from "./actions";
import { AyarlarClient } from "./components/ayarlar-client";

export default async function AyarlarPage() {
  const settings = await getSettings();

  return (
    <div className="px-4 sm:px-6 py-4 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Ayarlar</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Uygulama geneli ayarlar ve kritik stok hesaplama
        </p>
      </div>

      <AyarlarClient initialSettings={settings} />
    </div>
  );
}
