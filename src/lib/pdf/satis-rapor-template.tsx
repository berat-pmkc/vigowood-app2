import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Helvetica" },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#474237",
  },
  subtitle: {
    fontSize: 9,
    textAlign: "center",
    marginBottom: 15,
    color: "#5e5747",
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
    fontSize: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 6,
    color: "#474237",
    borderBottomWidth: 1,
    borderBottomColor: "#cdbd9d",
    paddingBottom: 3,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#cdbd9d",
    fontWeight: "bold",
    fontSize: 7,
    borderWidth: 1,
    borderColor: "#a99c7d",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#a99c7d",
    fontSize: 7,
  },
  tableRowAlt: { backgroundColor: "#f0ede1" },
  tableRowTotal: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#a99c7d",
    fontWeight: "bold",
    fontSize: 7,
    backgroundColor: "#e8e2d3",
  },
  cellNum: { padding: 3, width: 30, textAlign: "center" },
  cellSku: { padding: 3, flex: 1, textAlign: "left" },
  cellAdet: { padding: 3, width: 60, textAlign: "right" },
  cellTutar: { padding: 3, width: 80, textAlign: "right" },
  summaryBox: {
    marginTop: 15,
    padding: 10,
    backgroundColor: "#f0ede1",
    borderWidth: 1,
    borderColor: "#a99c7d",
    borderRadius: 3,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 3,
    fontSize: 9,
  },
  summaryRowBold: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "#a99c7d",
    fontSize: 10,
    fontWeight: "bold",
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 30,
    right: 30,
    fontSize: 7,
    color: "#a99c7d",
    textAlign: "center",
  },
});

function formatTR(n: number): string {
  return Math.round(n).toLocaleString("tr-TR");
}

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

function SkuTable({
  rows,
  title,
}: {
  rows: SkuAggRow[];
  title: string;
}) {
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
          style={[
            styles.tableRow,
            i % 2 === 1 ? styles.tableRowAlt : {},
          ]}
        >
          <Text style={styles.cellNum}>{i + 1}</Text>
          <Text style={styles.cellSku}>{row.sku}</Text>
          <Text style={styles.cellAdet}>{formatTR(row.adet)}</Text>
          <Text style={styles.cellTutar}>{formatTR(row.tutar)}</Text>
        </View>
      ))}
      <View style={styles.tableRowTotal}>
        <Text style={styles.cellNum} />
        <Text style={styles.cellSku}>TOPLAM</Text>
        <Text style={styles.cellAdet}>{formatTR(totalAdet)}</Text>
        <Text style={styles.cellTutar}>{formatTR(totalTutar)}</Text>
      </View>
    </View>
  );
}

export function SatisRaporDocument(props: SatisRaporPdfProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Gün Sonu Satış Raporu</Text>
        <Text style={styles.subtitle}>
          VigoWood — {props.raporId}
        </Text>

        <View style={styles.metaRow}>
          <Text>Rapor Tarihi: {props.raporTarihi}</Text>
          <Text>Oluşturulma: {props.olusturmaTarihi}</Text>
        </View>

        <SkuTable rows={props.trRows} title="TR Satışlar" />
        <SkuTable rows={props.ihracatRows} title="İhracat Satışlar" />

        <View style={styles.summaryBox}>
          <View style={styles.summaryRow}>
            <Text>TR Satış Tutarı:</Text>
            <Text>₺{formatTR(props.trTutar)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text>İhracat Tutarı:</Text>
            <Text>₺{formatTR(props.ihracatTutar)}</Text>
          </View>
          <View style={styles.summaryRowBold}>
            <Text>GENEL TOPLAM:</Text>
            <Text>
              ₺{formatTR(props.toplamTutar)} —{" "}
              {formatTR(props.toplamAdet)} adet
            </Text>
          </View>
        </View>

        {props.kanalRows.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>
              Satış Kanallarına Göre Dağılım
            </Text>
            <View style={styles.tableHeader}>
              <Text style={styles.cellNum}>#</Text>
              <Text style={styles.cellSku}>Kanal</Text>
              <Text style={styles.cellAdet}>Adet</Text>
              <Text style={styles.cellTutar}>Tutar (TL)</Text>
            </View>
            {props.kanalRows.map((row, i) => (
              <View
                key={row.kanal}
                style={[
                  styles.tableRow,
                  i % 2 === 1 ? styles.tableRowAlt : {},
                ]}
              >
                <Text style={styles.cellNum}>{i + 1}</Text>
                <Text style={styles.cellSku}>{row.kanal}</Text>
                <Text style={styles.cellAdet}>{formatTR(row.adet)}</Text>
                <Text style={styles.cellTutar}>
                  {formatTR(row.tutar)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.footer}>
          Bu rapor VigoWood Platform tarafından otomatik oluşturulmuştur.
        </Text>
      </Page>
    </Document>
  );
}
