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
  todayBorder: "#cdbd9d",
  emptyCell: "#fafaf8",
};

const AY_ISIMLERI = [
  "Ocak", "Subat", "Mart", "Nisan", "Mayis", "Haziran",
  "Temmuz", "Agustos", "Eylul", "Ekim", "Kasim", "Aralik",
];

const GUN_ISIMLERI = ["Pzt", "Sal", "Car", "Per", "Cum", "Cmt", "Paz"];

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

const TURU_KISALTMA: Record<string, string> = {
  "PİYASA": "PİY",
  "KREDİ": "KRD",
  "KREDİ KARTI": "KK",
  "MAAŞ": "MAA",
  "FAİZ": "FAİ",
  "SGK": "SGK",
  "VERGİ": "VER",
  "HAMMADDE": "HAM",
  "PERSONEL": "PER",
  "ELEKTRİK": "ELK",
  "BANKA": "BNK",
  "GENEL": "GNL",
  "DİĞER": "DİĞ",
};

// ─── Styles ───

const cellWidth = (535 - 6) / 7; // A4 width minus padding minus gaps / 7 cols

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Roboto" },
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  headerLeft: { flex: 1 },
  headerRight: { width: 180, alignItems: "flex-end" },
  companyName: { fontSize: 8, color: COLORS.deep, marginTop: 4 },
  titleBox: {
    backgroundColor: COLORS.headerBg,
    paddingVertical: 6,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderRadius: 2,
  },
  titleText: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.white,
    textAlign: "center",
    letterSpacing: 1,
  },
  metaContainer: {
    flexDirection: "row",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.side,
    borderRadius: 2,
  },
  metaCell: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: COLORS.side,
  },
  metaCellLast: { flex: 1, paddingVertical: 4, paddingHorizontal: 8 },
  metaLabel: { fontSize: 6, color: COLORS.side, marginBottom: 1 },
  metaValue: { fontSize: 9, fontWeight: "bold", color: COLORS.dark },

  // KPI row
  kpiRow: { flexDirection: "row", marginBottom: 10, gap: 6 },
  kpiCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.side,
    borderRadius: 3,
    padding: 6,
    alignItems: "center",
  },
  kpiLabel: { fontSize: 6, color: COLORS.side, marginBottom: 2 },
  kpiValue: { fontSize: 10, fontWeight: "bold", color: COLORS.dark },

  // Calendar grid
  dayHeaderRow: {
    flexDirection: "row",
    gap: 1,
    marginBottom: 1,
  },
  dayHeaderCell: {
    width: cellWidth,
    backgroundColor: COLORS.primary,
    paddingVertical: 3,
    alignItems: "center",
    borderRadius: 1,
  },
  dayHeaderText: {
    fontSize: 7,
    fontWeight: "bold",
    color: COLORS.dark,
  },
  weekRow: {
    flexDirection: "row",
    gap: 1,
    marginBottom: 1,
  },
  dayCell: {
    width: cellWidth,
    minHeight: 58,
    borderWidth: 0.5,
    borderColor: COLORS.side,
    borderRadius: 1,
    padding: 2,
  },
  dayCellEmpty: {
    backgroundColor: COLORS.emptyCell,
    opacity: 0.5,
  },
  dayCellToday: {
    borderWidth: 1.5,
    borderColor: COLORS.todayBorder,
  },
  dayNumber: {
    fontSize: 8,
    fontWeight: "bold",
    color: COLORS.dark,
    marginBottom: 2,
  },
  dayNumberOther: {
    color: COLORS.side,
    fontWeight: "normal",
  },
  odemeItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 1,
    gap: 1,
  },
  odemeBadge: {
    fontSize: 4.5,
    paddingVertical: 0.5,
    paddingHorizontal: 2,
    borderRadius: 1,
    fontWeight: "bold",
  },
  odemeAmount: {
    fontSize: 5,
    color: COLORS.dark,
  },
  dayTotal: {
    marginTop: 1,
    paddingTop: 1,
    borderTopWidth: 0.5,
    borderTopColor: COLORS.side,
  },
  dayTotalText: {
    fontSize: 5.5,
    fontWeight: "bold",
  },
  moreText: {
    fontSize: 4.5,
    color: COLORS.side,
    fontStyle: "italic",
  },

  // Summary
  summaryContainer: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: COLORS.side,
    borderRadius: 2,
  },
  summaryHeader: {
    backgroundColor: COLORS.headerBg,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  summaryHeaderText: { fontSize: 9, fontWeight: "bold", color: COLORS.white },
  summaryBody: { padding: 8, backgroundColor: COLORS.light },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.side,
  },
  summaryLabel: { fontSize: 7, color: COLORS.deep, flexDirection: "row", alignItems: "center" },
  summaryValue: { fontSize: 7, fontWeight: "bold", color: COLORS.dark },

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

