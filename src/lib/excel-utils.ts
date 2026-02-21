import * as XLSX from "xlsx";

export interface ExcelColumn {
  key: string;
  header: string;
  width?: number;
}

/**
 * Client-side Excel file generation and download.
 */
export function exportToExcel(
  data: Record<string, unknown>[],
  columns: ExcelColumn[],
  filename: string
): void {
  // Map data to header-keyed rows
  const rows = data.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) {
      obj[col.header] = row[col.key] ?? "";
    }
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);

  // Set column widths
  worksheet["!cols"] = columns.map((col) => ({
    wch: col.width ?? 15,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Veri");

  // Generate file and trigger download
  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

/**
 * Parse Excel/CSV file to row objects.
 * Returns header row + data rows as string[][] for preview,
 * and parsed objects keyed by header name.
 */
export function parseExcelFile(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(
          worksheet,
          { raw: false, defval: "" }
        );

        if (jsonData.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }

        const headers = Object.keys(jsonData[0]);
        resolve({ headers, rows: jsonData });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Dosya okunamadı"));
    reader.readAsArrayBuffer(file);
  });
}
