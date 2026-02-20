import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { PACKING_LIST_CONFIG, PALET_WEIGHT_KG } from "@/lib/constants";
import { formatPdfDate } from "./pdf-utils";

const styles = StyleSheet.create({
  page: { padding: 25, fontSize: 8, fontFamily: "Helvetica" },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
  },
  // Header info
  headerRow: { flexDirection: "row", marginBottom: 1 },
  headerLeft: { flex: 1 },
  headerRight: { width: 200 },
  label: { fontSize: 7, color: "#555" },
  value: { fontSize: 8 },
  companyName: { fontSize: 9, fontWeight: "bold", marginBottom: 2 },
  // Table
  tableWrapper: { marginTop: 8 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#d9ead3",
    fontWeight: "bold",
    fontSize: 6,
    borderWidth: 1,
    borderColor: "#000",
    minHeight: 28,
  },
  tableSubHeader: {
    flexDirection: "row",
    backgroundColor: "#d9ead3",
    fontWeight: "bold",
    fontSize: 6,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    minHeight: 22,
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    fontSize: 7,
    minHeight: 18,
  },
  tableTotalRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    fontSize: 7,
    fontWeight: "bold",
    minHeight: 18,
  },
  cell: { padding: 2, textAlign: "center", justifyContent: "center" },
  cellLeft: { padding: 2, textAlign: "left", justifyContent: "center" },
  // Footer
  footerSection: { marginTop: 12 },
  footerRow: { flexDirection: "row", marginBottom: 2 },
  footerLabel: { width: 180, fontSize: 7 },
  footerValue: { flex: 1, fontSize: 7 },
  contactSection: { marginTop: 10 },
  brandNote: { fontSize: 7, fontStyle: "italic", marginTop: 6 },
});

// Column widths
const C = {
  no: "4%",
  code: "8%",
  desc: "16%",
  type: "5%",
  palet: "6%",
  units: "7%",
  sizeW: "4%",
  sizeX1: "2%",
  sizeL: "4%",
  sizeX2: "2%",
  sizeH: "4%",
  boxes: "6%",
  boxWt: "7%",
  palGrs: "7%",
  net: "7%",
  gross: "7%",
  vol: "6%",
};

export interface PackingListItem {
  sku: string;
  urun_adi_en: string;
  palet_boyut: string;
  palet_yukseklik: number;
  palet_sayisi: number;
  qty: number;
  toplam_koli: number;
  koli_agirlik: number;
  agirlik: number; // net weight = koli_agirlik × toplam_koli
  hacim: number;
}

export interface PackingListData {
  sevkiyat_id: string;
  country_code: string;
  shipment_number: number;
  sevk_tarihi: string | null;
  konteyner_no: string | null;
  items: PackingListItem[];
}

