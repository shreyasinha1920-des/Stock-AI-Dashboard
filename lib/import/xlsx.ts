/**
 * Minimal XLSX reader: unzips with fflate and reads cell values from the sheet
 * XML. Enough for broker exports (strings, numbers, inline strings); no
 * formulas, styles or dates. Works in the browser and in Node.
 */

import { strFromU8, unzipSync } from "fflate";
import type { Grid } from "@/lib/import/table";

const decode = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");

/** All text runs inside an element, joined (rich text is split into runs). */
const textOf = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1])).join("");

const columnIndex = (ref: string) => {
  const letters = ref.replace(/\d+/g, "");
  let index = 0;
  for (const ch of letters) {
    index = index * 26 + (ch.charCodeAt(0) - 64);
  }
  return index - 1;
};

export interface Sheet {
  name: string;
  grid: Grid;
}

export function readXlsx(bytes: Uint8Array): Sheet[] {
  const files = unzipSync(bytes, { filter: (f) => f.name.startsWith("xl/") && (f.name.endsWith(".xml") || f.name.endsWith(".rels")) });
  const read = (path: string) => (files[path] ? strFromU8(files[path]) : "");

  const shared = [...read("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1]));

  // Sheet names → files, via the workbook relationships.
  const rels = new Map(
    [...read("xl/_rels/workbook.xml.rels").matchAll(/<Relationship\b[^>]*>/g)].map((m) => {
      const id = /Id="([^"]+)"/.exec(m[0])?.[1] ?? "";
      const target = /Target="([^"]+)"/.exec(m[0])?.[1] ?? "";
      return [id, target.startsWith("/") ? target.slice(1) : `xl/${target}`];
    })
  );
  const sheets = [...read("xl/workbook.xml").matchAll(/<sheet\b[^>]*>/g)].map((m) => ({
    name: decode(/name="([^"]+)"/.exec(m[0])?.[1] ?? ""),
    path: rels.get(/r:id="([^"]+)"/.exec(m[0])?.[1] ?? "") ?? "",
  }));

  return sheets.map(({ name, path }) => {
    const grid: Grid = [];
    for (const rowMatch of read(path).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const row: string[] = [];
      for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cell[1];
        const body = cell[2] ?? "";
        const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1];
        const type = /t="([^"]+)"/.exec(attrs)?.[1];
        const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
        let value = "";
        if (type === "s" && v !== undefined) {
          value = shared[Number(v)] ?? "";
        } else if (type === "inlineStr") {
          value = textOf(body);
        } else if (v !== undefined) {
          value = decode(v);
        }
        const index = ref ? columnIndex(ref) : row.length;
        row[index] = value;
      }
      grid.push(Array.from(row, (c) => c ?? ""));
    }
    return { name, grid };
  });
}
