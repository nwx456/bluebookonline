/**
 * Left-panel content detection for exam UIs (FRQ; copied from MCQ logic without modifying MCQ files).
 */

export type FrqLeftPanelMode = "table" | "graph" | "passage" | "none";

export const TABLE_FALLBACK_CLASS =
  "overflow-auto max-w-full [&_table]:table-auto [&_table]:w-full [&_table]:border-collapse [&_table]:border [&_table]:border-gray-300 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-medium [&_th]:text-left [&_td]:border [&_td]:border-gray-300 [&_td]:px-4 [&_td]:py-2.5";

export function isSvgContent(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  return t.startsWith("<svg") || t.includes("<svg");
}

export function isTableHtml(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  return t.includes("<table") && t.includes("</table>");
}

export function sanitizeTableHtml(html: string): string {
  let s = html.trim();
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<\/?(table|thead|tbody|tr|th|td)(\s[^>]*)?>/gi, (m, tag) =>
    m.startsWith("</") ? `</${tag}>` : `<${tag}>`
  );
  s = s.replace(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>/g, "");
  return s;
}

type TableSplitMode = "tab" | "spaces2" | "space1" | "pipe";

function splitTableRow(line: string, mode: TableSplitMode): string[] {
  if (mode === "pipe") {
    const parts = line.split("|").map((p) => p.trim());
    return parts.length > 2 ? parts.slice(1, -1) : parts;
  }
  if (mode === "tab") return line.split(/\t+/).map((p) => p.trim()).filter(Boolean);
  if (mode === "spaces2") return line.split(/\s{2,}/).map((p) => p.trim()).filter(Boolean);
  return line.split(/\s+/).map((p) => p.trim()).filter(Boolean);
}

function isPipeSeparatorRow(cells: string[]): boolean {
  return cells.length >= 1 && cells.every((c) => /^[-:\s]+$/.test(c));
}

function getTableSplitMode(lines: string[]): TableSplitMode {
  const pipeRows = lines.map((l) => splitTableRow(l, "pipe"));
  const dataRows = pipeRows.filter((r) => r.length >= 2 && !isPipeSeparatorRow(r));
  if (dataRows.length >= 2) {
    const colCount = dataRows[0].length;
    if (dataRows.every((r) => r.length === colCount) && lines.some((l) => (l.match(/\|/g)?.length ?? 0) >= 1))
      return "pipe";
  }
  if (lines.some((l) => l.includes("\t"))) return "tab";
  if (lines.some((l) => /\s{2,}/.test(l))) return "spaces2";
  return "space1";
}

export function looksLikeTableText(text: string | null): boolean {
  if (!text?.trim() || isTableHtml(text)) return false;
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) return false;
  const mode = getTableSplitMode(lines);
  const rows = lines.map((l) => splitTableRow(l, mode));
  const dataRows = mode === "pipe" ? rows.filter((r) => r.length >= 2 && !isPipeSeparatorRow(r)) : rows;
  if (dataRows.length < 2 || dataRows.some((r) => r.length < 2)) return false;
  const colCount = dataRows[0].length;
  if (dataRows.some((r) => r.length !== colCount)) return false;
  return true;
}

function looksLikeQuestionStem(text: string | null): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  if (isTableHtml(t) || isTableWithOptionLettersFormat(t) || looksLikeTableText(t) || isSvgContent(t))
    return false;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const listLikeLines = lines.filter(
    (l) => /^\s*[IVX]+\.\s/.test(l) || /^\s*\d+\.\s/.test(l)
  );
  if (listLikeLines.length >= 2 || (lines.length >= 2 && listLikeLines.length >= 1)) return false;
  const singleOrShort = lines.length <= 3 && t.length < 600;
  const endsWithQ = t.endsWith("?");
  const startsWithQuestion = /^(Which|What|How|Consider)\s/i.test(t);
  return singleOrShort && (endsWithQ || startsWithQuestion);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function plainTextToTableHtml(text: string): string {
  const lines = text.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return "";
  const mode = getTableSplitMode(lines);
  const rows = lines.map((l) => splitTableRow(l, mode));
  const dataRows = mode === "pipe" ? rows.filter((r) => r.length >= 2 && !isPipeSeparatorRow(r)) : rows;
  const thead =
    dataRows.length > 0
      ? `<thead><tr>${dataRows[0].map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`
      : "";
  const tbody =
    dataRows.length > 1
      ? `<tbody>${dataRows
          .slice(1)
          .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody>`
      : "";
  return `<table>${thead}${tbody}</table>`;
}

function extractTableBlock(text: string): string | null {
  const t = text.trim();
  const tableStart = t.search(/\|[\s|]/);
  if (tableStart < 0) return null;
  return t.slice(tableStart).trim();
}

