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
  kpiRow: { flexDirection: "row", marginBottom: 12, gap: 6 },
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

  // Table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.primary,
    fontWeight: "bold",
    fontSize: 6,
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
    fontSize: 6.5,
    minHeight: 13,
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

  // Cells
  cellNum: { width: 20, padding: 2, textAlign: "center", justifyContent: "center" },
  cellTanim: { flex: 1, padding: 2, textAlign: "left", justifyContent: "center" },
  cellTutar: { width: 75, padding: 2, textAlign: "right", justifyContent: "center" },
  cellCinsi: { width: 30, padding: 2, textAlign: "center", justifyContent: "center" },
  cellTarih: { width: 55, padding: 2, textAlign: "center", justifyContent: "center" },
  cellTuru: { width: 55, padding: 2, textAlign: "center", justifyContent: "center" },
  cellDurum: { width: 55, padding: 2, textAlign: "center", justifyContent: "center" },

  // Badge
  badge: {
    paddingVertical: 1,
    paddingHorizontal: 4,
    borderRadius: 2,
    fontSize: 5.5,
    textAlign: "center",
  },

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

  // Summary
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
  summaryHeaderText: { fontSize: 9, fontWeight: "bold", color: COLORS.white },
  summaryBody: { padding: 10, backgroundColor: COLORS.light },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.side,
  },
  summaryLabel: { fontSize: 8, color: COLORS.deep },
  summaryValue: { fontSize: 8, fontWeight: "bold", color: COLORS.dark },

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

export interface OdemeRow {
  tanimi: string;
  tutar: number;
  cinsi: string;
  tarih: string | null;
  turu: string;
  odeme_durum: string;
}

export interface OdemeListesiPdfProps {
  olusturmaTarihi: string;
  toplamKayit: number;
  bekleyenTl: number;
  bekleyenUsd: number;
  tamamlananTl: number;
  tamamlananUsd: number;
  rows: OdemeRow[];
  filtreBilgisi?: string;
  turDagilimi: { turu: string; adet: number; toplamTl: number }[];
}

// ─── Helpers ───