export interface TakvimOdemeRow {
  tanimi: string;
  tutar: number;
  cinsi: string;
  tarih: string;
  turu: string;
  odeme_durum: string;
}

export interface OdemelerTakvimPdfProps {
  year: number;
  month: number; // 0-indexed
  olusturmaTarihi: string;
  toplamKayit: number;
  bekleyenTl: number;
  bekleyenUsd: number;
  tamamlananTl: number;
  tamamlananUsd: number;
  rows: TakvimOdemeRow[];
  turDagilimi: { turu: string; adet: number; toplamTl: number; toplamUsd: number }[];
}

// ─── Helpers ───

function getDaysInMonthGridPdf(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    days.push(
      new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    );
  }
  return days;
}

function dateToKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return value.toFixed(0);
}

// ─── Document ───

export function OdemelerTakvimDocument(props: OdemelerTakvimPdfProps) {
  const logoPath = path.join(process.cwd(), "public", "logo-yatay.png");
  const gridDays = getDaysInMonthGridPdf(props.year, props.month);

  // Group by date
  const odemelerByDate = new Map<string, TakvimOdemeRow[]>();
  for (const o of props.rows) {
    const key = o.tarih.substring(0, 10);
    const arr = odemelerByDate.get(key);
    if (arr) arr.push(o);
    else odemelerByDate.set(key, [o]);
  }

  // Split into weeks (rows of 7)
  const weeks: Date[][] = [];
  for (let i = 0; i < gridDays.length; i += 7) {
    weeks.push(gridDays.slice(i, i + 7));
  }

  // Check if last row is needed (all next month)
  const lastWeek = weeks[weeks.length - 1];
  const lastWeekAllNextMonth = lastWeek.every(
    (d) => d.getMonth() !== props.month
  );
  const displayWeeks = lastWeekAllNextMonth ? weeks.slice(0, -1) : weeks;

  const today = new Date();
  const todayKey = dateToKey(today);

  const maxItemsPerCell = 3;

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View style={styles.headerLeft}>
            {/* eslint-disable-next-line */}
            <Image src={logoPath} style={{ width: 110, height: 25 }} />
            <Text style={styles.companyName}>
              {"HAS-MOB ORMAN URUNLERi MOBiLYA SAN. VE TiC. LTD. STi."}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={{ fontSize: 7, color: COLORS.side }}>www.vigowood.com</Text>
            <Text style={{ fontSize: 7, color: COLORS.side }}>info@vigowood.com</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBox}>
          <Text style={styles.titleText}>
            {`ODEME TAKViMi - ${AY_ISIMLERI[props.month]} ${props.year}`}
          </Text>
        </View>

        {/* Meta */}
        <View style={styles.metaContainer}>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{"RAPOR TARiHi"}</Text>
            <Text style={styles.metaValue}>{props.olusturmaTarihi}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{"TOPLAM KAYIT"}</Text>
            <Text style={styles.metaValue}>{formatTrNumber(props.toplamKayit)}</Text>
          </View>
          <View style={styles.metaCell}>
            <Text style={styles.metaLabel}>{"DONEM"}</Text>
            <Text style={styles.metaValue}>
              {`${AY_ISIMLERI[props.month]} ${props.year}`}
            </Text>
          </View>
          <View style={styles.metaCellLast}>
            <Text style={styles.metaLabel}>{"BEKLEYEN / TAMAMLANAN"}</Text>
            <Text style={styles.metaValue}>
              {`${props.rows.filter((r) => r.odeme_durum === "BEKLİYOR").length} / ${props.rows.filter((r) => r.odeme_durum === "TAMAMLANDI").length}`}
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

        {/* Calendar Grid */}
        {/* Day headers */}
        <View style={styles.dayHeaderRow}>
          {GUN_ISIMLERI.map((gun) => (
            <View key={gun} style={styles.dayHeaderCell}>
              <Text style={styles.dayHeaderText}>{gun}</Text>
            </View>
          ))}
        </View>

        {/* Week rows */}
        {displayWeeks.map((week, weekIdx) => (
          <View key={weekIdx} style={styles.weekRow}>
            {week.map((day, dayIdx) => {
              const key = dateToKey(day);
              const isCurrentMonth = day.getMonth() === props.month;
              const isToday = key === todayKey;
              const dayOdemeler = odemelerByDate.get(key) || [];
              const visible = dayOdemeler.slice(0, maxItemsPerCell);
              const extraCount = dayOdemeler.length - maxItemsPerCell;

              // Compute day totals
              let tlTotal = 0;
              let usdTotal = 0;
              for (const o of dayOdemeler) {
                if (o.cinsi === "USD") usdTotal += o.tutar;
                else tlTotal += o.tutar;
              }

              return (
                <View
                  key={dayIdx}
                  style={[
                    styles.dayCell,
                    !isCurrentMonth ? styles.dayCellEmpty : {},
                    isToday ? styles.dayCellToday : {},
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !isCurrentMonth ? styles.dayNumberOther : {},
                    ]}
                  >
                    {day.getDate()}
                  </Text>

                  {isCurrentMonth && visible.map((o, oi) => {
                    const tColors = TURU_COLORS[o.turu] || TURU_COLORS["DİĞER"];
                    const kisaltma = TURU_KISALTMA[o.turu] || o.turu.substring(0, 3);
                    return (
                      <View key={oi} style={styles.odemeItem}>
                        <Text
                          style={[
                            styles.odemeBadge,
                            {
                              backgroundColor: tColors.bg,
                              color: tColors.text,
                            },
                          ]}
                        >
                          {kisaltma}
                        </Text>
                        <Text
                          style={[
                            styles.odemeAmount,
                            o.odeme_durum === "TAMAMLANDI" ? { color: COLORS.side } : {},
                          ]}
                        >
                          {o.cinsi === "USD"
                            ? `$${formatCompact(o.tutar)}`
                            : `${formatCompact(o.tutar)}`}
                        </Text>
                      </View>
                    );
                  })}

                  {isCurrentMonth && extraCount > 0 && (
                    <Text style={styles.moreText}>{`+${extraCount} daha`}</Text>
                  )}

                  {isCurrentMonth && dayOdemeler.length > 0 && (
                    <View style={styles.dayTotal}>
                      {tlTotal > 0 && (
                        <Text style={[styles.dayTotalText, { color: "#b45309" }]}>
                          {`${formatCompact(tlTotal)} TL`}
                        </Text>
                      )}
                      {usdTotal > 0 && (
                        <Text style={[styles.dayTotalText, { color: "#1d4ed8" }]}>
                          {`$${formatCompact(usdTotal)}`}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        ))}

        {/* Summary: Tur dagilimi */}
        {props.turDagilimi.length > 0 && (
          <View style={styles.summaryContainer}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryHeaderText}>
                {"TUR BAZLI DAGILIM"}
              </Text>
            </View>
            <View style={styles.summaryBody}>
              {props.turDagilimi.map((t) => {
                const tColors = TURU_COLORS[t.turu] || TURU_COLORS["DİĞER"];
                return (
                  <View key={t.turu} style={styles.summaryRow}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text
                        style={[
                          styles.odemeBadge,
                          {
                            backgroundColor: tColors.bg,
                            color: tColors.text,
                            fontSize: 6,
                            paddingHorizontal: 4,
                            paddingVertical: 1,
                          },
                        ]}
                      >
                        {t.turu}
                      </Text>
                      <Text style={styles.summaryLabel}>
                        {`(${t.adet} adet)`}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {t.toplamTl > 0 && (
                        <Text style={[styles.summaryValue, { color: "#b45309" }]}>
                          {formatTrCurrency(t.toplamTl)}
                        </Text>
                      )}
                      {t.toplamUsd > 0 && (
                        <Text style={[styles.summaryValue, { color: "#1d4ed8" }]}>
                          {`$${formatTrNumber(t.toplamUsd, 2)}`}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerLeft}>
            {"VigoWood Platform - Otomatik Olusturulmustur"}
          </Text>
          <Text style={styles.footerRight}>
            {`${AY_ISIMLERI[props.month]} ${props.year}`}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
