import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";
import { registerTurkishFonts } from "./pdf-utils";

registerTurkishFonts();

const COLORS = {
  primary: "#cdbd9d",
  light: "#f0ede1",
  side: "#a99c7d",
  deep: "#5e5747",
  dark: "#474237",
  white: "#ffffff",
  headerBg: "#474237",
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontSize: 10,
    fontFamily: "Roboto",
    color: COLORS.dark,
  },
  // Header
  headerContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.primary,
  },
  companyName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.dark,
  },
  headerSubtitle: {
    fontSize: 8,
    color: COLORS.side,
    marginTop: 2,
  },
  headerRight: {
    alignItems: "flex-end",
  },
  headerCode: {
    fontSize: 8,
    color: COLORS.side,
    fontFamily: "Roboto",
  },
  headerDate: {
    fontSize: 8,
    color: COLORS.side,
    marginTop: 2,
  },
  // Title box
  titleBox: {
    backgroundColor: COLORS.headerBg,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderRadius: 2,
  },
  titleText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.white,
    textAlign: "center",
  },
  // Content
  h1: { fontSize: 16, fontWeight: "bold", marginTop: 14, marginBottom: 6, color: COLORS.dark },
  h2: { fontSize: 13, fontWeight: "bold", marginTop: 12, marginBottom: 5, color: COLORS.deep },
  h3: { fontSize: 11, fontWeight: "bold", marginTop: 10, marginBottom: 4, color: COLORS.deep },
  paragraph: { fontSize: 10, lineHeight: 1.6, marginBottom: 6 },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 3,
    paddingLeft: 8,
  },
  bulletDot: { width: 12, fontSize: 10 },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.5 },
  boldText: { fontWeight: "bold" },
  // Footer
  footer: {
    position: "absolute",
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.light,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: COLORS.side },
  pageNumber: { fontSize: 7, color: COLORS.side },
});

// ─── Markdown Parser ────────────────────────────────

type ParsedLine =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "bullet"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "empty" };

function parseMarkdownLines(markdown: string): ParsedLine[] {
  const lines = markdown.split("\n");
  const result: ParsedLine[] = [];

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      result.push({ type: "empty" });
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      result.push({ type: "h3", text: line.slice(4).trim() });
    } else if (line.startsWith("## ")) {
      result.push({ type: "h2", text: line.slice(3).trim() });
    } else if (line.startsWith("# ")) {
      result.push({ type: "h1", text: line.slice(2).trim() });
    }
    // Bullet list
    else if (/^\s*[-*]\s+/.test(line)) {
      result.push({ type: "bullet", text: line.replace(/^\s*[-*]\s+/, "").trim() });
    }
    // Numbered list → treat as bullet
    else if (/^\s*\d+\.\s+/.test(line)) {
      result.push({ type: "bullet", text: line.replace(/^\s*\d+\.\s+/, "").trim() });
    }
    // Normal paragraph
    else {
      result.push({ type: "paragraph", text: line.trim() });
    }
  }

  return result;
}

/** Render inline bold (**text**) as mixed Text elements */
function renderInlineText(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={styles.boldText}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

// ─── Document Component ─────────────────────────────

interface OutputRaporProps {
  title: string;
  fileCode: string;
  date: string;
  markdown: string;
}

export function OutputRaporDocument({
  title,
  fileCode,
  date,
  markdown,
}: OutputRaporProps) {
  const parsed = parseMarkdownLines(markdown);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.headerContainer}>
          <View>
            <Text style={styles.companyName}>VigoWood</Text>
            <Text style={styles.headerSubtitle}>Agent Raporu</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerCode}>{fileCode}</Text>
            <Text style={styles.headerDate}>{date}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleBox}>
          <Text style={styles.titleText}>{title}</Text>
        </View>

        {/* Content */}
        {parsed.map((line, idx) => {
          switch (line.type) {
            case "h1":
              return (
                <Text key={idx} style={styles.h1}>
                  {line.text}
                </Text>
              );
            case "h2":
              return (
                <Text key={idx} style={styles.h2}>
                  {line.text}
                </Text>
              );
            case "h3":
              return (
                <Text key={idx} style={styles.h3}>
                  {line.text}
                </Text>
              );
            case "bullet":
              return (
                <View key={idx} style={styles.bulletItem}>
                  <Text style={styles.bulletDot}>{"\u2022"}</Text>
                  <Text style={styles.bulletText}>
                    {renderInlineText(line.text)}
                  </Text>
                </View>
              );
            case "paragraph":
              return (
                <Text key={idx} style={styles.paragraph}>
                  {renderInlineText(line.text)}
                </Text>
              );
            case "empty":
              return <View key={idx} style={{ height: 4 }} />;
            default:
              return null;
          }
        })}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            VigoWood — {fileCode}
          </Text>
          <Text
            style={styles.pageNumber}
            render={({ pageNumber, totalPages }) =>
              `Sayfa ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