export function PackingListDocument({ data }: { data: PackingListData }) {
  const cc = data.country_code;
  const dispatch = PACKING_LIST_CONFIG.COUNTRY_DISPATCH[cc] ?? { name: "", method: "" };
  const buyer = PACKING_LIST_CONFIG.COUNTRY_BUYER[cc] ?? { name1: "", name2: "", vat: "", address: "" };

  const plNumber = `PL-${data.sevkiyat_id}`;
  const dateStr = formatPdfDate(data.sevk_tarihi);

  // Calculate totals
  let totalPallets = 0;
  let totalUnits = 0;
  let totalBoxes = 0;
  let totalNetWeight = 0;
  let totalGrossWeight = 0;
  let totalVolume = 0;

  const enrichedItems = data.items.map((item) => {
    const netWeight = item.agirlik;
    const grossWeight = netWeight + item.palet_sayisi * PALET_WEIGHT_KG;
    const palletGross = item.palet_sayisi > 0 ? Math.round(grossWeight / item.palet_sayisi) : 0;

    // Parse palet boyut
    const match = item.palet_boyut?.match(/(\d+)\s*x\s*(\d+)/);
    const paletWidth = match ? parseInt(match[1]) : 80;
    const paletLength = match ? parseInt(match[2]) : 120;

    totalPallets += item.palet_sayisi;
    totalUnits += item.qty;
    totalBoxes += item.toplam_koli;
    totalNetWeight += netWeight;
    totalGrossWeight += grossWeight;
    totalVolume += item.hacim;

    return {
      ...item,
      netWeight,
      grossWeight,
      palletGross,
      paletWidth,
      paletLength,
    };
  });

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>Packing List / Çeki Listesi</Text>

        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.companyName}>{PACKING_LIST_CONFIG.EXPORTER.companyName}</Text>
            <Text style={styles.value}>{PACKING_LIST_CONFIG.EXPORTER.address1}</Text>
            <Text style={styles.value}>{PACKING_LIST_CONFIG.EXPORTER.address2}</Text>
            <Text style={styles.value}>{PACKING_LIST_CONFIG.EXPORTER.phone}</Text>
          </View>
          <View style={styles.headerRight}>
            <View style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={[styles.label, { width: 100 }]}>Packing List No:</Text>
              <Text style={[styles.value, { fontWeight: "bold" }]}>{plNumber}</Text>
            </View>
            <View style={{ flexDirection: "row", marginBottom: 2 }}>
              <Text style={[styles.label, { width: 100 }]}>Date / Tarih:</Text>
              <Text style={styles.value}>{dateStr}</Text>
            </View>
          </View>
        </View>

        {/* Consignee + Origin */}
        <View style={{ marginTop: 6 }}>
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <View style={{ flexDirection: "row" }}>
                <Text style={[styles.label, { width: 80 }]}>Consignee / Alıcı:</Text>
                <View>
                  <Text style={styles.value}>{buyer.name1}</Text>
                  {buyer.name2 ? <Text style={styles.value}>{buyer.name2}</Text> : null}
                </View>
              </View>
              <View style={{ flexDirection: "row", marginTop: 2 }}>
                <Text style={[styles.label, { width: 80 }]}>Address / Adres:</Text>
                <Text style={styles.value}>{buyer.address}</Text>
              </View>
              {buyer.vat ? (
                <View style={{ flexDirection: "row", marginTop: 1 }}>
                  <Text style={[styles.label, { width: 80 }]}>Vat #:</Text>
                  <Text style={styles.value}>{buyer.vat}</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.headerRight}>
              <View style={{ flexDirection: "row", marginBottom: 2 }}>
                <Text style={[styles.label, { width: 100 }]}>Country of Origin:</Text>
                <Text style={styles.value}>Turkiye</Text>
              </View>
              <View style={{ flexDirection: "row", marginBottom: 2 }}>
                <Text style={[styles.label, { width: 100 }]}>Final Destination:</Text>
                <Text style={styles.value}>{dispatch.name}</Text>
              </View>
              <View style={{ flexDirection: "row", marginBottom: 2 }}>
                <Text style={[styles.label, { width: 100 }]}>Dispatch Method:</Text>
                <Text style={styles.value}>{dispatch.method}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Product Table */}
        <View style={styles.tableWrapper}>
          {/* Header Row 1 */}
          <View style={styles.tableHeader}>
            <Text style={[styles.cell, { width: C.no }]}>NO</Text>
            <Text style={[styles.cell, { width: C.code }]}>Product Code</Text>
            <Text style={[styles.cellLeft, { width: C.desc }]}>Description</Text>
            <Text style={[styles.cell, { width: C.type }]}>Type</Text>
            <Text style={[styles.cell, { width: C.palet }]}>Packages</Text>
            <Text style={[styles.cell, { width: C.units }]}>Units</Text>
            <Text style={[styles.cell, { width: "16%" }]}>Size / Ebatı [cm]</Text>
            <Text style={[styles.cell, { width: C.boxes }]}>Boxes</Text>
            <Text style={[styles.cell, { width: C.boxWt }]}>Box Wt [kg]</Text>
            <Text style={[styles.cell, { width: "27%" }]}>WEIGHT / AĞIRLIK & VOL</Text>
          </View>

          {/* Header Row 2 */}
          <View style={styles.tableSubHeader}>
            <Text style={[styles.cell, { width: C.no }]} />
            <Text style={[styles.cell, { width: C.code }]} />
            <Text style={[styles.cellLeft, { width: C.desc }]} />
            <Text style={[styles.cell, { width: C.type }]} />
            <Text style={[styles.cell, { width: C.palet }]} />
            <Text style={[styles.cell, { width: C.units }]} />
            <Text style={[styles.cell, { width: "16%" }]} />
            <Text style={[styles.cell, { width: C.boxes }]} />
            <Text style={[styles.cell, { width: C.boxWt }]} />
            <Text style={[styles.cell, { width: C.palGrs }]}>Pallet Grs</Text>
            <Text style={[styles.cell, { width: C.net }]}>Net [kg]</Text>
            <Text style={[styles.cell, { width: C.gross }]}>Gross [kg]</Text>
            <Text style={[styles.cell, { width: C.vol }]}>Vol [m³]</Text>
          </View>

          {/* Product Rows */}
          {enrichedItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={[styles.cell, { width: C.no }]}>{i + 1}</Text>
              <Text style={[styles.cell, { width: C.code }]}>{item.sku}</Text>
              <Text style={[styles.cellLeft, { width: C.desc }]}>{item.urun_adi_en}</Text>
              <Text style={[styles.cell, { width: C.type }]}>Pallet</Text>
              <Text style={[styles.cell, { width: C.palet }]}>{item.palet_sayisi}</Text>
              <Text style={[styles.cell, { width: C.units }]}>{item.qty}</Text>
              <Text style={[styles.cell, { width: "16%" }]}>
                {item.paletLength}x{item.paletWidth}x{item.palet_yukseklik}
              </Text>
              <Text style={[styles.cell, { width: C.boxes }]}>{item.toplam_koli}</Text>
              <Text style={[styles.cell, { width: C.boxWt }]}>
                {item.koli_agirlik.toFixed(1)}
              </Text>
              <Text style={[styles.cell, { width: C.palGrs }]}>{item.palletGross}</Text>
              <Text style={[styles.cell, { width: C.net }]}>{Math.round(item.netWeight)}</Text>
              <Text style={[styles.cell, { width: C.gross }]}>{Math.round(item.grossWeight)}</Text>
              <Text style={[styles.cell, { width: C.vol }]}>{item.hacim.toFixed(1)}</Text>
            </View>
          ))}

          {/* Total Row */}
          <View style={styles.tableTotalRow}>
            <Text style={[styles.cell, { width: C.no }]} />
            <Text style={[styles.cell, { width: C.code }]} />
            <Text style={[styles.cellLeft, { width: C.desc }]}>Grand Totals / Toplam</Text>
            <Text style={[styles.cell, { width: C.type }]} />
            <Text style={[styles.cell, { width: C.palet }]}>{totalPallets}</Text>
            <Text style={[styles.cell, { width: C.units }]}>{totalUnits}</Text>
            <Text style={[styles.cell, { width: "16%" }]} />
            <Text style={[styles.cell, { width: C.boxes }]}>{totalBoxes}</Text>
            <Text style={[styles.cell, { width: C.boxWt }]} />
            <Text style={[styles.cell, { width: C.palGrs }]} />
            <Text style={[styles.cell, { width: C.net }]}>{Math.round(totalNetWeight)}</Text>
            <Text style={[styles.cell, { width: C.gross }]}>{Math.round(totalGrossWeight)}</Text>
            <Text style={[styles.cell, { width: C.vol }]}>{totalVolume.toFixed(1)}</Text>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footerSection}>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Place of Issue / Veriliş Yeri:</Text>
            <Text style={styles.footerValue}>{PACKING_LIST_CONFIG.SIGNATORY.placeOfIssue}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Signatory Company / İmzalayan:</Text>
            <Text style={styles.footerValue}>{PACKING_LIST_CONFIG.SIGNATORY.company}</Text>
          </View>
          <View style={styles.footerRow}>
            <Text style={styles.footerLabel}>Authorized Signatory / Yetkili Adı:</Text>
            <Text style={styles.footerValue}>{PACKING_LIST_CONFIG.SIGNATORY.authorizedName}</Text>
          </View>
        </View>

        <View style={styles.contactSection}>
          <Text style={{ fontSize: 7 }}>For questions about the shipment, please contact:</Text>
          <Text style={{ fontSize: 7, marginTop: 2 }}>
            {PACKING_LIST_CONFIG.CONTACT.name} | Phone: {PACKING_LIST_CONFIG.CONTACT.phone} | E-Mail: {PACKING_LIST_CONFIG.CONTACT.email}
          </Text>
        </View>

        <Text style={styles.brandNote}>*A brand of HAS-MOB</Text>
      </Page>
    </Document>
  );
}
