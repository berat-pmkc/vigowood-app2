"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollText } from "lucide-react";
import type { OpsAgent } from "../../../actions";
import ReactMarkdown from "react-markdown";

interface RulesPanelProps {
  agent: OpsAgent;
}

const CAPABILITY_LABELS: Record<string, string> = {
  stok_izleme: "Stok İzleme",
  kritik_stok_uyari: "Kritik Stok Uyarısı",
  yeniden_siparis_onerisi: "Yeniden Sipariş Önerisi",
  stok_raporu: "Stok Raporu",
  yari_mamul_analiz: "Yarı Mamül Analizi",
  uretim_izleme: "Üretim İzleme",
  darbogaz_tespit: "Darboğaz Tespiti",
  verimlilik_raporu: "Verimlilik Raporu",
  kesim_optimizasyon: "Kesim Optimizasyonu",
  montaj_analiz: "Montaj Analizi",
  siparis_takip: "Sipariş Takibi",
  siparis_guncelle: "Sipariş Güncelleme",
  satis_raporu: "Satış Raporu",
  kampanya_analiz: "Kampanya Analizi",
  kampanya_takip: "Kampanya Takibi",
  musteri_analizi: "Müşteri Analizi",
  ikas_siparis_analizi: "İkas Sipariş Analizi",
  gunluk_satis_raporu: "Günlük Satış Raporu",
  pazaryeri_performans: "Pazaryeri Performans",
  sevkiyat_planlama: "Sevkiyat Planlama",
  sevkiyat_takip: "Sevkiyat Takibi",
  teslimat_raporu: "Teslimat Raporu",
  konteyner_optimizasyon: "Konteyner Optimizasyonu",
  lojistik_raporu: "Lojistik Raporu",
  lojistik_analiz: "Lojistik Analizi",
  maliyet_takip: "Maliyet Takibi",
  teslimat_takip: "Teslimat Takibi",
  nakit_akis_izleme: "Nakit Akış İzleme",
  nakit_akis_analizi: "Nakit Akış Analizi",
  odeme_hatirlatma: "Ödeme Hatırlatması",
  finansal_rapor: "Finansal Rapor",
  finansal_ozet: "Finansal Özet",
  karlilik_analiz: "Kârlılık Analizi",
  karlilik_raporu: "Kârlılık Raporu",
  borc_takip: "Borç Takibi",
  gorev_koordinasyon: "Görev Koordinasyonu",
  gorev_atama: "Görev Atama",
  rapor_toplama: "Rapor Toplama",
  gunluk_brief: "Günlük Brief",
  koordinasyon: "Koordinasyon",
  onceliklendirme: "Önceliklendirme",
  performans_ozet: "Performans Özeti",
  toplanti_ozet: "Toplantı Özeti",
  performans_raporu: "Performans Raporu",
  oncelik_analiz: "Öncelik Analizi",
};

function generateRulesMarkdown(agent: OpsAgent): string {
  const lines: string[] = [];
  lines.push(`# ${agent.name} — Kurallar`);
  lines.push("");

  if (agent.description) {
    lines.push("## Rol Tanımı");
    lines.push(agent.description);
    lines.push("");
  }

  if (agent.capabilities.length > 0) {
    lines.push("## Yetenekler");
    for (const cap of agent.capabilities) {
      lines.push(`- ${CAPABILITY_LABELS[cap] ?? cap}`);
    }
    lines.push("");
  }

  if (agent.schedule?.cron) {
    lines.push("## Çalışma Planı");
    if (agent.schedule.description) {
      lines.push(agent.schedule.description);
    }
    lines.push(`- **Cron:** \`${agent.schedule.cron}\``);
    if (agent.schedule.timezone) {
      lines.push(`- **Zaman Dilimi:** ${agent.schedule.timezone}`);
    }
    lines.push("");
  }

  lines.push("## Genel Kurallar");
  lines.push("- Tüm çıktılar `ops_outputs` tablosuna kaydedilir");
  lines.push("- Kritik işlemler için onay talebi oluşturulur");
  lines.push("- Hata durumunda görev `is_blocked` olarak işaretlenir");
  lines.push("- Görev yorumlarına yazma yapılmaz, çıktılar `ops_outputs`'a konulur");
  lines.push("");

  return lines.join("\n");
}

export function RulesPanel({ agent }: RulesPanelProps) {
  const markdown = generateRulesMarkdown(agent);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <ScrollText className="h-4 w-4" />
          Ajan Kuralları
          <Badge variant="outline" className="text-[10px] ml-1">
            Salt okunur
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-vw-dark prose-headings:font-semibold prose-h1:text-lg prose-h2:text-base prose-p:text-sm prose-li:text-sm prose-code:text-xs prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      </CardContent>
    </Card>
  );
}
