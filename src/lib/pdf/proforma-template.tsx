import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { PROFORMA_CONFIG, PALET_WEIGHT_KG } from "@/lib/constants";
import {
  formatPdfCurrency,
  formatPdfNumber,
  formatPdfDateISO,
  formatInvoiceDateStr,
} from "./pdf-utils";

const styles = StyleSheet.create({
  page: { padding: 30, fontSize: 8, fontFamily: "Helvetica" },
  title: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    padding: 6,
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 0,
  },
  // Invoice info row
  infoRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#000",
    borderTopWidth: 0,
  },
  infoCell: {
    padding: 4,
    borderRightWidth: 1,
    borderRightColor: "#000",
  },
  infoCellLast: { padding: 4 },
  infoBold: { fontWeight: "bold", textAlign: "center" },
  // Exporter / Buyer section
  twoCol: { flexDirection: "row" },
  halfBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#000",
    padding: 4,
  },
  sectionTitle: { fontWeight: "bold", fontSize: 8, marginBottom: 2 },
  // Product table
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#4285f4",
    color: "#fff",
    fontWeight: "bold",
    fontSize: 7,
    borderWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    fontSize: 7,
  },
  tableRowAlt: { backgroundColor: "#f8f9fa" },
  tableRowTotal: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
    fontWeight: "bold",
    fontSize: 7,
  },
  cell: { padding: 3, textAlign: "center" },
  cellLeft: { padding: 3, textAlign: "left" },
  cellRight: { padding: 3, textAlign: "right" },
  // Summary
  summaryRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  summaryLeft: {
    flex: 1,
    flexDirection: "row",
    borderRightWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#000",
  },
  summaryRight: {
    flex: 1,
    flexDirection: "row",
    borderRightWidth: 1,
    borderColor: "#000",
  },
  summaryLabel: { flex: 3, padding: 3 },
  summaryValue: { flex: 2, padding: 3, fontWeight: "bold" },
  // Bank
  bankTitle: {
    fontWeight: "bold",
    textAlign: "center",
    padding: 4,
    borderWidth: 1,
    borderColor: "#000",
    fontSize: 9,
  },
  bankRow: {
    flexDirection: "row",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  bankLabel: { width: 120, padding: 3 },
  bankValue: { flex: 1, padding: 3 },
  // Footer
  footer: {
    fontSize: 7,
    fontStyle: "italic",
    padding: 4,
    borderWidth: 1,
    borderColor: "#000",
    marginTop: 6,
  },
});

// Column widths as percentages
const COL = {
  no: "5%",
  desc: "24%",
  sku: "8%",
  gtip: "10%",
  palet: "8%",
  koli: "8%",
  qty: "9%",
  weight: "10%",
  unit: "9%",
  total: "9%",
};

export interface ProformaItem {
  sku: string;
  urun_adi_en: string;
  gtip: string;
  palet_sayisi: number;
  toplam_koli: number;
  qty: number;
  agirlik: number;
  birim_fiyat: number;
  toplam_fiyat: number;
}

export interface ProformaData {
  sevkiyat_id: string;
  country_code: string;
  shipment_number: number;
  sevk_tarihi: string | null;
  liman: string | null;
  konteyner_no: string | null;
  teslimat_tipi: string | null;
  items: ProformaItem[];
}

