import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Link,
  StyleSheet,
} from "@react-pdf/renderer";
import { registerTurkishFonts } from "./pdf-utils";

registerTurkishFonts();

// ─── Colors (VigoWood palette) ──────────────────────

const C = {
  primary: "#cdbd9d",
  light: "#f0ede1",
  side: "#a99c7d",
  deep: "#5e5747",
  dark: "#474237",
  white: "#ffffff",
  codeBg: "#f5f3ef",
  codeBorder: "#e0dbd0",
  quoteBorder: "#cdbd9d",
  quoteBg: "#faf8f5",
  tableBorder: "#d4cfc4",
  tableHeaderBg: "#f0ede1",
  tableStripeBg: "#faf9f6",
  link: "#3368b1",
  checkOn: "#70c1aa",
  checkOff: "#a99c7d",
};

// ─── Styles ─────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    padding: 40,
    paddingBottom: 60,
    fontSize: 10,
    fontFamily: "Roboto",
    color: C.dark,
    backgroundColor: C.white,
  },
  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: C.primary,
  },
  companyName: { fontSize: 16, fontWeight: "bold", color: C.dark },
  headerSub: { fontSize: 8, color: C.side, marginTop: 2 },
  headerRight: { alignItems: "flex-end" as const },
  headerCode: { fontSize: 8, color: C.side },
  headerDate: { fontSize: 8, color: C.side, marginTop: 2 },
  // Title box
  titleBox: {
    backgroundColor: C.dark,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderRadius: 2,
  },
  titleText: {
    fontSize: 12,
    fontWeight: "bold",
    color: C.white,
    textAlign: "center" as const,
  },
  // Headings
  h1: {
    fontSize: 15,
    fontWeight: "bold",
    marginTop: 14,
    marginBottom: 6,
    color: C.dark,
  },
  h2: {
    fontSize: 13,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 5,
    color: C.deep,
    borderBottomWidth: 1,
    borderBottomColor: C.light,
    paddingBottom: 3,
  },
  h3: {
    fontSize: 11,
    fontWeight: "bold",
    marginTop: 10,
    marginBottom: 4,
    color: C.deep,
  },
  h4: {
    fontSize: 10,
    fontWeight: "bold",
    marginTop: 8,
    marginBottom: 3,
    color: C.deep,
  },
  // Paragraph
  paragraph: { fontSize: 10, lineHeight: 1.6, marginBottom: 5 },
  // Lists
  bulletRow: { flexDirection: "row" as const, marginBottom: 3 },
  bulletDot: { width: 14, fontSize: 10, color: C.side },
  bulletText: { flex: 1, fontSize: 10, lineHeight: 1.5 },
  orderedNum: {
    width: 18,
    fontSize: 10,
    color: C.side,
    textAlign: "right" as const,
    marginRight: 4,
  },
  // Checkbox
  checkboxOn: { fontSize: 10, color: C.checkOn },
  checkboxOff: { fontSize: 10, color: C.checkOff },
  // Inline
  bold: { fontWeight: "bold" as const },
  italic: { fontStyle: "italic" as const },
  boldItalic: {
    fontWeight: "bold" as const,
    fontStyle: "italic" as const,
  },
  inlineCode: {
    fontSize: 9,
    backgroundColor: C.codeBg,
    color: C.deep,
  },
  linkText: { color: C.link, textDecoration: "underline" as const },
  strikethrough: {
    textDecoration: "line-through" as const,
    color: C.side,
  },
  // Code block
  codeBlock: {
    backgroundColor: C.codeBg,
    borderWidth: 1,
    borderColor: C.codeBorder,
    borderRadius: 3,
    padding: 10,
    marginVertical: 6,
  },
  codeBlockLang: {
    fontSize: 7,
    color: C.side,
    marginBottom: 4,
    textAlign: "right" as const,
  },
  codeLine: { fontSize: 8.5, lineHeight: 1.5, color: C.deep },
  // Blockquote
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: C.quoteBorder,
    backgroundColor: C.quoteBg,
    paddingLeft: 10,
    paddingVertical: 6,
    paddingRight: 8,
    marginVertical: 5,
    borderRadius: 1,
  },
  blockquoteText: {
    fontSize: 10,
    fontStyle: "italic" as const,
    lineHeight: 1.5,
    color: C.deep,
  },
  // HR
  hr: { borderBottomWidth: 1, borderBottomColor: C.primary, marginVertical: 10 },
  // Table
  table: {
    marginVertical: 6,
    borderWidth: 1,
    borderColor: C.tableBorder,
    borderRadius: 2,
  },
  tableRow: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: C.tableBorder,
  },
  tableRowLast: { flexDirection: "row" as const },
  tableHeaderCell: {
    backgroundColor: C.tableHeaderBg,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: C.tableBorder,
  },
  tableHeaderCellLast: {
    backgroundColor: C.tableHeaderBg,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tableCell: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: C.tableBorder,
  },
  tableCellLast: { paddingVertical: 4, paddingHorizontal: 6 },
  tableHeaderText: { fontSize: 9, fontWeight: "bold" as const, color: C.dark },
  tableCellText: { fontSize: 9, lineHeight: 1.4, color: C.deep },
  // Empty
  empty: { height: 4 },
  // Footer
  footer: {
    position: "absolute" as const,
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
    borderTopWidth: 1,
    borderTopColor: C.light,
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: C.side },
  pageNum: { fontSize: 7, color: C.side },
});

