import type { Metadata } from "next";
import { getActiveProducts, getKesimTalepleri } from "../actions";
import { YeniTalepForm } from "./components/yeni-talep-form";
import { TalepListesi } from "./components/talep-listesi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const metadata: Metadata = { title: "Kesim Talepleri" };

export default async function KesimTalepleriPage() {
  const [urunSonuc, acik, tumu] = await Promise.all([
    getActiveProducts(),
    getKesimTalepleri(true),
    getKesimTalepleri(false),
  ]);

  const urunler = urunSonuc.success
    ? urunSonuc.data.map((u) => ({ sku: u.sku, urun_adi: u.urun_adi }))
    : [];

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Kesim Talepleri</h1>
        <p className="text-sm text-muted-foreground">
          İhtiyacınız olan plakayı buradan talep edin — kesimhane ekranında görünür.
        </p>
      </div>

      <YeniTalepForm urunler={urunler} />

      <Tabs defaultValue="acik">
        <TabsList>
          <TabsTrigger value="acik">Açık Talepler ({acik.length})</TabsTrigger>
          <TabsTrigger value="gecmis">Tümü</TabsTrigger>
        </TabsList>
        <TabsContent value="acik" className="mt-4">
          <TalepListesi talepler={acik} />
        </TabsContent>
        <TabsContent value="gecmis" className="mt-4">
          <TalepListesi talepler={tumu} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