export function isTableWithOptionLettersFormat(text: string | null): boolean {
  if (!text?.trim() || isTableHtml(text) || isSvgContent(text)) return false;
  const t = text.trim();
  if (!t.toLowerCase().includes("table:") && !t.startsWith("Table:")) return false;
  if (!/\([A-E]\)/.test(t)) return false;
  if (!t.includes("|")) return false;
  return true;
}

function parseTableWithOptionLettersToHtml(text: string): string {
  const t = text.trim();
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length >= 2) {
    const rows: string[][] = lines.map((line) =>
      line.split("|").map((c) => c.trim()).filter(Boolean)
    );
    if (rows.every((r) => r.length >= 2)) {
      let headerRow = rows[0];
      if (headerRow[0]?.toLowerCase().startsWith("table:")) {
        headerRow = [headerRow[0].replace(/^Table:\s*/i, "").trim(), ...headerRow.slice(1)];
      }
      const thead =
        headerRow.length > 0
          ? `<thead><tr>${headerRow.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`
          : "";
      const tbody =
        rows.length > 1
          ? `<tbody>${rows
              .slice(1)
              .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
              .join("")}</tbody>`
          : "";
      return `<table>${thead}${tbody}</table>`;
    }
  }

  const compactParts = t.split(/\s*\((A|B|C|D|E)\)\s*/);
  if (compactParts.length >= 3) {
    const headerPart = compactParts[0].trim();
    const headerCells = headerPart
      .replace(/^Table:\s*/i, "")
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);
    if (headerCells.length >= 2) {
      const thead = `<thead><tr><th></th>${headerCells.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr></thead>`;
      const tbodyParts: string[] = [];
      for (let i = 1; i < compactParts.length; i += 2) {
        const letter = compactParts[i];
        const cellPart = compactParts[i + 1]?.trim() ?? "";
        const cells = cellPart.split("|").map((c) => c.trim()).filter(Boolean);
        if (cells.length >= 1) {
          tbodyParts.push(
            `<tr><td>${escapeHtml(`(${letter})`)}</td>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
          );
        }
      }
      if (tbodyParts.length > 0) {
        return `<table>${thead}<tbody>${tbodyParts.join("")}</tbody></table>`;
      }
    }
  }

  return "";
}

export function getTableHtmlForPanel(content: string): string {
  if (isTableHtml(content)) return sanitizeTableHtml(content);
  if (isTableWithOptionLettersFormat(content))
    return sanitizeTableHtml(parseTableWithOptionLettersToHtml(content));
  const text = isSvgContent(content) ? (extractTableBlock(content) ?? content) : content;
  const raw = plainTextToTableHtml(text);
  return raw ? sanitizeTableHtml(raw) : "";
}

export function isTableContent(content: string | null): boolean {
  if (!content?.trim()) return false;
  return (
    isTableHtml(content) ||
    isTableWithOptionLettersFormat(content) ||
    looksLikeTableText(content)
  );
}

function referencesFigure(text: string): boolean {
  return /\b(graph|chart|figure|diagram|image|map|cartoon|illustrat|photograph|picture)\b/i.test(
    text
  );
}

function stripHtmlToPlain(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveFrqLeftPanelMode(
  leftContent: string,
  opts: { pdfUrl?: string | null; pageNumber?: number | null; hasPageRefs?: boolean }
): FrqLeftPanelMode {
  const content = leftContent?.trim() ?? "";
  const plain = stripHtmlToPlain(content);
  const hasPdfPage = Boolean(opts.pdfUrl && opts.pageNumber && opts.pageNumber >= 1);

  if (content && isTableContent(content)) return "table";
  if (isSvgContent(content)) return "graph";

  if (hasPdfPage && !isTableContent(content)) {
    if (!plain) return "graph";
    if (plain.length < 80 && (referencesFigure(plain) || opts.hasPageRefs)) return "graph";
    if (!plain && opts.hasPageRefs) return "graph";
  }

  if (content) {
    if (
      hasPdfPage &&
      opts.hasPageRefs &&
      plain.length < 120 &&
      referencesFigure(plain) &&
      !looksLikeQuestionStem(plain)
    ) {
      return "graph";
    }
    return "passage";
  }

  if (hasPdfPage && opts.hasPageRefs) return "graph";
  return "none";
}

export function hasFrqMeaningfulLeftContent(mode: FrqLeftPanelMode): boolean {
  return mode !== "none";
}

export function showFrqZoomToolbar(mode: FrqLeftPanelMode): boolean {
  return mode === "table" || mode === "graph";
}