const TURU_COLORS: Record<string, { bg: string; text: string }> = {
  "PİYASA": { bg: "#e8eaf6", text: "#283593" },
  "KREDİ": { bg: "#fce4ec", text: "#b71c1c" },
  "KREDİ KARTI": { bg: "#fff3e0", text: "#e65100" },
  "MAAŞ": { bg: "#e0f2f1", text: "#00695c" },
  "FAİZ": { bg: "#fbe9e7", text: "#d84315" },
  "SGK": { bg: "#f3e5f5", text: "#7b1fa2" },
  "VERGİ": { bg: "#ffebee", text: "#c62828" },
  "HAMMADDE": { bg: "#e1f5fe", text: "#0277bd" },
  "PERSONEL": { bg: "#e8f5e9", text: "#2e7d32" },
  "ELEKTRİK": { bg: "#fff9c4", text: "#f57f17" },
  "BANKA": { bg: "#efebe9", text: "#4e342e" },
  "GENEL": { bg: "#eceff1", text: "#546e7a" },
  "DİĞER": { bg: "#f5f5f5", text: "#616161" },
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatAmount(value: number, cinsi: string): string {
  if (cinsi === "USD") return `$${formatTrNumber(value, 2)}`;
  if (cinsi === "EUR") return `€${formatTrNumber(value, 2)}`;
  return formatTrCurrency(value);
}

// ─── Main Document ───

export function OdemeListesiDocument(props: OdemeListesiPdfProps) {
  const logoPath = path.join(process.cwd(), "public", "logo-yatay.png");
  const rowsPerPage = 40;
  const totalPages = Math.max(1, Math.ceil(props.rows.length / rowsPerPage));

  const pages: OdemeRow[][] = [];
  for (let i = 0; i < props.rows.length; i += rowsPerPage) {
    pages.push(props.rows.slice(i, i + rowsPerPage));
  }

  return (
    <Document>
      {pages.map((pageRows, pageIdx) => (
        <Page key={pageIdx} size="A4" style={styles.page}>
          {/* Header */}
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

          {/* Title — only first page */}
          {pageIdx === 0 && (
            <>
              <View style={styles.titleBox}>
                <Text style={styles.titleText}>{"ÖDEME LİSTESİ"}</Text>
              </View>

              <View style={styles.metaContainer}>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>{"RAPOR TARİHİ"}</Text>
                  <Text style={styles.metaValue}>{props.olusturmaTarihi}</Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>{"TOPLAM KAYIT"}</Text>
                  <Text style={styles.metaValue}>
                    {formatTrNumber(props.toplamKayit)}
                  </Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={styles.metaLabel}>{"FİLTRE"}</Text>
                  <Text style={styles.metaValue}>
                    {props.filtreBilgisi || "Tümü"}
                  </Text>
                </View>
                <View style={styles.metaCellLast}>
                  <Text style={styles.metaLabel}>{"SAYFA"}</Text>
                  <Text style={styles.metaValue}>
                    {`${pageIdx + 1} / ${totalPages}`}
                  </Text>
                </View>
              </View>

              {/* KPI */}
              <View style={styles.kpiRow}>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{"Bekleyen (TL)"}</Text>
                  <Text style={styles.kpiValue}>{formatTrCurrency(props.bekleyenTl)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{"Bekleyen (USD)"}</Text>
                  <Text style={styles.kpiValue}>{`$${formatTrNumber(props.bekleyenUsd, 2)}`}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{"Tamamlanan (TL)"}</Text>
                  <Text style={styles.kpiValue}>{formatTrCurrency(props.tamamlananTl)}</Text>
                </View>
                <View style={styles.kpiCard}>
                  <Text style={styles.kpiLabel}>{"Tamamlanan (USD)"}</Text>
                  <Text style={styles.kpiValue}>{`$${formatTrNumber(props.tamamlananUsd, 2)}`}</Text>
                </View>
              </View>
            </>
          )}

          {/* Table */}
          {pageIdx > 0 && (
            <Text style={{ fontSize: 8, color: COLORS.deep, marginBottom: 6 }}>
              {`Ödeme Listesi — Sayfa ${pageIdx + 1} / ${totalPages}`}
            </Text>
          )}

          <View style={styles.tableHeader}>
            <Text style={styles.cellNum}>#</Text>
            <Text style={styles.cellTanim}>{"Tanım"}</Text>
            <Text style={styles.cellTutar}>{"Tutar"}</Text>
            <Text style={styles.cellCinsi}>{"Cinsi"}</Text>
            <Text style={styles.cellTarih}>{"Tarih"}</Text>
            <Text style={styles.cellTuru}>{"Tür"}</Text>
            <Text style={styles.cellDurum}>{"Durum"}</Text>
          </View>

          {pageRows.map((row, i) => {
            const globalIdx = pageIdx * rowsPerPage + i;
            const colors = TURU_COLORS[row.turu] || TURU_COLORS["DİĞER"];
            return (
              <View
                key={globalIdx}
                style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={styles.cellNum}>{globalIdx + 1}</Text>
                <Text style={styles.cellTanim}>{row.tanimi}</Text>
                <Text style={styles.cellTutar}>
                  {formatAmount(row.tutar, row.cinsi)}
                </Text>
                <Text style={styles.cellCinsi}>{row.cinsi}</Text>
                <Text style={styles.cellTarih}>{formatDate(row.tarih)}</Text>
                <View style={styles.cellTuru}>
                  <Text
                    style={[
                      styles.badge,
                      { backgroundColor: colors.bg, color: colors.text },
                    ]}
                  >
                    {row.turu}
                  </Text>
                </View>
                <View style={styles.cellDurum}>
                  <Text
                    style={[
                      styles.badge,
                      {
                        backgroundColor:
                          row.odeme_durum === "TAMAMLANDI" ? "#e8f5e9" : "#fff3e0",
                        color:
                          row.odeme_durum === "TAMAMLANDI" ? "#2e7d32" : "#e65100",
                      },
                    ]}
                  >
                    {row.odeme_durum}
                  </Text>
                </View>
              </View>
            );
          })}

          {/* Summary on last page */}
          {pageIdx === pages.length - 1 && props.turDagilimi.length > 0 && (
            <View style={styles.summaryContainer}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryHeaderText}>
                  {"TÜR BAZLI DAĞILIM"}
                </Text>
              </View>
              <View style={styles.summaryBody}>
                {props.turDagilimi.map((t) => (
                  <View key={t.turu} style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      {`${t.turu} (${t.adet} adet)`}
                    </Text>
                    <Text style={styles.summaryValue}>
                      {formatTrCurrency(t.toplamTl)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerLeft}>
              {"VigoWood Platform - Otomatik Oluşturulmuştur"}
            </Text>
            <Text style={styles.footerRight}>
              {`Sayfa ${pageIdx + 1} / ${totalPages}`}
            </Text>
          </View>
        </Page>
      ))}
    </Document>
  );
}