export function ProformaDocument({ data }: { data: ProformaData }) {
  const cc = data.country_code;
  const countryFormat = PROFORMA_CONFIG.COUNTRY_FORMAT[cc];
  const bankDetails = PROFORMA_CONFIG.BANK_BY_COUNTRY[cc];
  const buyerConfig = {
    DE: {
      businessName: "HAS-MOB ORMAN URUNLERI MOBILYA SANAYI VE TICARET LIMITED SIRKETI",
      vat: "DE350448756",
      address: "Catalpinar Mah. 5\n52300 Ordu",
    },
    UK: {
      businessName: "HAS-MOB ORMAN URUNLERI MOBILYA SANAYI VE TICARET LIMITED SIRKETI",
      vat: "0368836738",
      address: "346 WINSTON HOUSE 2-4 DOLLIS PARK LONDON",
    },
    USA: {
      businessName: "Hass Woodtech LLC",
      vat: "",
      address: "8 THE GREEN STREET STE:4000, DOVER, DE 19901 DE, USA",
    },
  }[cc] ?? { businessName: "", vat: "", address: "" };

  const dateISO = formatPdfDateISO(data.sevk_tarihi);
  const invoiceDateStr = formatInvoiceDateStr(data.sevk_tarihi);
  const invoiceNo = `${cc}${data.shipment_number}${invoiceDateStr}`;

  // Totals
  let totalPallets = 0;
  let totalBoxes = 0;
  let totalQty = 0;
  let totalWeight = 0;
  let grandTotal = 0;

  for (const item of data.items) {
    totalPallets += item.palet_sayisi;
    totalBoxes += item.toplam_koli;
    totalQty += item.qty;
    totalWeight += item.agirlik;
    grandTotal += item.toplam_fiyat;
  }

  const grossWeight = Math.round(totalWeight + totalPallets * PALET_WEIGHT_KG);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Title */}
        <Text style={styles.title}>COMMERCIAL INVOICE</Text>

        {/* Invoice Info */}
        <View style={styles.infoRow}>
          <View style={[styles.infoCell, { width: "30%" }]}>
            <Text>FATURA NUMARASI / INVOICE NO</Text>
          </View>
          <View style={[styles.infoCell, { width: "15%" }]}>
            <Text style={styles.infoBold}>{invoiceNo}</Text>
          </View>
          <View style={[styles.infoCell, { width: "12%" }]}>
            <Text style={{ textAlign: "center" }}>{"VARIŞ ÜLKESİ\nCOUNTRY"}</Text>
          </View>
          <View style={[styles.infoCell, { width: "8%" }]}>
            <Text style={styles.infoBold}>{cc}</Text>
          </View>
          <View style={[styles.infoCell, { width: "10%" }]}>
            <Text style={{ textAlign: "center" }}>{"SEVK NO\nSHIPPING NO"}</Text>
          </View>
          <View style={[styles.infoCell, { width: "7%" }]}>
            <Text style={styles.infoBold}>{data.shipment_number}</Text>
          </View>
          <View style={[styles.infoCell, { width: "8%" }]}>
            <Text style={{ textAlign: "center" }}>{"TARİH\nDATE"}</Text>
          </View>
          <View style={[styles.infoCellLast, { width: "10%" }]}>
            <Text style={styles.infoBold}>{dateISO}</Text>
          </View>
        </View>

        {/* Exporter / Buyer Headers */}
        <View style={styles.twoCol}>
          <View style={[styles.halfBox, { borderRightWidth: 0 }]}>
            <Text style={styles.sectionTitle}>İHRACATÇI / EXPORTER</Text>
          </View>
          <View style={styles.halfBox}>
            <Text style={styles.sectionTitle}>ALICI / BUYER</Text>
          </View>
        </View>

        {/* Exporter / Buyer Details */}
        <View style={styles.twoCol}>
          <View style={[styles.halfBox, { borderRightWidth: 0, borderTopWidth: 0 }]}>
            <Text>{PROFORMA_CONFIG.EXPORTER.companyName}</Text>
            <Text>{PROFORMA_CONFIG.EXPORTER.taxInfo}</Text>
            <Text style={{ marginTop: 2 }}>{PROFORMA_CONFIG.EXPORTER.address}</Text>
            <Text style={{ marginTop: 2 }}>Tel: {PROFORMA_CONFIG.EXPORTER.phone}</Text>
            <Text>E-mail: {PROFORMA_CONFIG.EXPORTER.email}</Text>
            <Text>Web: {PROFORMA_CONFIG.EXPORTER.web}</Text>
          </View>
          <View style={[styles.halfBox, { borderTopWidth: 0 }]}>
            <Text>Business name: {buyerConfig.businessName}</Text>
            {buyerConfig.vat ? <Text>Vat #: {buyerConfig.vat}</Text> : null}
            <Text style={{ marginTop: 2 }}>{buyerConfig.address}</Text>
            <Text style={{ marginTop: 2 }}>Tel: {PROFORMA_CONFIG.BUYER_CONTACT.phone}</Text>
            <Text>E-mail: {PROFORMA_CONFIG.BUYER_CONTACT.email}</Text>
            <Text>Contact: {PROFORMA_CONFIG.BUYER_CONTACT.contact}</Text>
          </View>
        </View>

        {/* Spacer */}
        <View style={{ height: 6 }} />

        {/* Product Table Header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.cell, { width: COL.no }]}>NO</Text>
          <Text style={[styles.cellLeft, { width: COL.desc }]}>{"ÜRÜN-HİZMET ADI /\nDESCRIPTION"}</Text>
          <Text style={[styles.cell, { width: COL.sku }]}>SKU</Text>
          <Text style={[styles.cell, { width: COL.gtip }]}>GTIP</Text>
          <Text style={[styles.cell, { width: COL.palet }]}>{"PALET\nPALLET"}</Text>
          <Text style={[styles.cell, { width: COL.koli }]}>{"KOLİ\nBOX"}</Text>
          <Text style={[styles.cell, { width: COL.qty }]}>{"MİKTAR\nQTY"}</Text>
          <Text style={[styles.cell, { width: COL.weight }]}>{"NET AĞIRLIK\nNET WEIGHT"}</Text>
          <Text style={[styles.cell, { width: COL.unit }]}>{"BİRİM FİYAT\nUNIT VALUE"}</Text>
          <Text style={[styles.cell, { width: COL.total }]}>{"TOPLAM\nTOTAL"}</Text>
        </View>

        {/* Product Rows */}
        {data.items.map((item, i) => (
          <View
            key={i}
            style={[styles.tableRow, i % 2 === 1 ? styles.tableRowAlt : {}]}
          >
            <Text style={[styles.cell, { width: COL.no }]}>{i + 1}</Text>
            <Text style={[styles.cellLeft, { width: COL.desc }]}>{item.urun_adi_en}</Text>
            <Text style={[styles.cell, { width: COL.sku }]}>{item.sku}</Text>
            <Text style={[styles.cell, { width: COL.gtip }]}>{item.gtip}</Text>
            <Text style={[styles.cell, { width: COL.palet }]}>{item.palet_sayisi}</Text>
            <Text style={[styles.cell, { width: COL.koli }]}>{item.toplam_koli}</Text>
            <Text style={[styles.cell, { width: COL.qty }]}>{item.qty}</Text>
            <Text style={[styles.cell, { width: COL.weight }]}>
              {formatPdfNumber(item.agirlik, 1, cc)}
            </Text>
            <Text style={[styles.cellRight, { width: COL.unit }]}>
              {item.birim_fiyat ? formatPdfCurrency(item.birim_fiyat, cc) : ""}
            </Text>
            <Text style={[styles.cellRight, { width: COL.total }]}>
              {item.birim_fiyat ? formatPdfCurrency(item.toplam_fiyat, cc) : ""}
            </Text>
          </View>
        ))}

        {/* Total Row */}
        <View style={styles.tableRowTotal}>
          <Text style={[styles.cell, { width: COL.no }]} />
          <Text style={[styles.cellLeft, { width: COL.desc }]} />
          <Text style={[styles.cell, { width: COL.sku }]} />
          <Text style={[styles.cellRight, { width: COL.gtip }]}>TOTAL :</Text>
          <Text style={[styles.cell, { width: COL.palet }]}>{totalPallets}</Text>
          <Text style={[styles.cell, { width: COL.koli }]}>{totalBoxes}</Text>
          <Text style={[styles.cell, { width: COL.qty }]}>
            {formatPdfNumber(totalQty, 0, cc)}
          </Text>
          <Text style={[styles.cell, { width: COL.weight }]}>
            {formatPdfNumber(totalWeight, 1, cc)}
          </Text>
          <Text style={[styles.cellRight, { width: COL.unit }]} />
          <Text style={[styles.cellRight, { width: COL.total }]}>
            {formatPdfCurrency(grandTotal, cc)}
          </Text>
        </View>

        {/* Spacer */}
        <View style={{ height: 6 }} />

        {/* Summary Section */}
        {[
          {
            leftLabel: "TESLİMAT TİPİ / DELIVERY",
            leftValue: data.teslimat_tipi ?? "DAP",
            rightLabel: "ARA TOPLAM / SUB TOTAL",
            rightValue: formatPdfCurrency(grandTotal, cc),
          },
          {
            leftLabel: "KONTEYNIR NO / CONTAINER NO",
            leftValue: data.konteyner_no ?? "",
            rightLabel: "NAKLİYE ÜCRETİ / SHIPPING FEE",
            rightValue: formatPdfCurrency(0, cc),
          },
          {
            leftLabel: "MENŞEİ / COUNTRY OF ORIGIN",
            leftValue: "TÜRKİYE",
            rightLabel: "HİZMET BEDELİ / SERVICE FEE",
            rightValue: formatPdfCurrency(0, cc),
          },
          {
            leftLabel: "ÖDEME / PAYMENT",
            leftValue: "Cash against goods",
            rightLabel: "GENEL TOPLAM / TOTAL",
            rightValue: formatPdfCurrency(grandTotal, cc),
            bold: true,
          },
        ].map((row, i) => (
          <View key={i} style={styles.summaryRow}>
            <View style={styles.summaryLeft}>
              <Text style={styles.summaryLabel}>{row.leftLabel}</Text>
              <Text style={styles.summaryValue}>{row.leftValue}</Text>
            </View>
            <View style={styles.summaryRight}>
              <Text style={styles.summaryLabel}>{row.rightLabel}</Text>
              <Text style={[styles.summaryValue, row.bold ? { fontSize: 9 } : {}]}>
                {row.rightValue}
              </Text>
            </View>
          </View>
        ))}

        {/* Port + Gross Weight */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryLabel}>ÇIKIŞ LİMANI / PORT</Text>
            <Text style={styles.summaryValue}>{data.liman ?? ""}</Text>
          </View>
          <View style={{ flex: 1 }} />
        </View>
        <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
          <View style={styles.summaryLeft}>
            <Text style={styles.summaryLabel}>BRÜT AĞIRLIK / GROSS WEIGHT [KG]</Text>
            <Text style={styles.summaryValue}>{grossWeight}</Text>
          </View>
          <View style={{ flex: 1 }} />
        </View>

        {/* Spacer */}
        <View style={{ height: 8 }} />

        {/* Bank Details */}
        {bankDetails && (
          <>
            <Text style={styles.bankTitle}>BANKA BİLGİLERİ / BANK ACCOUNT DETAILS</Text>
            {[
              ["FİRMA ADI / BENEFICIARY", bankDetails.beneficiary],
              ["BANKA ADI / BANK NAME", bankDetails.bankName],
              ["ŞUBE ADI / BRANCH NAME", bankDetails.branchName],
              ["SWIFT KODU / SWIFT CODE", bankDetails.swiftCode],
              ["PARA BİRİMİ / CURRENCY", bankDetails.currencyLabel],
              ["IBAN", bankDetails.iban],
            ].map(([label, value], i) => (
              <View key={i} style={styles.bankRow}>
                <Text style={styles.bankLabel}>{label}</Text>
                <Text style={[styles.bankValue, label === "PARA BİRİMİ / CURRENCY" ? { fontWeight: "bold" } : {}]}>
                  {value}
                </Text>
              </View>
            ))}
          </>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          *The exporter of the products by this document customs authorization declares that, except where otherwise clearly indicated, these products are of TÜRKİYE preferential origin.
        </Text>
      </Page>
    </Document>
  );
}
