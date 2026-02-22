import React from "react";
import path from "path";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from "@react-pdf/renderer";
import { registerTurkishFonts, formatTrNumber, formatTrCurrency } from "./pdf-utils";

registerTurkishFonts();

const COLORS = {
  primary: "#cdbd9d",
  light: "#f0ede1",
  side: "#a99c7d",
  deep: "#5e5747",
  dark: "#474237",
  white: "#ffffff",
  headerBg: "#474237",
  altRow: "#f7f5f0",
  totalRow: "#e8e2d3",
  success: "#70c1aa",
  error: "#ee7683",
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Roboto" },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  headerLeft: { flex: 1 },
  headerRight: { width: 180, alignItems: "flex-end" },
  companyName: { fontSize: 8, color: COLORS.deep, marginTop: 4 },
  titleBox: {
    backgroundColor: COLORS.headerBg,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: 2,
  },
  titleText: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.white,
    textAlign: "center",
    letterSpacing: 1,
  },
  metaContainer: {
    flexDirection: "row",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.side,
    borderRadius: 2,
  },
  metaCell: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: COLORS.side,
  },
  metaCellLast: { flex: 1, paddingVertical: 5, paddingHorizontal: 8 },
  metaLabel: { fontSize: 6, color: COLORS.side, marginBottom: 2 },
  metaValue: { fontSize: 9, fontWeight: "bold", color: COLORS.dark },

  // KPI row
  kpiRow: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 6,
  },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.side,
    borderRadius: 3,
    padding: 8,
    alignItems: "center",
  },
  kpiLabel: { fontSize: 6, color: COLORS.side, marginBottom: 3 },
  kpiValue: { fontSize: 11, fontWeight: "bold", color: COLORS.dark },
  kpiValuePositive: { fontSize: 11, fontWeight: "bold", color: "#2e7d32" },
  kpiValueNegative: { fontSize: 11, fontWeight: "bold", color: "#c62828" },

  // Section title
  sectionTitle: {
    fontSize: 10,
    fontWeight: "bold",
    color: COLORS.white,
    backgroundColor: COLORS.deep,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginTop: 10,
    marginBottom: 0,
  },

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    fontWeight: "bold",
    fontSize: 7,
    borderWidth: 1,
    borderColor: COLORS.side,
    borderTopWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.side,
    fontSize: 7,
    minHeight: 14,
  },
  tableRowAlt: { backgroundColor: COLORS.altRow },
  tableRowTotal: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.side,
    fontWeight: "bold",
    fontSize: 7,
    backgroundColor: COLORS.totalRow,
    minHeight: 16,
  },

  cellNum: { width: 22, padding: 2, textAlign: "center", justifyContent: "center" },
  cellLabel: { flex: 1, padding: 2, textAlign: "left", justifyContent: "center" },
  cellValue: { width: 90, padding: 2, textAlign: "right", justifyContent: "center" },
  cellPercent: { width: 45, padding: 2, textAlign: "right", justifyContent: "center" },

  // Two column layout
  twoCol: { flexDirection: "row", gap: 8, marginBottom: 4 },
  halfCol: { flex: 1 },

  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.side,
    paddingTop: 6,
  },
  footerLeft: { fontSize: 6, color: COLORS.side },
  footerRight: { fontSize: 6, color: COLORS.side },
});

// ─── Types ───

export interface NakitAkisRaporPdfProps {
  donemKodu: string;
  tarihAraligi: string;
  olusturmaTarihi: string;
  kurBilgisi: number;

  // KPI
  nakitTl: number;
  nakitUsd: number;
  toplamVarlik: number;
  toplamBorc: number;
  netPozisyon: number;

  // Genel Bakış
  varlikAcilisTl: number;
  varlikAcilisUsd: number;
  nakitGirisTl: number;
  nakitGirisUsd: number;
  nakitCikisTl: number;
  nakitCikisUsd: number;
  varlikTl: number;
  varlikUsd: number;
  yatirimTl: number;
  toplamVarlikTl: number;
  gayrinakitIslem: number;
  toplamPiyasaBorcu: number;
  toplamKkBorc: number;
  toplamFinansalBorc: number;

