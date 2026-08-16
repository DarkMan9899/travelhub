/**
 * Minimal, dependency-free CSV parser (RFC 4180 subset: quoted fields,
 * embedded commas/newlines, escaped `""` quotes) — the CSV Import
 * Wizard's parse step (Phase 17 §21). No `papaparse`/similar dependency
 * exists in this workspace and the input shape is small (partner-typed
 * spreadsheets, capped at 500 rows server-side), so a hand-rolled parser
 * mirrors this codebase's own `icalParser.js` precedent (backend) rather
 * than adding a new dependency for a bounded parsing need.
 *
 * The first row is always treated as the header row. Returns objects
 * keyed by the (trimmed) header cell — never positional arrays — so a
 * consumer maps `dateFrom`/`dateTo`/etc. by name regardless of column
 * order.
 */

function splitLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

/**
 * @param {string} text - raw CSV file contents.
 * @returns {{ headers: string[], rows: Record<string, string>[] }}
 */
export function parseCsv(text) {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = splitLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cells = splitLine(line);
    return Object.fromEntries(
      headers.map((header, index) => [header, (cells[index] ?? '').trim()]),
    );
  });
  return { headers, rows };
}

export default parseCsv;
