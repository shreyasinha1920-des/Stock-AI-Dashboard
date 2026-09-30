/**
 * Reads a holdings file (XLSX, CSV or text PDF) into rows for the portfolio
 * editor. Runs entirely in the browser: the file is never uploaded.
 */

import { readCsv } from "@/lib/import/csv";
import { type PdfJs, readPdf } from "@/lib/import/pdf";
import { bestResult, type Grid, type ImportResult, tableToPositions } from "@/lib/import/table";
import { readXlsx } from "@/lib/import/xlsx";

export { PdfPasswordError } from "@/lib/import/pdf";
export type { ImportedRow, ImportResult } from "@/lib/import/table";

const MAX_BYTES = 10 * 1024 * 1024;

/** Names the broker from tell-tale text in the file, for the "from …" label. */
function sourceOf(fileName: string, grids: Grid[]): string {
  const text = `${fileName} ${grids
    .flat(2)
    .slice(0, 400)
    .join(" ")}`.toLowerCase();
  if (text.includes("zerodha") || /holdings-[a-z0-9]+\.xlsx/.test(fileName.toLowerCase())) {
    return "Zerodha holdings export";
  }
  if (text.includes("indmoney") || text.includes("indstocks")) {
    return "INDmoney holding statement";
  }
  if (text.includes("smallcase")) {
    return "smallcase export";
  }
  if (text.includes("groww")) {
    return "Groww export";
  }
  if (text.includes("depository") || text.includes("cdsl") || text.includes("nsdl")) {
    return "Depository holding statement";
  }
  return fileName;
}

/** pdf.js is large, so it's only loaded when a PDF is actually chosen. */
async function loadPdfJs(): Promise<PdfJs> {
  const pdfjs = await import("pdfjs-dist");
  // Served from /public; keep its version in step with the pdfjs-dist package.
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs as unknown as PdfJs;
}

export async function importHoldings(file: File, password?: string, pdfjs?: PdfJs): Promise<ImportResult> {
  if (file.size > MAX_BYTES) {
    throw new Error("That file is over 10 MB. Holdings exports are usually much smaller.");
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();
  let grids: Grid[];

  if (name.endsWith(".xlsx")) {
    grids = readXlsx(bytes).map((s) => s.grid);
  } else if (name.endsWith(".csv") || name.endsWith(".tsv") || name.endsWith(".txt")) {
    grids = [readCsv(new TextDecoder().decode(bytes))];
  } else if (name.endsWith(".pdf")) {
    grids = [await readPdf(bytes, pdfjs ?? (await loadPdfJs()), password)];
  } else if (name.endsWith(".xls")) {
    throw new Error("Old .xls files aren't supported. Re-save it as .xlsx or CSV and try again.");
  } else {
    throw new Error("Choose an .xlsx, .csv or .pdf file.");
  }

  const source = sourceOf(file.name, grids);
  const result = bestResult(grids.map((g) => tableToPositions(g, source)));
  if (!result) {
    const text = grids.flat(2).join(" ").trim();
    throw new Error(
      name.endsWith(".pdf") && !text
        ? "This PDF has no text layer (it's probably scanned), so it can't be read. Try your broker's Excel or CSV export."
        : "Couldn't find a holdings table. Look for columns like Symbol, Quantity and Average price."
    );
  }
  return result;
}
