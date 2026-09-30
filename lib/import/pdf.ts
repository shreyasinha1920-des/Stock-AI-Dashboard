/**
 * Rebuilds tables from a text PDF (e.g. a CDSL/NSDL holding statement) using
 * the position of each piece of text. Scanned (image-only) PDFs have no text
 * and aren't supported.
 */

import { type Grid, parseNumber } from "@/lib/import/table";

/** The subset of pdf.js this needs, so Node tests can pass the legacy build. */
export interface PdfJs {
  getDocument: (src: { data: Uint8Array; password?: string; isEvalSupported?: boolean; verbosity?: number }) => {
    promise: Promise<{
      numPages: number;
      getPage: (n: number) => Promise<{
        getTextContent: () => Promise<{ items: unknown[] }>;
      }>;
    }>;
  };
}

interface Piece {
  x: number;
  right: number;
  y: number;
  text: string;
}

export class PdfPasswordError extends Error {
  constructor(readonly incorrect: boolean) {
    super(incorrect ? "That password didn't work." : "This PDF is password-protected.");
  }
}

const HEADER_HINT = /\b(qty|quantity|units|shares)\b/i;

/** Groups text pieces into lines, top to bottom, each sorted left to right. */
function toLines(pieces: Piece[]): Piece[][] {
  const lines: { y: number; pieces: Piece[] }[] = [];
  for (const p of pieces.sort((a, b) => b.y - a.y)) {
    const line = lines.find((l) => Math.abs(l.y - p.y) <= 3);
    if (line) {
      line.pieces.push(p);
    } else {
      lines.push({ y: p.y, pieces: [p] });
    }
  }
  return lines.map((l) => l.pieces.sort((a, b) => a.x - b.x));
}

/** Slots each piece of a line under the header column it overlaps most. */
function toRow(line: Piece[], columns: Piece[]): string[] {
  const row = columns.map(() => "");
  for (const piece of line) {
    const center = (piece.x + piece.right) / 2;
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    columns.forEach((col, i) => {
      // Text is left-aligned under its header, numbers usually right-aligned.
      const distance = Math.min(Math.abs(piece.x - col.x), Math.abs(piece.right - col.right), Math.abs(center - (col.x + col.right) / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });
    row[best] = row[best] ? `${row[best]} ${piece.text}` : piece.text;
  }
  return row;
}

export async function readPdf(bytes: Uint8Array, pdfjs: PdfJs, password?: string): Promise<Grid> {
  let doc: Awaited<ReturnType<PdfJs["getDocument"]>["promise"]>;
  try {
    // verbosity 0: errors only. Text extraction doesn't need the font files it would otherwise warn about.
    doc = await pdfjs.getDocument({ data: bytes, password, isEvalSupported: false, verbosity: 0 }).promise;
  } catch (error) {
    if ((error as { name?: string }).name === "PasswordException") {
      throw new PdfPasswordError((error as { code?: number }).code === 2);
    }
    throw error;
  }

  const grid: Grid = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const { items } = await (await doc.getPage(n)).getTextContent();
    const pieces: Piece[] = (items as { str?: string; transform?: number[]; width?: number }[])
      .filter((it) => it.str?.trim() && it.transform)
      .map((it) => ({
        x: it.transform![4],
        right: it.transform![4] + (it.width ?? 0),
        y: it.transform![5],
        text: it.str!.trim(),
      }));
    const lines = toLines(pieces);

    // Everything that isn't the table becomes one-cell-per-piece rows, so
    // summary lines like "Total Value 12,345" are still searchable.
    const headerAt = lines.findIndex((line) => line.length >= 3 && line.some((p) => HEADER_HINT.test(p.text)));
    if (headerAt === -1) {
      grid.push(...lines.map((line) => line.map((p) => p.text)));
      continue;
    }
    const columns = lines[headerAt];
    grid.push(...lines.slice(0, headerAt).map((line) => line.map((p) => p.text)));
    grid.push(columns.map((c) => c.text));

    let previous: string[] | null = null;
    for (const line of lines.slice(headerAt + 1)) {
      const row = toRow(line, columns);
      const hasNumber = row.some((cell) => Number.isFinite(parseNumber(cell)));
      // A wrapped company name: text only, directly under a holding row.
      if (!hasNumber && previous && line.every((p) => !/^total/i.test(p.text))) {
        row.forEach((cell, i) => {
          if (cell && previous) {
            previous[i] = `${previous[i]} ${cell}`.trim();
          }
        });
        continue;
      }
      grid.push(row);
      previous = hasNumber ? row : null;
    }
  }
  return grid;
}
