import { resolvePeriod } from "@/lib/periods";
import { AnalizLayout } from "./analiz-layout";

type SP = Record<string, string | string[] | undefined>;

/** Phase D detay sayfaları hazır olana kadar 404 olmasın diye minimal sayfa. */
export async function PlaceholderPage({
  title,
  searchParams,
}: {
  title: string;
  searchParams: Promise<SP>;
}) {
  const period = resolvePeriod(await searchParams);
  return (
    <AnalizLayout
      title={title}
      backHref="/analiz"
      period={period}
      chart={
        <div className="rounded-xl border border-dashed border-[#a99c7d]/50 bg-white p-10 text-center text-muted-foreground">
          Hazırlanıyor
        </div>
      }
    />
  );
}