// ─── Block Types ────────────────────────────────────

type Align = "left" | "center" | "right";

type Block =
  | { type: "h1" | "h2" | "h3" | "h4"; text: string }
  | { type: "bullet"; text: string; indent: number; checked?: boolean | null }
  | { type: "ordered"; text: string; num: number; indent: number }
  | { type: "blockquote"; lines: string[] }
  | { type: "code"; lang: string; lines: string[] }
  | { type: "table"; headers: string[]; aligns: Align[]; rows: string[][] }
  | { type: "hr" }
  | { type: "paragraph"; text: string }
  | { type: "empty" };

// ─── Block-level Parser ─────────────────────────────

function splitTableRow(line: string): string[] {
  return line
    .split("|")
    .slice(1, -1)
    .map((c) => c.trim());
}

function isTableSeparator(line: string): boolean {
  const t = line.trim();
  return /^\|[-:\s|]+\|$/.test(t) && t.includes("-");
}

function parseMarkdown(md: string): Block[] {
  const lines = md.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const trim = raw.trim();

    // Empty line
    if (!trim) {
      blocks.push({ type: "empty" });
      i++;
      continue;
    }

    // Fenced code block
    if (trim.startsWith("```")) {
      const lang = trim.slice(3).trim();
      const code: string[] = [];
      i++;
      while (i < lines.length) {
        if (lines[i].trim().startsWith("```")) {
          i++;
          break;
        }
        code.push(lines[i]);
        i++;
      }
      blocks.push({ type: "code", lang, lines: code });
      continue;
    }

    // Horizontal rule (---, ***, ___ with optional spaces)
    if (/^[-*_]{3,}$/.test(trim.replace(/\s/g, ""))) {
      const chars = new Set(trim.replace(/\s/g, "").split(""));
      if (chars.size === 1) {
        blocks.push({ type: "hr" });
        i++;
        continue;
      }
    }

    // Headings
    const hm = trim.match(/^(#{1,6})\s+(.+)$/);
    if (hm) {
      const lvl = Math.min(hm[1].length, 4) as 1 | 2 | 3 | 4;
      blocks.push({ type: `h${lvl}` as "h1" | "h2" | "h3" | "h4", text: hm[2] });
      i++;
      continue;
    }

    // Table (header + separator + data rows)
    if (trim.startsWith("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1] || "")) {
      const headers = splitTableRow(trim);
      const seps = splitTableRow(lines[i + 1].trim());
      const aligns: Align[] = seps.map((c) => {
        const t = c.trim();
        if (t.startsWith(":") && t.endsWith(":")) return "center";
        if (t.endsWith(":")) return "right";
        return "left";
      });
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = splitTableRow(lines[i].trim());
        // Pad to header length
        while (cells.length < headers.length) cells.push("");
        rows.push(cells.slice(0, headers.length));
        i++;
      }
      blocks.push({ type: "table", headers, aligns, rows });
      continue;
    }

    // Blockquote (group consecutive > lines)
    if (trim.startsWith(">")) {
      const qLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        qLines.push(lines[i].trim().replace(/^>\s?/, ""));
        i++;
      }
      blocks.push({ type: "blockquote", lines: qLines });
      continue;
    }

    // Unordered list (with optional checkbox)
    const bm = raw.match(/^(\s*)([-*+])\s+(.+)$/);
    if (bm) {
      const indent = Math.floor(bm[1].length / 2);
      let text = bm[3];
      let checked: boolean | null = null;
      if (text.startsWith("[ ] ")) {
        checked = false;
        text = text.slice(4);
      } else if (text.startsWith("[x] ") || text.startsWith("[X] ")) {
        checked = true;
        text = text.slice(4);
      }
      blocks.push({ type: "bullet", text, indent, checked });
      i++;
      continue;
    }

    // Ordered list
    const om = raw.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (om) {
      blocks.push({
        type: "ordered",
        text: om[3],
        num: parseInt(om[2]),
        indent: Math.floor(om[1].length / 2),
      });
      i++;
      continue;
    }

    // Default: paragraph
    blocks.push({ type: "paragraph", text: trim });
    i++;
  }

  return blocks;
}