  // Girişler
  girisler: { label: string; value: number }[];
  girisToplamTl: number;
  girisUsdler: { label: string; value: number }[];
  girisToplamUsd: number;

  // Çıkışlar
  cikislar: { label: string; value: number }[];
  cikisToplamTl: number;
  cikisUsdler: { label: string; value: number }[];
  cikisToplamUsd: number;
}

// ─── Sub-components ───

function KpiCards({ data }: { data: NakitAkisRaporPdfProps }) {
  const kpis = [
    { label: "Nakit TL", value: data.nakitTl, format: "tl" },
    { label: "Nakit USD", value: data.nakitUsd, format: "usd" },
    { label: "Toplam Varlık", value: data.toplamVarlik, format: "tl" },
    { label: "Toplam Borç", value: data.toplamBorc, format: "tl" },
    { label: "Net Pozisyon", value: data.netPozisyon, format: "tl" },
  ];

  return (
    <View style={styles.kpiRow}>
      {kpis.map((k) => (
        <View key={k.label} style={styles.kpiCard}>
          <Text style={styles.kpiLabel}>{k.label}</Text>
          <Text
            style={
              k.label === "Net Pozisyon"
                ? k.value >= 0
                  ? styles.kpiValuePositive
                  : styles.kpiValueNegative
                : styles.kpiValue
            }
          >
            {k.format === "usd"
              ? `$${formatTrNumber(k.value, 2)}`
              : formatTrCurrency(k.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function GenelBakisTable({ data }: { data: NakitAkisRaporPdfProps }) {
  const rows = [
    { label: "Varlık Açılış (TL)", value: data.varlikAcilisTl },
    { label: "Varlık Açılış (USD)", value: data.varlikAcilisUsd, usd: true },
    { label: "Nakit Giriş (TL)", value: data.nakitGirisTl },
    { label: "Nakit Giriş (USD)", value: data.nakitGirisUsd, usd: true },
    { label: "Nakit Çıkış (TL)", value: data.nakitCikisTl },
    { label: "Nakit Çıkış (USD)", value: data.nakitCikisUsd, usd: true },
    { label: "Varlık (TL)", value: data.varlikTl },
    { label: "Varlık (USD)", value: data.varlikUsd, usd: true },
    { label: "Yatırım (TL)", value: data.yatirimTl },
    { label: "Toplam Varlık (TL)", value: data.toplamVarlikTl },
    { label: "Gayrinakit İşlem", value: data.gayrinakitIslem },
    { label: "Piyasa Borcu", value: data.toplamPiyasaBorcu },
    { label: "KK Borç", value: data.toplamKkBorc },
    { label: "Finansal Borç", value: data.toplamFinansalBorc },
  ];

  return (
    <View>
      <Text style={styles.sectionTitle}>{"Genel Bakış"}</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.cellLabel}>{"Gösterge"}</Text>
        <Text style={styles.cellValue}>{"Tutar"}</Text>
      </View>
      {rows.map((r, i) => (
        <View
          key={r.label}
          style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
        >
          <Text style={styles.cellLabel}>{r.label}</Text>
          <Text style={styles.cellValue}>
            {r.usd ? `$${formatTrNumber(r.value, 2)}` : formatTrCurrency(r.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function GirisTable({
  rows,
  toplam,
  title,
  isUsd,
}: {
  rows: { label: string; value: number }[];
  toplam: number;
  title: string;
  isUsd?: boolean;
}) {
  const filtered = rows.filter((r) => r.value !== 0);
  if (filtered.length === 0) return null;

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.cellNum}>#</Text>
        <Text style={styles.cellLabel}>{"Kanal"}</Text>
        <Text style={styles.cellValue}>{"Tutar"}</Text>
        <Text style={styles.cellPercent}>{"Pay"}</Text>
      </View>
      {filtered.map((r, i) => {
        const pct = toplam > 0 ? (r.value / toplam) * 100 : 0;
        return (
          <View
            key={r.label}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={styles.cellNum}>{i + 1}</Text>
            <Text style={styles.cellLabel}>{r.label}</Text>
            <Text style={styles.cellValue}>
              {isUsd ? `$${formatTrNumber(r.value, 2)}` : formatTrCurrency(r.value)}
            </Text>
            <Text style={styles.cellPercent}>{`%${pct.toFixed(1)}`}</Text>
          </View>
        );
      })}
      <View style={styles.tableRowTotal}>
        <Text style={styles.cellNum} />
        <Text style={[styles.cellLabel, { fontWeight: "bold" }]}>TOPLAM</Text>
        <Text style={styles.cellValue}>
          {isUsd ? `$${formatTrNumber(toplam, 2)}` : formatTrCurrency(toplam)}
        </Text>
        <Text style={styles.cellPercent}>{"%100"}</Text>
      </View>
    </View>
  );
}

function CikisTable({
  rows,
  toplam,
  title,
  isUsd,
}: {
  rows: { label: string; value: number }[];
  toplam: number;
  title: string;
  isUsd?: boolean;
}) {
  const filtered = rows.filter((r) => r.value !== 0);
  if (filtered.length === 0) return null;
  const sorted = [...filtered].sort((a, b) => b.value - a.value);

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.cellNum}>#</Text>
        <Text style={styles.cellLabel}>{"Kategori"}</Text>
        <Text style={styles.cellValue}>{"Tutar"}</Text>
        <Text style={styles.cellPercent}>{"Pay"}</Text>
      </View>
      {sorted.map((r, i) => {
        const pct = toplam > 0 ? (r.value / toplam) * 100 : 0;
        return (
          <View
            key={r.label}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={styles.cellNum}>{i + 1}</Text>
            <Text style={styles.cellLabel}>{r.label}</Text>
            <Text style={styles.cellValue}>
              {isUsd ? `$${formatTrNumber(r.value, 2)}` : formatTrCurrency(r.value)}
            </Text>
            <Text style={styles.cellPercent}>{`%${pct.toFixed(1)}`}</Text>
          </View>
        );
      })}
      <View style={styles.tableRowTotal}>
        <Text style={styles.cellNum} />
        <Text style={[styles.cellLabel, { fontWeight: "bold" }]}>TOPLAM</Text>
        <Text style={styles.cellValue}>
          {isUsd ? `$${formatTrNumber(toplam, 2)}` : formatTrCurrency(toplam)}
        </Text>
        <Text style={styles.cellPercent}>{"%100"}</Text>
      </View>
    </View>
  );
}

// ─── Main Document ───

export function NakitAkisRaporDocument(props: NakitAkisRaporPdfProps) {
  const logoPath = path.join(process.cwd(), "public", "logo-yatay.png");

  return (
    <Document>
      {/* Page 1: KPI + Genel Bakış + Girişler */}
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line */}
            <Image src={logoPath} style={{ width: 110, height: 25 }} />
            <Text style={styles.companyName}>
              {"HAS-MOB ORMAN ÜRÜNLERİ MOBİLYA SAN. VE TİC. LTD. ŞTİ."}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 7, color: COLORS.side }}>www.vigowood.com</Text>
            <Text style={{ fontSize: 7, color: COLORS.side }}>info@vigowood.com</Text>
          </View>
        </View>

        <View style={styles.titleBox}>
          <Text style={styles.titleText}>{"NAKİT AKIŞ RAPORU"}</Text>
        </View>

        <View style={styles.metaContainer}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{"DÖNEM"}</Text>
            <Text style={styles.metaValue}>{props.donemKodu}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{"TARİH ARALIĞI"}</Text>
            <Text style={styles.metaValue}>{props.tarihAraligi}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{"KUR (USD/TRY)"}</Text>
            <Text style={styles.metaValue}>{formatTrNumber(props.kurBilgisi, 4)}</Text>
          </View>
          <View style={styles.metaCellLast}>
            <Text style={styles.metaLabel}>{"RAPOR TARİHİ"}</Text>
            <Text style={styles.metaValue}>{props.olusturmaTarihi}</Text>
          </View>
        </View>

        <KpiCards data={props} />

        <GenelBakisTable data={props} />

        <View style={styles.twoCol}>
          <View style={styles.halfCol}>
            <GirisTable
              rows={props.girisler}
              toplam={props.girisToplamTl}
              title={"Nakit Girişler (TL)"}
            />
          </View>
          <View style={styles.halfCol}>
            <GirisTable
              rows={props.girisUsdler}
              toplam={props.girisToplamUsd}
              title={"Nakit Girişler (USD)"}
              isUsd
            />
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerLeft}>
            {"VigoWood Platform - Otomatik Oluşturulmuştur"}
          </Text>
          <Text style={styles.footerRight}>Sayfa 1/2</Text>
        </View>
      </Page>

      {/* Page 2: Çıkışlar + Borç Yapısı */}
      <Page size="A4" style={styles.page}>
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line */}
            <Image src={logoPath} style={{ width: 110, height: 25 }} />
            <Text style={styles.companyName}>
              {"NAKİT AKIŞ RAPORU — " + props.donemKodu}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 7, color: COLORS.side }}>www.vigowood.com</Text>
          </View>
        </View>

        <View style={styles.twoCol}>
          <View style={styles.halfCol}>
            <CikisTable
              rows={props.cikislar}
              toplam={props.cikisToplamTl}
              title={"Nakit Çıkışlar (TL)"}
            />
          </View>
          <View style={styles.halfCol}>
            <CikisTable
              rows={props.cikisUsdler}
              toplam={props.cikisToplamUsd}
              title={"Nakit Çıkışlar (USD)"}
              isUsd
            />
          </View>
        </View>

        {/* Borç Yapısı */}
        <Text style={styles.sectionTitle}>{"Borç Yapısı"}</Text>
        <View style={styles.tableHeader}>
          <Text style={styles.cellLabel}>{"Borç Türü"}</Text>
          <Text style={styles.cellValue}>{"Tutar"}</Text>
          <Text style={styles.cellPercent}>{"Pay"}</Text>
        </View>
        {(() => {
          const borcRows = [
            { label: "Piyasa Borcu", value: props.toplamPiyasaBorcu },
            { label: "KK Borç", value: props.toplamKkBorc },
            { label: "Finansal Borç", value: props.toplamFinansalBorc },
          ];
          const toplamBorc = borcRows.reduce((s, r) => s + r.value, 0);
          return (
            <>
              {borcRows.map((r, i) => {
                const pct = toplamBorc > 0 ? (r.value / toplamBorc) * 100 : 0;
                return (
                  <View
                    key={r.label}
                    style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
                  >
                    <Text style={styles.cellLabel}>{r.label}</Text>
                    <Text style={styles.cellValue}>{formatTrCurrency(r.value)}</Text>
                    <Text style={styles.cellPercent}>{`%${pct.toFixed(1)}`}</Text>
                  </View>
                );
              })}
              <View style={styles.tableRowTotal}>
                <Text style={[styles.cellLabel, { fontWeight: "bold" }]}>
                  TOPLAM BORÇ
                </Text>
                <Text style={styles.cellValue}>{formatTrCurrency(toplamBorc)}</Text>
                <Text style={styles.cellPercent}>{"%100"}</Text>
              </View>
            </>
          );
        })()}

        <View style={styles.footer}>
          <Text style={styles.footerLeft}>
            {"VigoWood Platform - Otomatik Oluşturulmuştur"}
          </Text>
          <Text style={styles.footerRight}>Sayfa 2/2</Text>
        </View>
      </Page>
    </Document>
  );
}
