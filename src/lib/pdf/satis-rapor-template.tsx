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

// Register Roboto for Turkish character support
registerTurkishFonts();

// VigoWood color palette
const COLORS = {
  primary: "#cdbd9d",
  light: "#f0ede1",
  side: "#a99c7d",
  deep: "#5e5747",
  dark: "#474237",
  white: "#ffffff",
  headerBg: "#474237",
  headerText: "#ffffff",
  altRow: "#f7f5f0",
  totalRow: "#e8e2d3",
};

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Roboto" },

  // Header section
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
  companyName: {
    fontSize: 8,
    color: COLORS.deep,
    marginTop: 4,
  },

  // Title
  titleBox: {
    backgroundColor: COLORS.headerBg,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: 2,
  },
  titleText: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.white,
    textAlign: "center",
    letterSpacing: 1,
  },

  // Meta info row
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
  metaCellLast: {
    flex: 1,
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  metaLabel: { fontSize: 6, color: COLORS.side, marginBottom: 2 },
  metaValue: { fontSize: 9, fontWeight: "bold", color: COLORS.dark },

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

  // Table styles
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
    minHeight: 16,
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
    minHeight: 18,
  },

  // Cells
  cellNum: { width: 28, padding: 3, textAlign: "center", justifyContent: "center" },
  cellSku: { flex: 1, padding: 3, textAlign: "left", justifyContent: "center" },
  cellAdet: { width: 60, padding: 3, textAlign: "right", justifyContent: "center" },
  cellTutar: { width: 90, padding: 3, textAlign: "right", justifyContent: "center" },

  // Kanal table cells
  cellKanal: { flex: 1, padding: 3, textAlign: "left", justifyContent: "center" },
  cellKanalAdet: { width: 60, padding: 3, textAlign: "right", justifyContent: "center" },
  cellKanalTutar: { width: 90, padding: 3, textAlign: "right", justifyContent: "center" },
  cellKanalYuzde: { width: 55, padding: 3, textAlign: "right", justifyContent: "center" },

  // Summary section
  summaryContainer: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.side,
    borderRadius: 2,
  },
  summaryHeader: {
    backgroundColor: COLORS.headerBg,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  summaryHeaderText: {
    fontSize: 9,
    fontWeight: "bold",
    color: COLORS.white,
  },
  summaryBody: {
    padding: 10,
    backgroundColor: COLORS.light,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.side,
  },
  summaryRowLast: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    marginTop: 2,
  },
  summaryLabel: { fontSize: 9, color: COLORS.deep },
  summaryValue: { fontSize: 9, fontWeight: "bold", color: COLORS.dark },
  summaryGrandLabel: { fontSize: 11, fontWeight: "bold", color: COLORS.dark },
  summaryGrandValue: { fontSize: 11, fontWeight: "bold", color: COLORS.dark },

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

export interface SkuAggRow {
  sku: string;
  adet: number;
  tutar: number;
}

export interface KanalAggRow {
  kanal: string;
  adet: number;
  tutar: number;
}

export interface SatisRaporPdfProps {
  raporId: string;
  raporTarihi: string;
  olusturmaTarihi: string;
  trRows: SkuAggRow[];
  ihracatRows: SkuAggRow[];
  kanalRows: KanalAggRow[];
  toplamAdet: number;
  toplamTutar: number;
  trTutar: number;
  ihracatTutar: number;
}

// ─── Sub-components ───

function SkuTable({ rows, title }: { rows: SkuAggRow[]; title: string }) {
  if (rows.length === 0) return null;
  const totalAdet = rows.reduce((s, r) => s + r.adet, 0);
  const totalTutar = rows.reduce((s, r) => s + r.tutar, 0);

  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.cellNum}>#</Text>
        <Text style={styles.cellSku}>SKU</Text>
        <Text style={styles.cellAdet}>Adet</Text>
        <Text style={styles.cellTutar}>Tutar (TL)</Text>
      </View>
      {rows.map((row, i) => (
        <View
          key={row.sku}
          style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
        >
          <Text style={styles.cellNum}>{i + 1}</Text>
          <Text style={styles.cellSku}>{row.sku}</Text>
          <Text style={styles.cellAdet}>{formatTrNumber(row.adet)}</Text>
          <Text style={styles.cellTutar}>{formatTrCurrency(row.tutar)}</Text>
        </View>
      ))}
      <View style={styles.tableRowTotal}>
        <Text style={styles.cellNum} />
        <Text style={[styles.cellSku, { fontWeight: "bold" }]}>TOPLAM</Text>
        <Text style={styles.cellAdet}>{formatTrNumber(totalAdet)}</Text>
        <Text style={styles.cellTutar}>{formatTrCurrency(totalTutar)}</Text>
      </View>
    </View>
  );
}