// ─── Inline Parser ──────────────────────────────────

type InlinePart =
  | { type: "text"; content: string }
  | { type: "bold"; content: string }
  | { type: "italic"; content: string }
  | { type: "boldItalic"; content: string }
  | { type: "code"; content: string }
  | { type: "link"; content: string; href: string }
  | { type: "strikethrough"; content: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  // Order matters: code, link, bold-italic, bold, italic, strikethrough
  const rx =
    /`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*{3}(.+?)\*{3}|\*{2}(.+?)\*{2}|\*(.+?)\*|~~(.+?)~~/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = rx.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: "text", content: text.slice(last, m.index) });
    }
    if (m[1] !== undefined) parts.push({ type: "code", content: m[1] });
    else if (m[2] !== undefined) parts.push({ type: "link", content: m[2], href: m[3] });
    else if (m[4] !== undefined) parts.push({ type: "boldItalic", content: m[4] });
    else if (m[5] !== undefined) parts.push({ type: "bold", content: m[5] });
    else if (m[6] !== undefined) parts.push({ type: "italic", content: m[6] });
    else if (m[7] !== undefined) parts.push({ type: "strikethrough", content: m[7] });
    last = m.index + m[0].length;
  }

  if (last < text.length) {
    parts.push({ type: "text", content: text.slice(last) });
  }

  return parts.length ? parts : [{ type: "text", content: text }];
}

// ─── Inline Renderer ────────────────────────────────

function InlineText({ text }: { text: string }): React.ReactElement {
  const parts = parseInline(text);
  return (
    <>
      {parts.map((p, i) => {
        switch (p.type) {
          case "bold":
            return (
              <Text key={i} style={s.bold}>
                {p.content}
              </Text>
            );
          case "italic":
            return (
              <Text key={i} style={s.italic}>
                {p.content}
              </Text>
            );
          case "boldItalic":
            return (
              <Text key={i} style={s.boldItalic}>
                {p.content}
              </Text>
            );
          case "code":
            return (
              <Text key={i} style={s.inlineCode}>
                {` ${p.content} `}
              </Text>
            );
          case "link":
            return (
              <Link key={i} src={p.href}>
                <Text style={s.linkText}>{p.content}</Text>
              </Link>
            );
          case "strikethrough":
            return (
              <Text key={i} style={s.strikethrough}>
                {p.content}
              </Text>
            );
          default:
            return <Text key={i}>{p.content}</Text>;
        }
      })}
    </>
  );
}

// ─── Table Renderer ─────────────────────────────────

function TableBlock({
  headers,
  aligns,
  rows,
}: {
  headers: string[];
  aligns: Align[];
  rows: string[][];
}): React.ReactElement {
  const colCount = headers.length;

  const alignMap: Record<Align, "left" | "center" | "right"> = {
    left: "left",
    center: "center",
    right: "right",
  };

  const renderCell = (
    content: string,
    colIdx: number,
    isHeader: boolean,
    isLastCol: boolean
  ) => {
    const cellStyle = isHeader
      ? isLastCol
        ? s.tableHeaderCellLast
        : s.tableHeaderCell
      : isLastCol
        ? s.tableCellLast
        : s.tableCell;
    const textStyle = isHeader ? s.tableHeaderText : s.tableCellText;
    const align = alignMap[aligns[colIdx] || "left"];

    return (
      <View key={colIdx} style={[cellStyle, { flex: 1 }]}>
        <Text style={[textStyle, { textAlign: align }]}>
          <InlineText text={content} />
        </Text>
      </View>
    );
  };

  return (
    <View style={s.table}>
      {/* Header row */}
      <View style={s.tableRow}>
        {headers.map((h, ci) => renderCell(h, ci, true, ci === colCount - 1))}
      </View>
      {/* Data rows */}
      {rows.map((row, ri) => (
        <View
          key={ri}
          style={[
            ri === rows.length - 1 ? s.tableRowLast : s.tableRow,
            ri % 2 === 1 ? { backgroundColor: C.tableStripeBg } : {},
          ]}
        >
          {row.map((cell, ci) => renderCell(cell, ci, false, ci === colCount - 1))}
        </View>
      ))}
    </View>
  );
}

// ─── Code Block Renderer ────────────────────────────

function CodeBlock({
  lang,
  lines,
}: {
  lang: string;
  lines: string[];
}): React.ReactElement {
  return (
    <View style={s.codeBlock} wrap={false}>
      {lang ? <Text style={s.codeBlockLang}>{lang}</Text> : null}
      {lines.map((line, i) => (
        <Text key={i} style={s.codeLine}>
          {line || " "}
        </Text>
      ))}
    </View>
  );
}

// ─── Blockquote Renderer ────────────────────────────

function BlockquoteBlock({ lines }: { lines: string[] }): React.ReactElement {
  return (
    <View style={s.blockquote}>
      {lines.map((line, i) => (
        <Text key={i} style={s.blockquoteText}>
          <InlineText text={line} />
        </Text>
      ))}
    </View>
  );
}

// ─── Main Document ──────────────────────────────────

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
  const blocks = parseMarkdown(markdown);

  return (
    <Document>
      <Page size="A4" style={s.page} wrap>
        {/* Header */}
        <View style={s.headerRow} fixed>
          <View>
            <Text style={s.companyName}>VigoWood</Text>
            <Text style={s.headerSub}>Agent Raporu</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerCode}>{fileCode}</Text>
            <Text style={s.headerDate}>{date}</Text>
          </View>
        </View>

        {/* Title */}
        <View style={s.titleBox}>
          <Text style={s.titleText}>{title}</Text>
        </View>

        {/* Content */}
        {blocks.map((block, idx) => {
          switch (block.type) {
            case "h1":
              return (
                <Text key={idx} style={s.h1}>
                  <InlineText text={block.text} />
                </Text>
              );
            case "h2":
              return (
                <Text key={idx} style={s.h2}>
                  <InlineText text={block.text} />
                </Text>
              );
            case "h3":
              return (
                <Text key={idx} style={s.h3}>
                  <InlineText text={block.text} />
                </Text>
              );
            case "h4":
              return (
                <Text key={idx} style={s.h4}>
                  <InlineText text={block.text} />
                </Text>
              );

            case "bullet": {
              const pl = block.indent * 12;
              const dot =
                block.checked === true
                  ? "\u2611 "
                  : block.checked === false
                    ? "\u2610 "
                    : "\u2022 ";
              const dotStyle =
                block.checked === true
                  ? s.checkboxOn
                  : block.checked === false
                    ? s.checkboxOff
                    : s.bulletDot;
              return (
                <View key={idx} style={[s.bulletRow, { paddingLeft: pl }]}>
                  <Text style={[s.bulletDot, dotStyle]}>{dot}</Text>
                  <Text style={s.bulletText}>
                    <InlineText text={block.text} />
                  </Text>
                </View>
              );
            }

            case "ordered": {
              const pl = block.indent * 12;
              return (
                <View key={idx} style={[s.bulletRow, { paddingLeft: pl }]}>
                  <Text style={s.orderedNum}>{block.num}.</Text>
                  <Text style={s.bulletText}>
                    <InlineText text={block.text} />
                  </Text>
                </View>
              );
            }

            case "blockquote":
              return <BlockquoteBlock key={idx} lines={block.lines} />;

            case "code":
              return <CodeBlock key={idx} lang={block.lang} lines={block.lines} />;

            case "table":
              return (
                <TableBlock
                  key={idx}
                  headers={block.headers}
                  aligns={block.aligns}
                  rows={block.rows}
                />
              );

            case "hr":
              return <View key={idx} style={s.hr} />;

            case "paragraph":
              return (
                <Text key={idx} style={s.paragraph}>
                  <InlineText text={block.text} />
                </Text>
              );

            case "empty":
              return <View key={idx} style={s.empty} />;

            default:
              return null;
          }
        })}

        {/* Footer (every page) */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>VigoWood — {fileCode}</Text>
          <Text
            style={s.pageNum}
            render={({ pageNumber, totalPages }) =>
              `Sayfa ${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}
