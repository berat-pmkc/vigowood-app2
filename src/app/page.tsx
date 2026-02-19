import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const naturalColors = [
  { name: "Primary", hex: "#cdbd9d", desc: "Ahşap tonu" },
  { name: "Light", hex: "#f0ede1", desc: "Açık krem" },
  { name: "Side", hex: "#a99c7d", desc: "Orta ton" },
  { name: "Deep", hex: "#5e5747", desc: "Koyu" },
  { name: "Dark", hex: "#474237", desc: "En koyu" },
];

const functionalColors = [
  { name: "Success", hex: "#70c1aa", desc: "Tamamlandı" },
  { name: "Warning", hex: "#f28a19", desc: "Devam ediyor" },
  { name: "Error", hex: "#ee7683", desc: "Hata" },
  { name: "Info", hex: "#3368b1", desc: "Bilgi" },
];

const recycleColors = [
  { name: "Recycle 1", hex: "#e3ecd2" },
  { name: "Recycle 2", hex: "#b1d286" },
  { name: "Recycle 3", hex: "#8d9d70" },
  { name: "Recycle 4", hex: "#3caa35" },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-vw-dark text-vw-light">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-vw-primary">
              <span className="text-2xl font-bold text-vw-dark">VW</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">VigoWood</h1>
              <p className="text-vw-side">
                Entegre İş Yönetim Platformu
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Welcome */}
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Hoş geldiniz!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              VigoWood Platform — üretim, stok, satış, sevkiyat, analiz ve
              personel yönetimini tek çatıda toplayan entegre iş yönetim
              sistemidir.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge>Katman 0 Tamamlandı</Badge>
              <Badge variant="outline">Next.js + Tailwind</Badge>
              <Badge variant="outline">shadcn/ui</Badge>
              <Badge variant="outline">Supabase</Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Color Palette Test */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-xl font-semibold">Renk Paleti</h2>

        {/* Natural Colors */}
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Natural Color (Ana Tema)
        </h3>
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {naturalColors.map((color) => (
            <Card key={color.name} className="overflow-hidden">
              <div
                className="h-20"
                style={{ backgroundColor: color.hex }}
              />
              <CardContent className="p-3">
                <p className="font-medium text-sm">{color.name}</p>
                <p className="text-xs text-muted-foreground">{color.desc}</p>
                <code className="text-xs text-muted-foreground">
                  {color.hex}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Functional Colors */}
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Functional Color
        </h3>
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {functionalColors.map((color) => (
            <Card key={color.name} className="overflow-hidden">
              <div
                className="h-20"
                style={{ backgroundColor: color.hex }}
              />
              <CardContent className="p-3">
                <p className="font-medium text-sm">{color.name}</p>
                <p className="text-xs text-muted-foreground">{color.desc}</p>
                <code className="text-xs text-muted-foreground">
                  {color.hex}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recycle Colors */}
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Recycle Color (Üretim Durumları)
        </h3>
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {recycleColors.map((color) => (
            <Card key={color.name} className="overflow-hidden">
              <div
                className="h-20"
                style={{ backgroundColor: color.hex }}
              />
              <CardContent className="p-3">
                <p className="font-medium text-sm">{color.name}</p>
                <code className="text-xs text-muted-foreground">
                  {color.hex}
                </code>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* shadcn/ui Component Test */}
        <h3 className="mb-3 text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Komponent Testi
        </h3>
        <Card>
          <CardContent className="flex flex-wrap gap-3 p-6">
            <Button>Primary Buton</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