function KanalTable({
  rows,
  toplamTutar,
}: {
  rows: KanalAggRow[];
  toplamTutar: number;
}) {
  if (rows.length === 0) return null;
  const totalAdet = rows.reduce((s, r) => s + r.adet, 0);
  const totalTutar = rows.reduce((s, r) => s + r.tutar, 0);

  return (
    <View>
      <Text style={styles.sectionTitle}>{"Kanal Bazlı Dağılım"}</Text>
      <View style={styles.tableHeader}>
        <Text style={styles.cellNum}>#</Text>
        <Text style={styles.cellKanal}>Kanal</Text>
        <Text style={styles.cellKanalAdet}>Adet</Text>
        <Text style={styles.cellKanalTutar}>Tutar (TL)</Text>
        <Text style={styles.cellKanalYuzde}>Oran</Text>
      </View>
      {rows.map((row, i) => {
        const pct = toplamTutar > 0 ? (row.tutar / toplamTutar) * 100 : 0;
        return (
          <View
            key={row.kanal}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={styles.cellNum}>{i + 1}</Text>
            <Text style={styles.cellKanal}>{row.kanal}</Text>
            <Text style={styles.cellKanalAdet}>{formatTrNumber(row.adet)}</Text>
            <Text style={styles.cellKanalTutar}>
              {formatTrCurrency(row.tutar)}
            </Text>
            <Text style={styles.cellKanalYuzde}>%{pct.toFixed(1)}</Text>
          </View>
        );
      })}
      <View style={styles.tableRowTotal}>
        <Text style={styles.cellNum} />
        <Text style={[styles.cellKanal, { fontWeight: "bold" }]}>TOPLAM</Text>
        <Text style={styles.cellKanalAdet}>{formatTrNumber(totalAdet)}</Text>
        <Text style={styles.cellKanalTutar}>
          {formatTrCurrency(totalTutar)}
        </Text>
        <Text style={styles.cellKanalYuzde}>%100</Text>
      </View>
    </View>
  );
}

// ─── Main Document ───

export function SatisRaporDocument(props: SatisRaporPdfProps) {
  const logoPath = path.join(process.cwd(), "public", "logo-yatay.png");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with logo */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line */}
            <Image src={logoPath} style={{ width: 110, height: 25 }} />
            <Text style={styles.companyName}>
              {"HAS-MOB ORMAN ÜRÜNLERİ MOBİLYA SAN. VE TİC. LTD. ŞTİ."}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 7, color: COLORS.side }}>
              www.vigowood.com
            </Text>
            <Text style={{ fontSize: 7, color: COLORS.side }}>
              info@vigowood.com
            </Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBox}>
          <Text style={styles.titleText}>{"GÜN SONU SATIŞ RAPORU"}</Text>
        </View>

        {/* Meta info */}
        <View style={styles.metaContainer}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>RAPOR ID</Text>
            <Text style={styles.metaValue}>{props.raporId}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{"RAPOR TARİHİ"}</Text>
            <Text style={styles.metaValue}>{props.raporTarihi}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{"OLUŞTURULMA"}</Text>
            <Text style={styles.metaValue}>{props.olusturmaTarihi}</Text>
          </View>
          <View style={styles.metaCellLast}>
            <Text style={styles.metaLabel}>{"TOPLAM ÜRÜN"}</Text>
            <Text style={styles.metaValue}>
              {formatTrNumber(props.toplamAdet)} adet
            </Text>
          </View>
        </View>

        {/* TR Sales Table */}
        <SkuTable rows={props.trRows} title={"TR Satışlar"} />

        {/* Export Sales Table */}
        <SkuTable rows={props.ihracatRows} title={"İhracat Satışlar"} />

        {/* Channel Distribution */}
        <KanalTable
          rows={props.kanalRows}
          toplamTutar={props.toplamTutar}
        />

        {/* Summary */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryHeader}>
            <Text style={styles.summaryHeaderText}>{"ÖZET"}</Text>
          </View>
          <View style={styles.summaryBody}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{"TR Satış Tutarı"}</Text>
              <Text style={styles.summaryValue}>
                {formatTrCurrency(props.trTutar)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{"İhracat Tutarı"}</Text>
              <Text style={styles.summaryValue}>
                {formatTrCurrency(props.ihracatTutar)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{"Toplam Ürün Adedi"}</Text>
              <Text style={styles.summaryValue}>
                {formatTrNumber(props.toplamAdet)} adet
              </Text>
            </View>
            <View style={styles.summaryRowLast}>
              <Text style={styles.summaryGrandLabel}>GENEL TOPLAM</Text>
              <Text style={styles.summaryGrandValue}>
                {formatTrCurrency(props.toplamTutar)}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>
{"VigoWood Platform - Otomatik Oluşturulmuştur"}
          </Text>
          <Text style={styles.footerRight}>{props.raporId}</Text>
        </View>
      </Page>
    </Document>
  );
}
